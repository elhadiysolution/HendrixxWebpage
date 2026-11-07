<?php

namespace App\Models;

use App\Models\Concerns\SyncsToSheet;
use Illuminate\Database\Eloquent\Model;

class AddOn extends Model
{
    use SyncsToSheet;

    public const CHARGE_TYPES = ['per helai', 'per order'];

    protected $fillable = ['code', 'name', 'charge_type', 'price', 'cost', 'active', 'notes'];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'cost' => 'decimal:2',
            'active' => 'boolean',
        ];
    }

    /**
     * @return list<string>
     */
    public static function perOrderCodes(): array
    {
        return once(fn () => self::where('charge_type', 'per order')->pluck('code')->all());
    }

    public static function sheetName(): string
    {
        return 'AddOns';
    }

    public function toSheetRow(): array
    {
        return [
            ...$this->only(['id', 'code', 'name', 'charge_type', 'notes']),
            'price' => (float) $this->price,
            'cost' => (float) $this->cost,
            'active' => $this->active,
        ];
    }
}
