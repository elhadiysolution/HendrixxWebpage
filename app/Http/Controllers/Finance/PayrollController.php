<?php

namespace App\Http\Controllers\Finance;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Payslip;
use App\Models\TeamMember;
use App\Models\User;
use App\Services\Finance\Finance;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Inertia\Inertia;
use Inertia\Response;

class PayrollController extends Controller
{
    public function index(Request $request, Finance $finance): Response
    {
        $month = $this->month($request->input('month'));
        $period = $month->format('Y-m');
        $summary = $finance->summary($month, $month->endOfMonth()->startOfDay());
        $pool = round($summary['net_profit'] + $summary['salary_paid'], 2);

        $members = TeamMember::with(['user', 'payslips' => fn ($query) => $query->where('period', $period)])
            ->orderByDesc('active')->orderBy('id')->get();
        $salesByUser = $finance->salesByUser($month, $month->endOfMonth()->startOfDay());

        $rows = $members
            ->filter(fn (TeamMember $member) => $member->active || $member->payslips->isNotEmpty())
            ->map(function (TeamMember $member) use ($finance, $period, $pool, $salesByUser) {
                $slip = $member->payslips->first();
                $values = $slip
                    ? collect($slip->only(['basic', 'allowance', 'sales_base', 'commission', 'profit_pool', 'profit_share', 'epf_employee', 'epf_employer', 'other_deduction', 'net_pay']))->map(fn ($value) => (float) $value)->all()
                    : $finance->payslip($member, $period, profitPool: $pool);

                return [
                    'member' => $member->only(['id', 'name', 'position']),
                    'payslip_id' => $slip?->id,
                    'saved' => $slip !== null,
                    'paid_on' => $slip?->paid_on?->toDateString(),
                    'notes' => $slip?->notes,
                    // Live reference for deciding commission: this month's orders where they are sales PIC.
                    'linked' => $member->user_id !== null,
                    'performance' => ($member->user_id ? $salesByUser->get($member->user_id) : null) ?? ['orders' => 0, 'pieces' => 0, 'sales' => 0.0],
                    ...$values,
                    'gross' => round($values['basic'] + $values['allowance'] + $values['commission'] + $values['profit_share'], 2),
                    'employer_cost' => round($values['basic'] + $values['allowance'] + $values['commission'] + $values['profit_share'] - $values['other_deduction'] + $values['epf_employer'], 2),
                ];
            })
            ->values();

        return Inertia::render('finance/payroll', [
            'month' => [
                'ref' => $period,
                'label' => $month->translatedFormat('F Y'),
                'previous' => $month->subMonthNoOverflow()->format('Y-m'),
                'next' => $month->addMonthNoOverflow()->format('Y-m'),
            ],
            'pool' => [
                'net_profit' => $summary['net_profit'],
                'salary_paid' => $summary['salary_paid'],
                'pool' => $pool,
            ],
            'rows' => $rows,
            'members' => $members->map(fn (TeamMember $member) => [
                ...$member->only(['id', 'name', 'position', 'user_id', 'bank_account', 'active']),
                'user' => $member->user?->name,
                ...collect($member->only(['basic_salary', 'allowance', 'profit_share_percent', 'epf_employee_percent', 'epf_employer_percent']))
                    ->map(fn ($value) => (float) $value)->all(),
            ]),
            'users' => User::orderBy('name')->get(['id', 'name']),
            'methods' => Payment::METHODS,
        ]);
    }

    /** Save (or recalculate) the month's payslip with the commission / deduction typed in. */
    public function save(Request $request, Finance $finance, TeamMember $member, string $period): RedirectResponse
    {
        $this->upsert($request, $finance, $member, $period);

        return back()->with('success', "Slip gaji {$member->name} disimpan.");
    }

    public function pay(Request $request, Finance $finance, TeamMember $member, string $period): RedirectResponse
    {
        $data = $request->validate([
            'paid_on' => ['required', 'date'],
            'method' => ['nullable', Rule::in(array_keys(Payment::METHODS))],
            'reference' => ['nullable', 'string', 'max:255'],
        ]);

        DB::transaction(function () use ($request, $finance, $member, $period, $data) {
            $slip = $this->upsert($request, $finance, $member, $period);
            $slip->update(['paid_on' => $data['paid_on']]);

            $slip->cashEntry()->create([
                'direction' => 'out',
                'category' => 'salary',
                'amount' => $slip->employerCost(),
                'entry_date' => $data['paid_on'],
                'description' => 'Gaji '.$member->name.' '.CarbonImmutable::createFromFormat('!Y-m', $period)->translatedFormat('F Y'),
                'party' => $member->name,
                'method' => $data['method'] ?? null,
                'reference' => $data['reference'] ?? null,
                'user_id' => $request->user()->id,
            ]);
        });

        return back()->with('success', "Gaji {$member->name} ditanda dibayar dan direkod sebagai cash out.");
    }

    public function unpay(Payslip $payslip): RedirectResponse
    {
        DB::transaction(function () use ($payslip) {
            $payslip->cashEntry()->delete();
            $payslip->update(['paid_on' => null]);
        });

        return back()->with('success', 'Status dibayar dibatalkan. Rekod cash out gaji dipadam.');
    }

    /** Drop an unpaid draft so the row goes back to the live calculation. */
    public function destroy(Payslip $payslip): RedirectResponse
    {
        if ($payslip->paid_on) {
            return back()->withErrors(['payslip' => 'Batalkan status dibayar dahulu.']);
        }

        $payslip->delete();

        return back()->with('success', 'Draf slip gaji dipadam.');
    }

    public function show(Payslip $payslip): View
    {
        $payslip->load('member');

        return view('documents.payslip', [
            'payslip' => $payslip,
            'month' => CarbonImmutable::createFromFormat('!Y-m', $payslip->period)->translatedFormat('F Y'),
            'company' => config('hendrixx.company'),
        ]);
    }

    private function upsert(Request $request, Finance $finance, TeamMember $member, string $period): Payslip
    {
        $month = $this->month($period, strict: true);
        $data = $request->validate([
            'commission' => ['nullable', 'numeric', 'min:0'],
            'other_deduction' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $slip = Payslip::firstOrNew(['team_member_id' => $member->id, 'period' => $month->format('Y-m')]);

        if ($slip->paid_on) {
            throw ValidationException::withMessages(['payslip' => 'Gaji bulan ini sudah dibayar. Batalkan status dibayar untuk ubah.']);
        }

        $slip->fill([
            ...$finance->payslip($member, $month->format('Y-m'), (float) ($data['commission'] ?? 0), (float) ($data['other_deduction'] ?? 0)),
            'notes' => $data['notes'] ?? null,
        ])->save();

        return $slip;
    }

    private function month(?string $value, bool $strict = false): CarbonImmutable
    {
        if (preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', (string) $value)) {
            return CarbonImmutable::createFromFormat('!Y-m', $value);
        }

        abort_if($strict, 404);

        return CarbonImmutable::today()->startOfMonth();
    }
}
