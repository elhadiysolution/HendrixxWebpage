<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/**
 * Manual cash in / cash out. Order payments live in `payments` and are added by the reports.
 */
class CashEntry extends Model
{
    public const CATEGORIES_IN = [
        'capital' => 'Modal / pelaburan',
        'other_income' => 'Pendapatan lain',
        'refund_in' => 'Refund diterima',
    ];

    public const CATEGORIES_OUT = [
        'kilang' => 'Kilang / supplier',
        'commission' => 'Komisen ejen',
        'postage' => 'Pos / kurier',
        'salary' => 'Gaji & elaun',
        'marketing' => 'Marketing / iklan',
        'equipment' => 'Peralatan & aset',
        'rent_utilities' => 'Sewa & utiliti',
        'software' => 'Langganan & software',
        'refund_out' => 'Refund kepada customer',
        'other_out' => 'Lain-lain',
    ];

    /** Already counted as order cost in gross profit, so left out of operating expenses. */
    public const COST_OF_SALES = ['kilang', 'commission'];

    /** Postage keyed in on the order (Postage stage); already in the order's net profit. */
    public const SOURCE_ORDER_POSTAGE = 'order_postage';

    /** Cash in that is not income (does not add to profit). */
    public const NON_INCOME = ['capital'];

    protected $fillable = [
        'direction', 'category', 'amount', 'entry_date', 'description', 'party',
        'order_id', 'campaign_id', 'payslip_id', 'source', 'method', 'reference', 'receipt_path', 'user_id',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'entry_date' => 'date',
        ];
    }

    public static function categories(): array
    {
        return ['in' => self::CATEGORIES_IN, 'out' => self::CATEGORIES_OUT];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }

    public function payslip(): BelongsTo
    {
        return $this->belongsTo(Payslip::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopeBetweenDates(Builder $query, string $from, string $to): void
    {
        $query->whereBetween('entry_date', [$from, $to]);
    }

    /** Whether the entry is part of operating expenses ("kos tambahan") rather than an order cost. */
    public function isOperatingExpense(): bool
    {
        return $this->direction === 'out'
            && ! in_array($this->category, self::COST_OF_SALES, true)
            && $this->source !== self::SOURCE_ORDER_POSTAGE;
    }

    /** Why the entry cannot be edited on the Cash In / Out page, or null. */
    public function lockReason(): ?string
    {
        return match (true) {
            $this->payslip_id !== null => 'Rekod gaji, ubah di halaman Gaji.',
            $this->source === self::SOURCE_ORDER_POSTAGE => 'Kos pos dari order, ubah di halaman order.',
            default => null,
        };
    }

    public function categoryLabel(): string
    {
        return self::categories()[$this->direction][$this->category] ?? $this->category;
    }

    public function receiptUrl(): ?string
    {
        return $this->receipt_path ? Storage::disk('public')->url($this->receipt_path) : null;
    }
}
