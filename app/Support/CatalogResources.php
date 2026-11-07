<?php

namespace App\Support;

use App\Models\AddOn;
use App\Models\Agent;
use App\Models\Material;
use App\Models\Order;
use App\Models\PricelistItem;
use App\Models\ProductOption;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\Rule;

/**
 * Field definitions for the admin catalog screens (Material, Pricelist, Add-on, Ejen).
 * The same definition drives validation and the generic React table/form.
 */
class CatalogResources
{
    /**
     * @return array<string, array<string, mixed>>
     */
    public static function all(): array
    {
        $options = fn (array $values) => array_map(fn ($value) => ['value' => $value, 'label' => $value], $values);

        return [
            'materials' => [
                'model' => Material::class,
                'title' => 'Material',
                'description' => 'Senarai kain, lycra, kolar, aksesori & packaging beserta kos dan stok.',
                'order' => 'name',
                'fields' => [
                    ['key' => 'code', 'label' => 'Kod', 'type' => 'text', 'required' => true, 'unique' => true, 'placeholder' => 'MAT-EYELET'],
                    ['key' => 'name', 'label' => 'Nama', 'type' => 'text', 'required' => true],
                    ['key' => 'category', 'label' => 'Kategori', 'type' => 'select', 'required' => true, 'options' => $options(Material::CATEGORIES)],
                    ['key' => 'gsm', 'label' => 'GSM', 'type' => 'int'],
                    ['key' => 'unit', 'label' => 'Unit', 'type' => 'select', 'required' => true, 'options' => $options(Material::UNITS)],
                    ['key' => 'cost_per_unit', 'label' => 'Kos / unit', 'type' => 'money', 'required' => true],
                    ['key' => 'supplier', 'label' => 'Pembekal', 'type' => 'text'],
                    ['key' => 'stock_qty', 'label' => 'Stok', 'type' => 'number'],
                    ['key' => 'reorder_level', 'label' => 'Paras order semula', 'type' => 'number', 'table' => false],
                    ['key' => 'description', 'label' => 'Ciri-ciri / nota', 'type' => 'textarea', 'table' => false],
                    ['key' => 'active', 'label' => 'Aktif', 'type' => 'bool'],
                ],
                'warning' => fn (Material $material) => $material->stock_qty !== null && $material->reorder_level !== null
                    && (float) $material->stock_qty <= (float) $material->reorder_level ? 'Stok rendah' : null,
                'in_use' => fn (Material $material) => PricelistItem::where('material_code', $material->code)->exists()
                    ? 'Material ini digunakan dalam Pricelist. Nyahaktifkan sahaja.' : null,
            ],

            'pricelist' => [
                'model' => PricelistItem::class,
                'title' => 'Pricelist',
                'description' => 'Harga ikut produk, material, lengan, kolar dan tier kuantiti. Digunakan automatik dalam borang order.',
                'order' => ['product', 'material_code', 'sleeve', 'collar', 'min_qty'],
                'fields' => [
                    ['key' => 'code', 'label' => 'Kod', 'type' => 'text', 'required' => true, 'unique' => true, 'placeholder' => 'JRS-SS-EYE-10'],
                    ['key' => 'product', 'label' => 'Produk', 'type' => 'combo', 'required' => true, 'options' => $options(PricelistItem::PRODUCTS)],
                    ['key' => 'material_code', 'label' => 'Material', 'type' => 'select', 'options' => Material::orderBy('name')->get(['code', 'name'])
                        ->map(fn (Material $material) => ['value' => $material->code, 'label' => "{$material->name} ({$material->code})"])->all()],
                    ['key' => 'sleeve', 'label' => 'Lengan', 'type' => 'select', 'options' => $options(PricelistItem::SLEEVES)],
                    ['key' => 'collar', 'label' => 'Kolar', 'type' => 'select', 'options' => $options(PricelistItem::COLLARS)],
                    ['key' => 'min_qty', 'label' => 'Min helai', 'type' => 'int', 'required' => true],
                    ['key' => 'max_qty', 'label' => 'Max helai', 'type' => 'int', 'hint' => 'Kosong = tiada had'],
                    ['key' => 'price', 'label' => 'Harga / helai', 'type' => 'money', 'required' => true],
                    ['key' => 'cost', 'label' => 'Kos / helai', 'type' => 'money', 'required' => true],
                    ['key' => 'active', 'label' => 'Aktif', 'type' => 'bool'],
                    ['key' => 'notes', 'label' => 'Nota', 'type' => 'textarea', 'table' => false],
                ],
                'extra' => fn (PricelistItem $item) => [
                    'margin' => (float) $item->price > 0 ? round(((float) $item->price - (float) $item->cost) / (float) $item->price * 100, 1).'%' : '-',
                ],
                'extra_columns' => [['key' => 'margin', 'label' => 'Margin']],
            ],

            'addons' => [
                'model' => AddOn::class,
                'title' => 'Add-on',
                'description' => 'Caj tambahan seperti naik taraf Lycra, lengan panjang, saiz besar atau rush order.',
                'order' => 'name',
                'fields' => [
                    ['key' => 'code', 'label' => 'Kod', 'type' => 'text', 'required' => true, 'unique' => true, 'placeholder' => 'ADD-LYCRA'],
                    ['key' => 'name', 'label' => 'Nama', 'type' => 'text', 'required' => true],
                    ['key' => 'charge_type', 'label' => 'Cara caj', 'type' => 'select', 'required' => true, 'options' => $options(AddOn::CHARGE_TYPES)],
                    ['key' => 'price', 'label' => 'Harga', 'type' => 'money', 'required' => true],
                    ['key' => 'cost', 'label' => 'Kos', 'type' => 'money', 'required' => true],
                    ['key' => 'active', 'label' => 'Aktif', 'type' => 'bool'],
                    ['key' => 'notes', 'label' => 'Nota', 'type' => 'textarea', 'table' => false],
                ],
            ],

            'options' => [
                'model' => ProductOption::class,
                'title' => 'Spesifikasi',
                'description' => 'Pilihan dropdown dalam borang order (jenis baju, proses printing, neck). Harga tambahan / helai dicampur automatik pada harga pricelist.',
                'order' => ['group', 'sort', 'name'],
                'fields' => [
                    ['key' => 'group', 'label' => 'Kumpulan', 'type' => 'select', 'required' => true,
                        'options' => collect(ProductOption::GROUPS)->map(fn ($label, $value) => ['value' => $value, 'label' => $label])->values()->all()],
                    ['key' => 'name', 'label' => 'Nama', 'type' => 'text', 'required' => true],
                    ['key' => 'price', 'label' => 'Tambahan harga / helai', 'type' => 'money', 'required' => true, 'hint' => '0 = tiada caj tambahan'],
                    ['key' => 'cost', 'label' => 'Tambahan kos / helai', 'type' => 'money', 'required' => true],
                    ['key' => 'sort', 'label' => 'Susunan', 'type' => 'int', 'hint' => 'Nombor kecil dipaparkan dahulu'],
                    ['key' => 'active', 'label' => 'Aktif', 'type' => 'bool'],
                    ['key' => 'notes', 'label' => 'Nota', 'type' => 'textarea', 'table' => false],
                ],
            ],

            'agents' => [
                'model' => Agent::class,
                'title' => 'Ejen',
                'description' => 'Ejen jualan dan kadar komisen. Komisen dikira automatik pada setiap order.',
                'order' => 'name',
                'fields' => [
                    ['key' => 'name', 'label' => 'Nama', 'type' => 'text', 'required' => true],
                    ['key' => 'phone', 'label' => 'Telefon', 'type' => 'text'],
                    ['key' => 'area', 'label' => 'Kawasan / sekolah', 'type' => 'text'],
                    ['key' => 'commission_type', 'label' => 'Jenis komisen', 'type' => 'select', 'required' => true,
                        'options' => collect(Agent::COMMISSION_TYPES)->map(fn ($label, $value) => ['value' => $value, 'label' => $label])->values()->all()],
                    ['key' => 'commission_value', 'label' => 'Nilai komisen', 'type' => 'number', 'required' => true, 'hint' => '% atau RM per helai'],
                    ['key' => 'bank_account', 'label' => 'Bank & no. akaun', 'type' => 'text', 'table' => false],
                    ['key' => 'active', 'label' => 'Aktif', 'type' => 'bool'],
                    ['key' => 'notes', 'label' => 'Nota', 'type' => 'textarea', 'table' => false],
                ],
                'extra' => fn (Agent $agent) => [
                    'orders' => $agent->orders()->whereNull('cancelled_at')->count(),
                    'commission' => 'RM '.number_format((float) $agent->orders()->whereNull('cancelled_at')->sum('commission_amount'), 2),
                ],
                'extra_columns' => [['key' => 'orders', 'label' => 'Order'], ['key' => 'commission', 'label' => 'Jumlah komisen']],
                'in_use' => fn (Agent $agent) => Order::where('agent_id', $agent->id)->exists()
                    ? 'Ejen ini ada order. Nyahaktifkan sahaja supaya rekod komisen kekal.' : null,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function get(string $resource): array
    {
        return self::all()[$resource] ?? abort(404);
    }

    /**
     * @return array<string, mixed>
     */
    public static function rules(array $definition, ?Model $model = null): array
    {
        $table = (new $definition['model'])->getTable();
        $rules = [];

        foreach ($definition['fields'] as $field) {
            $rule = [($field['required'] ?? false) ? 'required' : 'nullable'];

            $rule = [...$rule, ...match ($field['type']) {
                'int' => ['integer', 'min:0'],
                'number', 'money' => ['numeric', 'min:0'],
                'bool' => ['boolean'],
                'textarea' => ['string', 'max:5000'],
                'select' => [Rule::in(array_column($field['options'], 'value'))],
                default => ['string', 'max:255'],
            }];

            if ($field['unique'] ?? false) {
                $rule[] = Rule::unique($table, $field['key'])->ignore($model?->getKey());
            }

            $rules[$field['key']] = $rule;
        }

        return $rules;
    }

    /**
     * Definition without closures/classes, safe to send to the browser.
     *
     * @return array<string, mixed>
     */
    public static function forClient(array $definition): array
    {
        return [
            'title' => $definition['title'],
            'description' => $definition['description'],
            'fields' => $definition['fields'],
            'extra_columns' => $definition['extra_columns'] ?? [],
        ];
    }
}
