<?php

namespace App\Http\Controllers\Finance;

use App\Http\Controllers\Controller;
use App\Models\Campaign;
use App\Services\Finance\Finance;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CampaignController extends Controller
{
    public function index(Finance $finance): Response
    {
        return Inertia::render('finance/targets', [
            'campaigns' => Campaign::orderByDesc('end_date')->get()->map(fn (Campaign $campaign) => $finance->campaignProgress($campaign)),
            'types' => Campaign::TYPES,
            'forecast' => $finance->forecast(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        Campaign::create($this->validated($request));

        return back()->with('success', 'Target ditambah.');
    }

    public function update(Request $request, Campaign $campaign): RedirectResponse
    {
        $campaign->update($this->validated($request));

        return back()->with('success', 'Target dikemaskini.');
    }

    public function destroy(Campaign $campaign): RedirectResponse
    {
        $campaign->delete();

        return back()->with('success', 'Target dipadam. Order yang dipautkan kekal, cuma tiada kempen lagi.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::in(array_keys(Campaign::TYPES))],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'target_sales' => ['nullable', 'numeric', 'min:0'],
            'target_orders' => ['nullable', 'integer', 'min:0'],
            'target_pieces' => ['nullable', 'integer', 'min:0'],
            'budget' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ], [], ['end_date' => 'tarikh tamat', 'start_date' => 'tarikh mula']);

        return [...$data, 'target_sales' => (float) ($data['target_sales'] ?? 0), 'budget' => (float) ($data['budget'] ?? 0)];
    }
}
