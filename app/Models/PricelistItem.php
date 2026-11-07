<?php

namespace App\Models;

use App\Models\Concerns\SyncsToSheet;
use Illuminate\Database\Eloquent\Model;

/**
 * One price tier: a product line (product + material + sleeve + collar) for a quantity range.
 */
class PricelistItem extends Model
{
    use SyncsToSheet;

    public const PRODUCTS = ['Jersey', 'Jersey Esports', 'Corporate Polo', 'Baju Larian / Event', 'Seluar / Short', 'Jaket'];

    public const SLEEVES = ['Pendek', 'Panjang', 'Tanpa lengan', 'Raglan'];

    public const COLLARS = ['Round Neck', 'V Neck', 'Polo Collar', 'Mandarin', 'Hoodie'];

    protected $fillable = ['code', 'product', 'material_code', 'sleeve', 'collar', 'min_qty', 'max_qty', 'price', 'cost', 'active', 'notes'];

    protected function casts(): array
    {
        return [
            'min_qty' => 'integer',
            'max_qty' => 'integer',
            'price' => 'decimal:2',
            'cost' => 'decimal:2',
            'active' => 'boolean',
        ];
    }

    /**
     * The tier of this product line that applies to the given quantity (falls back to this tier).
     */
    public function tierFor(int $quantity): self
    {
        $quantity = max(1, $quantity);

        return self::where('active', true)
            ->where('product', $this->product)
            ->where('material_code', $this->material_code)
            ->where('sleeve', $this->sleeve)
            ->where('collar', $this->collar)
            ->where('min_qty', '<=', $quantity)
            ->where(fn ($query) => $query->whereNull('max_qty')->orWhere('max_qty', '>=', $quantity))
            ->orderByDesc('min_qty')
            ->first() ?? $this;
    }

    public static function sheetName(): string
    {
        return 'Pricelist';
    }

    public function toSheetRow(): array
    {
        return [
            ...$this->only(['id', 'code', 'product', 'material_code', 'sleeve', 'collar', 'min_qty', 'max_qty', 'notes']),
            'price' => (float) $this->price,
            'cost' => (float) $this->cost,
            'active' => $this->active,
        ];
    }
}
