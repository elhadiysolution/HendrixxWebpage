<?php

namespace App\Models;

use App\Models\Concerns\SyncsToSheet;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderActivity extends Model
{
    use SyncsToSheet;

    protected $fillable = ['user_id', 'type', 'message'];

    public static function sheetName(): string
    {
        return 'Activities';
    }

    public function toSheetRow(): array
    {
        return [
            ...$this->only(['id', 'order_id', 'type', 'message']),
            'user' => $this->user?->name,
            'created_at' => $this->created_at?->format('Y-m-d H:i:s'),
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
