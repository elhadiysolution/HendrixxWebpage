<?php

namespace App\Models;

use App\Models\Concerns\SyncsToSheet;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Agent extends Model
{
    use SyncsToSheet;

    public const COMMISSION_TYPES = ['percent' => 'Peratus (%)', 'per helai' => 'RM per helai'];

    protected $fillable = ['name', 'phone', 'area', 'commission_type', 'commission_value', 'bank_account', 'active', 'notes'];

    protected function casts(): array
    {
        return [
            'commission_value' => 'decimal:2',
            'active' => 'boolean',
        ];
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function commissionFor(float $total, int $pieces): float
    {
        return round($this->commission_type === 'per helai'
            ? $pieces * (float) $this->commission_value
            : $total * (float) $this->commission_value / 100, 2);
    }

    public static function sheetName(): string
    {
        return 'Agents';
    }

    public function toSheetRow(): array
    {
        return [
            ...$this->only(['id', 'name', 'phone', 'area', 'commission_type', 'bank_account', 'notes']),
            'commission_value' => (float) $this->commission_value,
            'active' => $this->active,
            'created_at' => $this->created_at?->format('Y-m-d H:i:s'),
        ];
    }
}
