<?php

namespace App\Services\GoogleSheets;

use App\Models\AddOn;
use App\Models\Agent;
use App\Models\Customer;
use App\Models\Inquiry;
use App\Models\Material;
use App\Models\Order;
use App\Models\OrderActivity;
use App\Models\OrderAttachment;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\PricelistItem;
use App\Models\ProductOption;
use App\Support\Settings;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * The website database is the source of truth; Google Sheets is a live mirror.
 *
 * - Model saves/deletes are buffered and pushed in one batch after the response (flush()).
 * - pushAll() rewrites every tab (use after first connecting, or to repair the sheet).
 * - pullCatalog() imports Materials / Pricelist / AddOns / ProductOptions / Agents edited in the sheet.
 */
class SheetSync
{
    /** Synced models, in push order. */
    public const MODELS = [
        Customer::class,
        Agent::class,
        Material::class,
        PricelistItem::class,
        AddOn::class,
        ProductOption::class,
        Order::class,
        OrderItem::class,
        Payment::class,
        OrderAttachment::class,
        OrderActivity::class,
        Inquiry::class,
    ];

    /** Settings mirrored to the "Settings" tab (secrets are never sent). */
    public const PUBLIC_SETTINGS = [
        'company.name' => 'Nama syarikat',
        'company.registration_no' => 'No. pendaftaran syarikat',
        'company.address' => 'Alamat syarikat',
        'company.phone' => 'No. WhatsApp syarikat',
        'company.email' => 'Email syarikat',
        'company.bank_name' => 'Bank',
        'company.bank_account' => 'No. akaun bank',
        'company.bank_holder' => 'Nama pemegang akaun',
        'production_days' => 'Hari bekerja kilang selepas jobsheet dihantar',
        'deposit_percent' => 'Peratus deposit default',
        'working_days' => 'Hari bekerja (1=Isnin ... 7=Ahad)',
        'holidays' => 'Cuti umum (dilangkau dalam kiraan hari bekerja)',
        'stage_targets' => 'Target hari bekerja setiap peringkat',
        'sizes' => 'Senarai size',
        'couriers' => 'Senarai kurier',
        'postage_rates' => 'Caj pos ikut zon (RM)',
        'size_surcharges' => 'Caj tambahan ikut saiz (RM / helai)',
    ];

    /** @var array<string, array{class: class-string<Model>, id: int|string, deleted: bool}> */
    private array $pending = [];

    private bool $paused = false;

    public function enabled(): bool
    {
        return ! $this->paused && config('hendrixx.sheets.auto_sync') && Client::fromConfig()->configured();
    }

    public function queue(Model $model, bool $deleted = false): void
    {
        if (! $this->enabled()) {
            return;
        }

        $this->pending[$model::class.'#'.$model->getKey()] = ['class' => $model::class, 'id' => $model->getKey(), 'deleted' => $deleted];
    }

    /** Push buffered changes. Never throws: a sheet outage must not break the website. */
    public function flush(): void
    {
        if ($this->pending === []) {
            return;
        }

        $pending = $this->pending;
        $this->pending = [];

        try {
            $operations = [];

            foreach ($pending as $change) {
                $class = $change['class'];
                $model = $change['deleted'] ? null : $class::find($change['id']);

                $operations[] = $model
                    ? ['action' => 'upsert', 'table' => $class::sheetName(), 'data' => $model->toSheetRow()]
                    : ['action' => 'delete', 'table' => $class::sheetName(), 'id' => $change['id']];
            }

            foreach (array_chunk($operations, 40) as $chunk) {
                Client::fromConfig()->batch($chunk);
            }

            $this->recordStatus(null);
        } catch (Throwable $exception) {
            Log::warning('Google Sheet sync gagal: '.$exception->getMessage());
            $this->recordStatus($exception->getMessage());
        }
    }

    /**
     * Rewrite every tab from the website database.
     *
     * @return array<string, int> rows written per tab
     */
    public function pushAll(): array
    {
        $client = Client::fromConfig();
        $counts = [];

        foreach (self::MODELS as $class) {
            $rows = $class::query()->orderBy('id')->get()->map->toSheetRow()->values()->all();
            $client->post(['action' => 'replace', 'table' => $class::sheetName(), 'rows' => $rows]);
            $counts[$class::sheetName()] = count($rows);
        }

        $client->post(['action' => 'replace', 'table' => 'Settings', 'rows' => $this->settingsRows()]);
        $counts['Settings'] = count(self::PUBLIC_SETTINGS);

        $this->recordStatus(null);

        return $counts;
    }

    public function pushSettings(): void
    {
        if (! $this->enabled()) {
            return;
        }

        try {
            Client::fromConfig()->post(['action' => 'replace', 'table' => 'Settings', 'rows' => $this->settingsRows()]);
        } catch (Throwable $exception) {
            $this->recordStatus($exception->getMessage());
        }
    }

    /**
     * Import catalog tabs edited directly in the sheet. Materials, pricelist and add-ons are
     * replaced as a whole (nothing references them by id); agents are updated by id because
     * orders point to them.
     *
     * @return array<string, int>
     */
    public function pullCatalog(): array
    {
        $client = Client::fromConfig();
        $this->paused = true;

        try {
            $materials = $client->get('list', ['table' => 'Materials']);
            $pricelist = $client->get('list', ['table' => 'Pricelist']);
            $addOns = $client->get('list', ['table' => 'AddOns']);
            $agents = $client->get('list', ['table' => 'Agents']);

            // Older sheets may not have this tab yet (Setup not re-run); an empty or missing tab
            // must never wipe the order form dropdowns.
            $options = collect(rescue(fn () => $client->get('list', ['table' => 'ProductOptions']), [], report: false))
                ->filter(fn ($row) => filled($row['name'] ?? null) && array_key_exists($row['group'] ?? '', ProductOption::GROUPS))
                ->values()->all();

            DB::transaction(function () use ($materials, $pricelist, $addOns, $options, $agents) {
                $this->replaceLocal(Material::class, $materials, ['code', 'name', 'category', 'gsm', 'unit', 'cost_per_unit', 'supplier', 'stock_qty', 'reorder_level', 'description', 'active']);
                $this->replaceLocal(PricelistItem::class, $pricelist, ['code', 'product', 'material_code', 'sleeve', 'collar', 'min_qty', 'max_qty', 'price', 'cost', 'active', 'notes']);
                $this->replaceLocal(AddOn::class, $addOns, ['code', 'name', 'charge_type', 'price', 'cost', 'active', 'notes']);

                if ($options !== []) {
                    $this->replaceLocal(ProductOption::class, $options, ['group', 'name', 'price', 'cost', 'sort', 'active', 'notes'], 'name');
                }

                foreach ($agents as $row) {
                    $agent = Agent::findOrNew($row['id']);
                    $agent->id = $row['id'];
                    $agent->fill($this->clean($row, ['name', 'phone', 'area', 'commission_type', 'commission_value', 'bank_account', 'active', 'notes']))->save();
                }
            });

            return [
                'Materials' => count($materials), 'Pricelist' => count($pricelist), 'AddOns' => count($addOns),
                'ProductOptions' => count($options), 'Agents' => count($agents),
            ];
        } finally {
            $this->paused = false;
        }
    }

    /**
     * @param  class-string<Model>  $class
     * @param  list<array<string, mixed>>  $rows
     * @param  list<string>  $fields
     * @param  string  $requiredKey  rows without this value are skipped
     */
    private function replaceLocal(string $class, array $rows, array $fields, string $requiredKey = 'code'): void
    {
        $class::query()->delete();

        foreach ($rows as $row) {
            if (blank($row[$requiredKey] ?? null)) {
                continue;
            }

            $model = new $class($this->clean($row, $fields));
            $model->id = $row['id'];
            $model->save();
        }
    }

    /**
     * @param  array<string, mixed>  $row
     * @param  list<string>  $fields
     * @return array<string, mixed>
     */
    private function clean(array $row, array $fields): array
    {
        $data = array_intersect_key($row, array_flip($fields));

        if (array_key_exists('active', $data)) {
            $data['active'] = (bool) $data['active'];
        }

        return array_map(fn ($value) => $value === '' ? null : $value, $data);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function settingsRows(): array
    {
        $rows = [];
        $id = 1;

        foreach (self::PUBLIC_SETTINGS as $key => $description) {
            $value = config("hendrixx.{$key}");

            $rows[] = [
                'id' => $id++,
                'key' => $key,
                'value' => is_array($value) ? (array_is_list($value) ? implode(', ', $value) : json_encode($value)) : (string) $value,
                'description' => $description,
            ];
        }

        return $rows;
    }

    private function recordStatus(?string $error): void
    {
        rescue(fn () => Settings::set([
            'sheets.last_sync_at' => now()->toDateTimeString(),
            'sheets.last_error' => $error,
        ]), report: false);
    }
}
