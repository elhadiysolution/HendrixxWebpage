<?php

namespace App\Models;

use App\Models\Concerns\SyncsToSheet;
use Illuminate\Database\Eloquent\Model;

class Material extends Model
{
    use SyncsToSheet;

    public const CATEGORIES = ['Kain', 'Lycra', 'Collar / Rib', 'Aksesori', 'Packaging', 'Ink / Paper'];

    public const UNITS = ['meter', 'kg', 'roll', 'helai', 'pcs'];

    protected $fillable = ['code', 'name', 'category', 'gsm', 'unit', 'cost_per_unit', 'supplier', 'stock_qty', 'reorder_level', 'description', 'active'];

    protected function casts(): array
    {
        return [
            'gsm' => 'integer',
            'cost_per_unit' => 'decimal:2',
            'stock_qty' => 'decimal:2',
            'reorder_level' => 'decimal:2',
            'active' => 'boolean',
        ];
    }

    /**
     * Active fabric names for order forms and the sales page (falls back to config).
     *
     * @return list<string>
     */
    public static function fabricNames(): array
    {
        $names = self::where('active', true)->whereIn('category', ['Kain', 'Lycra'])->orderBy('name')->pluck('name')->all();

        return $names ?: config('hendrixx.fabrics');
    }

    public static function sheetName(): string
    {
        return 'Materials';
    }

    public function toSheetRow(): array
    {
        return [
            ...$this->only(['id', 'code', 'name', 'category', 'gsm', 'unit', 'supplier', 'description']),
            'cost_per_unit' => (float) $this->cost_per_unit,
            'stock_qty' => $this->stock_qty === null ? null : (float) $this->stock_qty,
            'reorder_level' => $this->reorder_level === null ? null : (float) $this->reorder_level,
            'active' => $this->active,
            'updated_at' => $this->updated_at?->format('Y-m-d H:i:s'),
        ];
    }
}
