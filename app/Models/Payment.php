<?php

namespace App\Models;

use App\Models\Concerns\SyncsToSheet;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class Payment extends Model
{
    use SyncsToSheet;

    public const TYPES = ['deposit' => 'Deposit', 'balance' => 'Baki', 'full' => 'Bayaran Penuh'];

    public const METHODS = ['transfer' => 'Online Transfer', 'cash' => 'Tunai', 'duitnow' => 'DuitNow QR', 'cheque' => 'Cek'];

    protected $fillable = ['user_id', 'type', 'amount', 'method', 'reference', 'paid_on', 'proof_path'];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'paid_on' => 'date',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public static function sheetName(): string
    {
        return 'Payments';
    }

    public function toSheetRow(): array
    {
        return [
            ...$this->only(['id', 'order_id', 'type', 'method', 'reference']),
            'amount' => (float) $this->amount,
            'paid_on' => $this->paid_on?->toDateString(),
            'proof_url' => $this->proof_path ? Storage::disk('public')->url($this->proof_path) : null,
            'recorded_by' => $this->user?->name,
            'created_at' => $this->created_at?->format('Y-m-d H:i:s'),
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
