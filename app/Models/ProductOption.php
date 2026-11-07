<?php

namespace App\Models;

use App\Models\Concerns\SyncsToSheet;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

/**
 * Dropdown choices for order item specs (jenis baju, proses printing, neck).
 * Price / cost are per-piece surcharges added on top of the pricelist price.
 */
class ProductOption extends Model
{
    use SyncsToSheet;

    public const GROUPS = [
        'garment_type' => 'Jenis baju',
        'print_method' => 'Proses printing',
        'neck_type' => 'Jenis neck',
        'neck_finish' => 'Neck (sublimation / readymade)',
    ];

    protected $fillable = ['group', 'name', 'price', 'cost', 'sort', 'active', 'notes'];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'cost' => 'decimal:2',
            'sort' => 'integer',
            'active' => 'boolean',
        ];
    }

    /**
     * Active options keyed by group, e.g. ['print_method' => [['name' => 'Sublimation', 'price' => 0.0], ...]].
     *
     * @return array<string, list<array{name: string, price: float}>>
     */
    public static function grouped(): array
    {
        $options = self::where('active', true)->orderBy('sort')->orderBy('name')->get()->groupBy('group');

        return collect(self::GROUPS)->map(fn ($label, $group) => $options->get($group, collect())
            ->map(fn (self $option) => ['name' => $option->name, 'price' => (float) $option->price])->values()->all())->all();
    }

    public static function sheetName(): string
    {
        return 'ProductOptions';
    }

    public function toSheetRow(): array
    {
        return [
            ...$this->only(['id', 'group', 'name', 'sort', 'notes']),
            'price' => (float) $this->price,
            'cost' => (float) $this->cost,
            'active' => $this->active,
        ];
    }

    /**
     * Price and cost per piece keyed by "group|name", for every option (inactive ones too, so old orders keep their rates).
     *
     * @return Collection<string, array{price: float, cost: float}>
     */
    public static function rates(): Collection
    {
        return self::all(['group', 'name', 'price', 'cost'])
            ->mapWithKeys(fn (self $option) => ["{$option->group}|{$option->name}" => ['price' => (float) $option->price, 'cost' => (float) $option->cost]]);
    }

    /**
     * Total surcharge (price or cost) per piece for the specs chosen on an order item.
     *
     * @param  Collection<string, array{price: float, cost: float}>  $rates
     * @param  array<string, mixed>  $item
     */
    public static function surcharge(Collection $rates, array $item, string $column): float
    {
        return collect(array_keys(self::GROUPS))->sum(fn ($group) => $rates["{$group}|".($item[$group] ?? '')][$column] ?? 0);
    }
}
