<?php

namespace App\Models;

use App\Models\Concerns\SyncsToSheet;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class OrderAttachment extends Model
{
    use SyncsToSheet;

    public const KIND_DESIGN_FINAL = 'design_final';

    public const KINDS = [
        self::KIND_DESIGN_FINAL => 'Design Final',
        'mockup' => 'Mockup / Draft',
        'reference' => 'Rujukan Customer',
        'other' => 'Lain-lain',
    ];

    protected $fillable = ['user_id', 'kind', 'path', 'original_name', 'size'];

    protected static function booted(): void
    {
        static::deleted(fn (OrderAttachment $attachment) => Storage::disk('public')->delete($attachment->path));
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public static function sheetName(): string
    {
        return 'Attachments';
    }

    public function toSheetRow(): array
    {
        return [
            'id' => $this->id,
            'order_id' => $this->order_id,
            'kind' => $this->kind,
            'file_url' => $this->url(),
            'file_name' => $this->original_name,
            'size_bytes' => $this->size,
            'uploaded_by' => User::find($this->user_id)?->name,
            'created_at' => $this->created_at?->format('Y-m-d H:i:s'),
        ];
    }

    public function url(): string
    {
        return Storage::disk('public')->url($this->path);
    }

    public function isImage(): bool
    {
        return in_array(strtolower(pathinfo($this->path, PATHINFO_EXTENSION)), ['jpg', 'jpeg', 'png', 'webp', 'gif'], true);
    }
}
