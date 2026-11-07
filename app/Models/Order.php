<?php

namespace App\Models;

use App\Enums\OrderStage;
use App\Models\Concerns\SyncsToSheet;
use App\Support\WorkingDays;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class Order extends Model
{
    use SyncsToSheet;

    protected $fillable = [
        'customer_id',
        'sales_user_id',
        'agent_id',
        'campaign_id',
        'inquiry_id',
        'title',
        'required_by',
        'discount',
        'shipping_fee',
        'deposit_required',
        'notes',
        'jobsheet_notes',
        'supplier_ref',
        'shipping_method',
        'courier',
        'tracking_no',
        'feedback_rating',
        'feedback_comment',
    ];

    protected function casts(): array
    {
        return [
            'stage' => OrderStage::class,
            'stage_entered_at' => 'datetime',
            'required_by' => 'date',
            'due_date' => 'date',
            'subtotal' => 'decimal:2',
            'discount' => 'decimal:2',
            'shipping_fee' => 'decimal:2',
            'total' => 'decimal:2',
            'deposit_required' => 'decimal:2',
            'commission_amount' => 'decimal:2',
            'invoice_sent_at' => 'datetime',
            'confirmed_at' => 'datetime',
            'design_approved_at' => 'datetime',
            'jobsheet_submitted_at' => 'datetime',
            'production_received_at' => 'datetime',
            'shipped_at' => 'datetime',
            'postage_cost' => 'decimal:2',
            'tracking_sent_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Order $order) {
            $order->order_no ??= self::nextOrderNo();
            $order->public_token ??= Str::random(32);
            $order->stage ??= OrderStage::Order;
            $order->stage_entered_at ??= now();
        });
    }

    public static function nextOrderNo(): string
    {
        $prefix = 'HX'.now()->format('ym').'-';
        $last = self::where('order_no', 'like', $prefix.'%')->orderByDesc('order_no')->value('order_no');
        $sequence = $last ? ((int) Str::afterLast($last, '-')) + 1 : 1;

        return $prefix.str_pad((string) $sequence, 3, '0', STR_PAD_LEFT);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function sales(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sales_user_id');
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(Agent::class);
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class)->orderBy('paid_on');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(OrderAttachment::class)->latest();
    }

    public function activities(): HasMany
    {
        return $this->hasMany(OrderActivity::class)->latest('id');
    }

    public function scopeActive(Builder $query): void
    {
        $query->whereNull('cancelled_at')->where('stage', '!=', OrderStage::Completed);
    }

    public function scopeNotCancelled(Builder $query): void
    {
        $query->whereNull('cancelled_at');
    }

    /** When a cancelled order is deleted for good. */
    public function purgeAt(): ?CarbonImmutable
    {
        return $this->cancelled_at
            ? CarbonImmutable::parse($this->cancelled_at)->addDays((int) config('hendrixx.cancelled_retention_days'))
            : null;
    }

    /**
     * Delete the order with everything attached. Children are deleted one by one so their
     * files are removed and the Google Sheet mirror drops their rows too.
     */
    public function purge(): void
    {
        $this->attachments()->get()->each->delete();
        $this->payments()->get()->each(function (Payment $payment) {
            if ($payment->proof_path) {
                Storage::disk('public')->delete($payment->proof_path);
            }
            $payment->delete();
        });
        $this->items()->get()->each->delete();
        $this->activities()->get()->each->delete();
        $this->delete();
    }

    /**
     * Permanently delete orders cancelled longer than the retention period.
     *
     * @return int orders deleted
     */
    public static function purgeExpiredCancelled(): int
    {
        $cutoff = now()->subDays((int) config('hendrixx.cancelled_retention_days'));
        $orders = self::whereNotNull('cancelled_at')->where('cancelled_at', '<=', $cutoff)->get();

        $orders->each(fn (Order $order) => DB::transaction(fn () => $order->purge()));

        return $orders->count();
    }

    public function invoiceNo(): string
    {
        return 'INV-'.$this->order_no;
    }

    /** Garment pieces (service lines such as rush order are excluded). */
    public function quantity(): int
    {
        return (int) $this->items->reject->isServiceLine()->sum('quantity');
    }

    public function amountPaid(): float
    {
        if (array_key_exists('payments_sum_amount', $this->attributes)) {
            return round((float) $this->attributes['payments_sum_amount'], 2);
        }

        return round((float) ($this->relationLoaded('payments') ? $this->payments->sum('amount') : $this->payments()->sum('amount')), 2);
    }

    public function balance(): float
    {
        return round((float) $this->total - $this->amountPaid(), 2);
    }

    public function recalculateTotals(): void
    {
        $this->load(['items', 'agent']);
        $this->subtotal = $this->items->sum(fn (OrderItem $item) => $item->quantity * (float) $item->unit_price);
        $this->total = max(0, (float) $this->subtotal - (float) $this->discount + (float) $this->shipping_fee);
        $this->commission_amount = $this->agent?->commissionFor((float) $this->total, $this->quantity()) ?? 0;
        $this->save();
    }

    /**
     * Rebuild the "Caj saiz besar" lines from the size breakdown (rates in Tetapan), one line
     * per rate, then recalculate totals.
     */
    public function syncSizeSurcharges(): void
    {
        $this->items()->where('kind', OrderItem::KIND_SIZE_SURCHARGE)->delete();
        $this->load('items');

        $rates = array_filter(array_map('floatval', (array) config('hendrixx.size_surcharges', [])));
        $counts = [];

        foreach ($this->items->reject->isServiceLine() as $item) {
            foreach ($item->sizes ?? [] as $size => $qty) {
                $counts[$size] = ($counts[$size] ?? 0) + (int) $qty;
            }
        }

        $groups = collect(config('hendrixx.sizes'))
            ->filter(fn ($size) => ($rates[$size] ?? 0) > 0 && ($counts[$size] ?? 0) > 0)
            ->groupBy(fn ($size) => (string) $rates[$size])
            ->sortKeys(SORT_NUMERIC);

        foreach ($groups as $rate => $sizes) {
            $this->items()->create([
                'kind' => OrderItem::KIND_SIZE_SURCHARGE,
                'description' => 'Caj saiz besar ('.$sizes->implode(', ').')',
                'quantity' => $sizes->sum(fn ($size) => $counts[$size]),
                'unit_price' => (float) $rate,
                'unit_cost' => 0,
            ]);
        }

        $this->recalculateTotals();
    }

    /**
     * Log a changed total once the customer already has the invoice.
     *
     * @return bool whether the invoice needs to be resent
     */
    public function noteInvoiceChange(float $previousTotal, ?User $user): bool
    {
        if ($this->invoice_sent_at === null || round($previousTotal, 2) === round((float) $this->total, 2)) {
            return false;
        }

        $this->log('invoice', 'Jumlah invoice berubah RM '.number_format($previousTotal, 2).' → RM '.number_format((float) $this->total, 2)
            .' selepas dihantar. Hantar semula invoice kepada customer.', $user);

        return true;
    }

    /** Estimated production cost from the pricelist / add-on costs captured on each item. */
    public function cost(): float
    {
        return round($this->items->sum(fn (OrderItem $item) => $item->quantity * (float) $item->unit_cost), 2);
    }

    /**
     * Postage actually paid, keyed in at the Postage stage. Until then the postage charged to the
     * customer is used as the estimate, so postage does not inflate the profit.
     */
    public function postageCost(): float
    {
        return round((float) ($this->postage_cost ?? $this->shipping_fee), 2);
    }

    public function postageEstimated(): bool
    {
        return $this->postage_cost === null;
    }

    /** Net order profit: invoice total (incl. postage charged) - production cost - agent commission - actual postage. */
    public function profit(): float
    {
        return round((float) $this->total - $this->cost() - (float) $this->commission_amount - $this->postageCost(), 2);
    }

    public function profitPerPiece(): ?float
    {
        $pieces = $this->quantity();

        return $pieces > 0 ? round($this->profit() / $pieces, 2) : null;
    }

    public function postageEntry(): HasOne
    {
        return $this->hasOne(CashEntry::class)->where('source', CashEntry::SOURCE_ORDER_POSTAGE);
    }

    public static function sheetName(): string
    {
        return 'Orders';
    }

    public function toSheetRow(): array
    {
        $dateTime = fn ($value) => $value?->format('Y-m-d H:i:s');

        return [
            ...$this->only([
                'id', 'order_no', 'customer_id', 'agent_id', 'title', 'supplier_ref', 'shipping_method', 'courier', 'tracking_no',
                'feedback_rating', 'feedback_comment', 'notes', 'jobsheet_notes', 'public_token',
            ]),
            'sales_user' => $this->sales?->name,
            'stage' => $this->stage->value,
            'stage_entered_at' => $dateTime($this->stage_entered_at),
            'required_by' => $this->required_by?->toDateString(),
            'subtotal' => (float) $this->subtotal,
            'discount' => (float) $this->discount,
            'shipping_fee' => (float) $this->shipping_fee,
            'total' => (float) $this->total,
            'deposit_required' => (float) $this->deposit_required,
            'commission_amount' => (float) $this->commission_amount,
            'invoice_sent_at' => $dateTime($this->invoice_sent_at),
            'confirmed_at' => $dateTime($this->confirmed_at),
            'design_approved_at' => $dateTime($this->design_approved_at),
            'jobsheet_submitted_at' => $dateTime($this->jobsheet_submitted_at),
            'due_date' => $this->due_date?->toDateString(),
            'production_received_at' => $dateTime($this->production_received_at),
            'shipped_at' => $dateTime($this->shipped_at),
            'postage_cost' => $this->postage_cost === null ? null : (float) $this->postage_cost,
            'tracking_sent_at' => $dateTime($this->tracking_sent_at),
            'completed_at' => $dateTime($this->completed_at),
            'cancelled_at' => $dateTime($this->cancelled_at),
            'created_at' => $dateTime($this->created_at),
            'updated_at' => $dateTime($this->updated_at),
        ];
    }

    public function sizesComplete(): bool
    {
        $garments = $this->items->reject->isServiceLine();

        return $garments->isNotEmpty()
            && $garments->every(fn (OrderItem $item) => $item->sizesTotal() === $item->quantity);
    }

    public function hasFinalDesign(): bool
    {
        return $this->relationLoaded('attachments')
            ? $this->attachments->contains('kind', OrderAttachment::KIND_DESIGN_FINAL)
            : $this->attachments()->where('kind', OrderAttachment::KIND_DESIGN_FINAL)->exists();
    }

    /**
     * Requirements that must be complete before the order can leave its current stage.
     *
     * @return list<array{key: string, label: string, done: bool}>
     */
    public function checklist(): array
    {
        $this->loadMissing('items');
        $money = fn (float $value) => 'RM '.number_format($value, 2);

        return match ($this->stage) {
            OrderStage::Order => [
                ['key' => 'items', 'label' => 'Detail helaian & harga diisi', 'done' => $this->items->isNotEmpty() && (float) $this->total > 0],
                ['key' => 'invoice', 'label' => 'Invoice dihantar ke customer', 'done' => $this->invoice_sent_at !== null],
                ['key' => 'deposit', 'label' => 'Deposit diterima ('.$money($this->amountPaid()).' / '.$money((float) $this->deposit_required).')', 'done' => $this->amountPaid() >= (float) $this->deposit_required],
            ],
            OrderStage::Design => [
                ['key' => 'design_final', 'label' => 'Design final dimuat naik', 'done' => $this->hasFinalDesign()],
                ['key' => 'design_approved', 'label' => 'Design disahkan oleh customer', 'done' => $this->design_approved_at !== null],
            ],
            OrderStage::Jobsheet => [
                ['key' => 'sizes', 'label' => 'Senarai nama / nombor / saiz lengkap (jumlah = helaian)', 'done' => $this->sizesComplete()],
                ['key' => 'jobsheet', 'label' => 'Jobsheet dihantar ke sistem kilang', 'done' => $this->jobsheet_submitted_at !== null],
            ],
            OrderStage::Production => [
                ['key' => 'received', 'label' => 'Baju diterima dari kilang & QC', 'done' => $this->production_received_at !== null],
            ],
            OrderStage::Postage => [
                ['key' => 'balance', 'label' => 'Baki bayaran dijelaskan ('.$money(max(0, $this->balance())).' lagi)', 'done' => $this->balance() <= 0],
                ['key' => 'shipped', 'label' => 'Baju dipos / diambil & kos pos sebenar direkod'
                    .($this->postage_cost !== null ? ' ('.$money((float) $this->postage_cost).')' : ''), 'done' => $this->shipped_at !== null && $this->postage_cost !== null],
                ['key' => 'tracking_sent', 'label' => $this->shipping_method === 'pickup'
                    ? 'Customer dimaklumkan baju sedia diambil'
                    : 'No. tracking dihantar ke customer', 'done' => $this->tracking_sent_at !== null],
            ],
            OrderStage::Completed => [],
        };
    }

    public function canAdvance(): bool
    {
        return $this->cancelled_at === null
            && $this->stage->next() !== null
            && collect($this->checklist())->every('done');
    }

    public function advance(?User $user): void
    {
        if ($this->cancelled_at !== null) {
            throw ValidationException::withMessages(['stage' => 'Order ini telah dibatalkan.']);
        }

        $pending = collect($this->checklist())->reject->done->pluck('label');

        if ($pending->isNotEmpty() || $this->stage->next() === null) {
            throw ValidationException::withMessages([
                'stage' => 'Belum boleh proceed. Lengkapkan dahulu: '.$pending->implode(', '),
            ]);
        }

        $from = $this->stage;
        $this->stage = $from->next();
        $this->stage_entered_at = now();

        if ($from === OrderStage::Order) {
            $this->confirmed_at = now();
        }

        if ($this->stage === OrderStage::Completed) {
            $this->completed_at = now();
        }

        $this->save();
        $this->log('stage', "Proceed: {$from->label()} → {$this->stage->label()}", $user);
    }

    public function revert(?User $user): void
    {
        $previous = $this->stage->previous();

        if ($previous === null) {
            throw ValidationException::withMessages(['stage' => 'Order sudah di peringkat pertama.']);
        }

        $from = $this->stage;
        $this->stage = $previous;
        $this->stage_entered_at = now();

        if ($from === OrderStage::Completed) {
            $this->completed_at = null;
        }

        $this->save();
        $this->log('stage', "Undur: {$from->label()} → {$previous->label()}", $user);
    }

    public function log(string $type, string $message, ?User $user = null): void
    {
        $this->activities()->create(['type' => $type, 'message' => $message, 'user_id' => $user?->id]);
    }

    public function daysInStage(): int
    {
        return max(0, WorkingDays::between($this->stage_entered_at ?? $this->created_at, now()));
    }

    public function isLate(): bool
    {
        if ($this->cancelled_at || $this->stage === OrderStage::Completed) {
            return false;
        }

        if ($this->stage === OrderStage::Production && $this->due_date) {
            return $this->production_received_at === null && now()->startOfDay()->greaterThan($this->due_date);
        }

        return $this->daysInStage() > $this->stage->targetDays();
    }

    /**
     * Estimated date the order leaves for the customer, based on stage targets.
     */
    public function projectedShipDate(): ?CarbonImmutable
    {
        if ($this->shipped_at) {
            return CarbonImmutable::parse($this->shipped_at);
        }

        if ($this->cancelled_at || $this->stage === OrderStage::Completed) {
            return null;
        }

        $postage = OrderStage::Postage->targetDays();

        if ($this->stage === OrderStage::Production && $this->due_date) {
            $start = CarbonImmutable::parse($this->due_date)->max(now()->startOfDay());

            return WorkingDays::add($start, $postage);
        }

        $remaining = max(0, $this->stage->targetDays() - $this->daysInStage());

        for ($stage = $this->stage->next(); $stage && $stage !== OrderStage::Completed; $stage = $stage->next()) {
            $remaining += $stage->targetDays();
        }

        return WorkingDays::add(now(), $remaining);
    }

    public function isAtRisk(): bool
    {
        $projected = $this->projectedShipDate();

        return $this->required_by !== null
            && $this->shipped_at === null
            && $projected !== null
            && $projected->greaterThan($this->required_by);
    }

    /**
     * Compact representation used by the board, lists and dashboard.
     *
     * @return array<string, mixed>
     */
    public function summary(): array
    {
        return [
            'id' => $this->id,
            'order_no' => $this->order_no,
            'title' => $this->title,
            'customer' => $this->customer?->name,
            'organization' => $this->customer?->organization,
            'agent' => $this->agent?->name,
            'stage' => $this->stage->value,
            'stage_label' => $this->stage->label(),
            'quantity' => $this->quantity(),
            'total' => (float) $this->total,
            'paid' => $this->amountPaid(),
            'days_in_stage' => $this->daysInStage(),
            'target_days' => $this->stage->targetDays(),
            'is_late' => $this->isLate(),
            'is_at_risk' => $this->isAtRisk(),
            'due_date' => $this->due_date?->toDateString(),
            'required_by' => $this->required_by?->toDateString(),
            'projected_ship_date' => $this->projectedShipDate()?->toDateString(),
            'cancelled' => $this->cancelled_at !== null,
            'purge_at' => $this->purgeAt()?->toDateString(),
            'created_at' => $this->created_at?->toDateString(),
        ];
    }
}
