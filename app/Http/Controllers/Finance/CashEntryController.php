<?php

namespace App\Http\Controllers\Finance;

use App\Http\Controllers\Controller;
use App\Models\Campaign;
use App\Models\CashEntry;
use App\Models\Order;
use App\Models\Payment;
use App\Services\Finance\Finance;
use App\Support\FinancePeriod;
use App\Support\Settings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CashEntryController extends Controller
{
    public function index(Request $request, Finance $finance): Response
    {
        $period = FinancePeriod::make($request->input('period'), $request->input('ref'));
        [$from, $to] = [$period->from->toDateString(), $period->to->toDateString()];
        $direction = in_array($request->input('direction'), ['in', 'out'], true) ? $request->input('direction') : 'all';

        $payments = $direction === 'out' ? collect() : Payment::with(['order.customer', 'user'])->whereBetween('paid_on', [$from, $to])->get()
            ->map(fn (Payment $payment) => [
                'key' => 'payment-'.$payment->id,
                'id' => $payment->id,
                'source' => 'payment',
                'direction' => 'in',
                'category' => 'orders',
                'category_label' => 'Bayaran order ('.(Payment::TYPES[$payment->type] ?? $payment->type).')',
                'amount' => (float) $payment->amount,
                'entry_date' => $payment->paid_on->toDateString(),
                'description' => $payment->order?->title ?? '-',
                'party' => $payment->order?->customer?->organization ?: $payment->order?->customer?->name,
                'order' => $payment->order?->only(['id', 'order_no']),
                'campaign' => null,
                'method' => $payment->method,
                'method_label' => Payment::METHODS[$payment->method] ?? $payment->method,
                'reference' => $payment->reference,
                'receipt_url' => $payment->proof_path ? Storage::disk('public')->url($payment->proof_path) : null,
                'user' => $payment->user?->name,
                'locked' => 'Rekod dari order, ubah di halaman order.',
            ]);

        $entries = CashEntry::with(['order', 'campaign', 'user'])
            ->betweenDates($from, $to)
            ->when($direction !== 'all', fn ($query) => $query->where('direction', $direction))
            ->get()
            ->map(fn (CashEntry $entry) => [
                'key' => 'entry-'.$entry->id,
                'id' => $entry->id,
                'source' => 'entry',
                ...$entry->only(['direction', 'category', 'description', 'party', 'method', 'reference', 'order_id', 'campaign_id']),
                'category_label' => $entry->categoryLabel(),
                'method_label' => Payment::METHODS[$entry->method] ?? $entry->method,
                'amount' => (float) $entry->amount,
                'entry_date' => $entry->entry_date->toDateString(),
                'order' => $entry->order?->only(['id', 'order_no']),
                'campaign' => $entry->campaign?->only(['id', 'name']),
                'receipt_url' => $entry->receiptUrl(),
                'user' => $entry->user?->name,
                'locked' => $entry->lockReason(),
            ]);

        $rows = $payments->concat($entries)->sortByDesc(fn (array $row) => $row['entry_date'].$row['key'])->values();

        return Inertia::render('finance/cash-flow', [
            'period' => [
                'type' => $period->type,
                'ref' => $period->ref(),
                'label' => $period->label(),
                'previous' => $period->previous(),
                'next' => $period->next(),
            ],
            'periodTypes' => FinancePeriod::TYPES,
            'direction' => $direction,
            'rows' => $rows,
            'totals' => [
                'in' => round($rows->where('direction', 'in')->sum('amount'), 2),
                'out' => round($rows->where('direction', 'out')->sum('amount'), 2),
            ],
            'categories' => CashEntry::categories(),
            'methods' => Payment::METHODS,
            'orders' => Order::notCancelled()->latest()->limit(300)->get(['id', 'order_no', 'title']),
            'campaigns' => Campaign::orderByDesc('start_date')->get(['id', 'name']),
            'openingBalance' => (float) config('hendrixx.finance.opening_balance', 0),
            'cashBalance' => $finance->cashBalance(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);

        CashEntry::create([
            ...collect($data)->except('receipt')->all(),
            'user_id' => $request->user()->id,
            'receipt_path' => $request->file('receipt')?->store('finance/receipts', 'public'),
        ]);

        return back()->with('success', $data['direction'] === 'in' ? 'Cash in direkod.' : 'Cash out direkod.');
    }

    public function update(Request $request, CashEntry $entry): RedirectResponse
    {
        abort_if($entry->lockReason() !== null, 403, (string) $entry->lockReason());

        $data = $this->validated($request);

        if ($request->hasFile('receipt')) {
            if ($entry->receipt_path) {
                Storage::disk('public')->delete($entry->receipt_path);
            }
            $data['receipt_path'] = $request->file('receipt')->store('finance/receipts', 'public');
        }

        $entry->update(collect($data)->except('receipt')->all());

        return back()->with('success', 'Rekod dikemaskini.');
    }

    public function destroy(CashEntry $entry): RedirectResponse
    {
        abort_if($entry->lockReason() !== null, 403, (string) $entry->lockReason());

        if ($entry->receipt_path) {
            Storage::disk('public')->delete($entry->receipt_path);
        }

        $entry->delete();

        return back()->with('success', 'Rekod dipadam.');
    }

    public function openingBalance(Request $request): RedirectResponse
    {
        $data = $request->validate(['opening_balance' => ['required', 'numeric']]);
        Settings::set(['finance.opening_balance' => round((float) $data['opening_balance'], 2)]);

        return back()->with('success', 'Baki permulaan disimpan.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        $direction = $request->input('direction') === 'in' ? 'in' : 'out';

        return $request->validate([
            'direction' => ['required', Rule::in(['in', 'out'])],
            'category' => ['required', Rule::in(array_keys(CashEntry::categories()[$direction]))],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'entry_date' => ['required', 'date'],
            'description' => ['required', 'string', 'max:255'],
            'party' => ['nullable', 'string', 'max:255'],
            'order_id' => ['nullable', 'exists:orders,id'],
            'campaign_id' => ['nullable', 'exists:campaigns,id'],
            'method' => ['nullable', Rule::in(array_keys(Payment::METHODS))],
            'reference' => ['nullable', 'string', 'max:255'],
            'receipt' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
        ], [], ['category' => 'kategori', 'amount' => 'amaun', 'entry_date' => 'tarikh', 'description' => 'keterangan']);
    }
}
