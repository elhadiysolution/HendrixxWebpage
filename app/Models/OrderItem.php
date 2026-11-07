<?php

namespace App\Models;

use App\Models\Concerns\SyncsToSheet;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItem extends Model
{
    use SyncsToSheet;

    /** Auto-generated "Caj saiz besar" line (see Order::syncSizeSurcharges). */
    public const KIND_SIZE_SURCHARGE = 'size_surcharge';

    protected $fillable = [
        'kind', 'pricelist_code', 'description', 'garment_type', 'print_method', 'fabric', 'neck_type', 'neck_finish', 'test_print',
        'quantity', 'unit_price', 'unit_cost', 'sizes', 'names', 'addons', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'unit_price' => 'decimal:2',
            'unit_cost' => 'decimal:2',
            'test_print' => 'boolean',
            'sizes' => 'array',
            'names' => 'array',
            'addons' => 'array',
        ];
    }

    /**
     * Name list ordered by size (config order, unknown sizes last), then jersey number.
     *
     * @param  list<array{name?: ?string, number?: ?string, size?: ?string}>  $names
     * @return list<array{name: ?string, number: ?string, size: ?string}>
     */
    public static function sortNames(array $names): array
    {
        $order = array_flip(config('hendrixx.sizes'));

        return collect($names)
            ->map(fn ($row) => [
                'name' => filled($row['name'] ?? null) ? trim($row['name']) : null,
                'number' => filled($row['number'] ?? null) ? trim((string) $row['number']) : null,
                'size' => filled($row['size'] ?? null) ? trim($row['size']) : null,
            ])
            ->reject(fn ($row) => $row['name'] === null && $row['number'] === null && $row['size'] === null)
            ->sortBy([
                fn ($a, $b) => ($order[$a['size']] ?? PHP_INT_MAX) <=> ($order[$b['size']] ?? PHP_INT_MAX),
                fn ($a, $b) => [$a['number'] === null, (int) $a['number'], $a['name']] <=> [$b['number'] === null, (int) $b['number'], $b['name']],
            ])
            ->values()
            ->all();
    }

    /** Spec summary, e.g. "Sublimation · Round Neck (Readymade) · Test print". */
    public function specText(): ?string
    {
        $neck = $this->neck_type && $this->neck_finish ? "{$this->neck_type} ({$this->neck_finish})" : ($this->neck_type ?: $this->neck_finish);

        return collect([$this->garment_type, $this->print_method, $neck, $this->test_print ? 'Test print' : null])->filter()->implode(' · ') ?: null;
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * A line that only charges a per-order add-on (e.g. rush order) — not a garment,
     * so it has no sizes and does not count as pieces.
     */
    public function isServiceLine(): bool
    {
        if ($this->isSizeSurcharge()) {
            return true;
        }

        return $this->pricelist_code === null
            && $this->addons
            && array_intersect($this->addons, AddOn::perOrderCodes()) !== [];
    }

    public function isSizeSurcharge(): bool
    {
        return $this->kind === self::KIND_SIZE_SURCHARGE;
    }

    public function sizesTotal(): int
    {
        return (int) array_sum(array_map('intval', $this->sizes ?? []));
    }

    public function lineTotal(): float
    {
        return round($this->quantity * (float) $this->unit_price, 2);
    }

    /** "S:2, M:5" — the human-friendly format used in the Google Sheet. */
    public function sizesText(): ?string
    {
        $sizes = array_filter($this->sizes ?? []);

        return $sizes ? collect($sizes)->map(fn ($qty, $size) => "{$size}:{$qty}")->implode(', ') : null;
    }

    public static function sheetName(): string
    {
        return 'OrderItems';
    }

    public function toSheetRow(): array
    {
        return [
            ...$this->only(['id', 'order_id', 'pricelist_code', 'description', 'garment_type', 'print_method', 'fabric', 'neck_type', 'neck_finish', 'quantity', 'notes']),
            'test_print' => $this->test_print,
            'unit_price' => (float) $this->unit_price,
            'sizes' => $this->sizesText(),
            'names' => $this->names ? collect($this->names)->map(fn ($row) => implode(' - ', array_filter([$row['number'], $row['name'], $row['size']])))->implode("\n") : null,
            'addons' => $this->addons ? implode(', ', $this->addons) : null,
        ];
    }
}
