<?php

namespace App\Http\Controllers\Finance;

use App\Http\Controllers\Controller;
use App\Models\TeamMember;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class TeamMemberController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        TeamMember::create($this->validated($request));

        return back()->with('success', 'Ahli team ditambah.');
    }

    public function update(Request $request, TeamMember $member): RedirectResponse
    {
        $member->update($this->validated($request));

        return back()->with('success', "Tetapan gaji {$member->name} disimpan.");
    }

    public function destroy(TeamMember $member): RedirectResponse
    {
        if ($member->payslips()->exists()) {
            return back()->withErrors(['member' => "{$member->name} ada slip gaji. Tandakan tidak aktif sahaja supaya rekod lama kekal."]);
        }

        $member->delete();

        return back()->with('success', 'Ahli team dipadam.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        $percent = ['nullable', 'numeric', 'min:0', 'max:100'];
        $money = ['nullable', 'numeric', 'min:0'];

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'position' => ['nullable', 'string', 'max:255'],
            'user_id' => ['nullable', 'exists:users,id'],
            'bank_account' => ['nullable', 'string', 'max:255'],
            'basic_salary' => $money,
            'allowance' => $money,
            'profit_share_percent' => $percent,
            'epf_employee_percent' => $percent,
            'epf_employer_percent' => $percent,
            'active' => ['boolean'],
        ]);

        // Empty number fields mean zero.
        foreach (['basic_salary', 'allowance', 'profit_share_percent', 'epf_employee_percent', 'epf_employer_percent'] as $key) {
            $data[$key] = (float) ($data[$key] ?? 0);
        }

        return $data;
    }
}
