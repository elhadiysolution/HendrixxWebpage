<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\GoogleSheets\Client;
use App\Services\GoogleSheets\SheetSync;
use App\Support\Settings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class SettingsController extends Controller
{
    public function edit(): Response
    {
        $config = config('hendrixx');

        return Inertia::render('admin/settings', [
            'settings' => [
                'company' => $config['company'],
                'production_days' => (int) $config['production_days'],
                'deposit_percent' => (float) $config['deposit_percent'],
                'working_days' => array_map('intval', $config['working_days']),
                'holidays' => implode("\n", $config['holidays']),
                'stage_targets' => $config['stage_targets'],
                'sizes' => implode(', ', $config['sizes']),
                'couriers' => implode(', ', $config['couriers']),
                'postage_rates' => collect(array_keys($config['states']))
                    ->mapWithKeys(fn ($zone) => [$zone => (float) ($config['postage_rates'][$zone] ?? 0)]),
                'size_surcharges' => collect($config['sizes'])
                    ->mapWithKeys(fn ($size) => [$size => (float) ($config['size_surcharges'][$size] ?? 0)]),
                'sheets' => [
                    'url' => $config['sheets']['url'],
                    'auto_sync' => (bool) $config['sheets']['auto_sync'],
                    'has_token' => filled($config['sheets']['token']),
                ],
            ],
            'sheetStatus' => [
                'connected' => Client::fromConfig()->configured(),
                'last_sync_at' => $config['sheets']['last_sync_at'] ?? null,
                'last_error' => $config['sheets']['last_error'] ?? null,
            ],
        ]);
    }

    public function update(Request $request, SheetSync $sync): RedirectResponse
    {
        $data = $request->validate([
            'company.name' => ['required', 'string', 'max:255'],
            'company.registration_no' => ['nullable', 'string', 'max:255'],
            'company.address' => ['nullable', 'string', 'max:1000'],
            'company.phone' => ['required', 'string', 'max:30'],
            'company.email' => ['nullable', 'email', 'max:255'],
            'company.bank_name' => ['nullable', 'string', 'max:255'],
            'company.bank_account' => ['nullable', 'string', 'max:255'],
            'company.bank_holder' => ['nullable', 'string', 'max:255'],
            'production_days' => ['required', 'integer', 'between:1,60'],
            'deposit_percent' => ['required', 'numeric', 'between:0,100'],
            'working_days' => ['required', 'array', 'min:1'],
            'working_days.*' => ['integer', 'between:1,7'],
            'holidays' => ['nullable', 'string', 'max:5000'],
            'stage_targets' => ['required', 'array'],
            'stage_targets.*' => ['integer', 'between:0,60'],
            'sizes' => ['required', 'string', 'max:500'],
            'couriers' => ['nullable', 'string', 'max:1000'],
            'postage_rates' => ['nullable', 'array'],
            'postage_rates.*' => ['nullable', 'numeric', 'min:0'],
            'size_surcharges' => ['nullable', 'array'],
            'size_surcharges.*' => ['nullable', 'numeric', 'min:0'],
            'sheets.url' => ['nullable', 'url', 'starts_with:https://script.google.com/', 'max:500'],
            'sheets.token' => ['nullable', 'string', 'max:255'],
            'sheets.auto_sync' => ['boolean'],
        ], [
            'sheets.url.starts_with' => 'URL mesti URL Web App Apps Script (https://script.google.com/...).',
        ]);

        $holidays = collect(preg_split('/[\s,]+/', (string) ($data['holidays'] ?? '')))
            ->filter(fn ($date) => preg_match('/^\d{4}-\d{2}-\d{2}$/', $date))
            ->values()->all();

        $list = fn (?string $value) => collect(explode(',', (string) $value))->map(fn ($item) => trim($item))->filter()->values()->all();

        $values = [
            ...collect($data['company'])->mapWithKeys(fn ($value, $key) => ["company.{$key}" => $value])->all(),
            'production_days' => (int) $data['production_days'],
            'deposit_percent' => (float) $data['deposit_percent'],
            'working_days' => array_values(array_unique(array_map('intval', $data['working_days']))),
            'holidays' => $holidays,
            'stage_targets' => array_map('intval', array_intersect_key($data['stage_targets'], config('hendrixx.stage_targets'))),
            'sizes' => $list($data['sizes']),
            'couriers' => $list($data['couriers'] ?? ''),
            'postage_rates' => collect(array_keys(config('hendrixx.states')))
                ->mapWithKeys(fn ($zone) => [$zone => (float) ($data['postage_rates'][$zone] ?? 0)])->all(),
            'size_surcharges' => collect($list($data['sizes']))
                ->mapWithKeys(fn ($size) => [$size => (float) ($data['size_surcharges'][$size] ?? 0)])
                ->filter()->all(),
            'sheets.url' => $data['sheets']['url'] ?? null,
            'sheets.auto_sync' => (bool) ($data['sheets']['auto_sync'] ?? false),
        ];

        // Blank token field = keep the current token.
        if (filled($data['sheets']['token'] ?? null)) {
            $values['sheets.token'] = trim($data['sheets']['token']);
        }

        Settings::set($values);
        $sync->pushSettings();

        return back()->with('success', 'Tetapan disimpan.');
    }

    public function testSheet(): RedirectResponse
    {
        try {
            $result = Client::fromConfig()->get('ping');

            return back()->with('success', "Berjaya disambung ke Google Sheet ({$result['app']}).");
        } catch (Throwable $exception) {
            return back()->withErrors(['sheets' => $exception->getMessage()]);
        }
    }

    public function pushSheet(SheetSync $sync): RedirectResponse
    {
        try {
            $counts = $sync->pushAll();

            return back()->with('success', 'Semua data dihantar ke Google Sheet: '.collect($counts)->map(fn ($rows, $tab) => "{$tab} ({$rows})")->implode(', '));
        } catch (Throwable $exception) {
            return back()->withErrors(['sheets' => $exception->getMessage()]);
        }
    }

    public function pullSheet(SheetSync $sync): RedirectResponse
    {
        try {
            $counts = $sync->pullCatalog();

            return back()->with('success', 'Katalog diimport dari Google Sheet: '.collect($counts)->map(fn ($rows, $tab) => "{$tab} ({$rows})")->implode(', '));
        } catch (Throwable $exception) {
            return back()->withErrors(['sheets' => $exception->getMessage()]);
        }
    }
}
