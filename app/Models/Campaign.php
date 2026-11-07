<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A sales target. "period" counts every order in the date range; "project" and "campaign"
 * only count orders linked to it (picked in the order form).
 */
class Campaign extends Model
{
    public const TYPES = [
        'period' => 'Target tempoh (semua jualan)',
        'project' => 'Projek',
        'campaign' => 'Kempen',
    ];

    protected $fillable = ['name', 'type', 'start_date', 'end_date', 'target_sales', 'target_orders', 'target_pieces', 'budget', 'notes'];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'target_sales' => 'decimal:2',
            'budget' => 'decimal:2',
        ];
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function cashEntries(): HasMany
    {
        return $this->hasMany(CashEntry::class);
    }

    /** Projects and campaigns that orders can still be linked to. */
    public function scopeLinkable(Builder $query): void
    {
        $query->where('type', '!=', 'period')->whereDate('end_date', '>=', now()->subDays(30)->toDateString());
    }

    public function countsAllOrders(): bool
    {
        return $this->type === 'period';
    }

    /** Orders counted towards the target. */
    public function countedOrders(): Builder
    {
        return $this->countsAllOrders()
            ? Order::notCancelled()->whereBetween('created_at', [$this->start_date->startOfDay(), $this->end_date->endOfDay()])
            : Order::notCancelled()->where('campaign_id', $this->id);
    }
}
