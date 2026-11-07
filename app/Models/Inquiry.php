<?php

namespace App\Models;

use App\Models\Concerns\SyncsToSheet;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Inquiry extends Model
{
    use SyncsToSheet;

    public const STATUSES = ['new' => 'Baru', 'contacted' => 'Dihubungi', 'converted' => 'Jadi Order', 'lost' => 'Tidak Jadi'];

    protected $fillable = ['name', 'phone', 'email', 'organization', 'product', 'quantity', 'required_by', 'message', 'status'];

    protected function casts(): array
    {
        return [
            'required_by' => 'date',
            'quantity' => 'integer',
        ];
    }

    public static function sheetName(): string
    {
        return 'Inquiries';
    }

    public function toSheetRow(): array
    {
        return [
            ...$this->only(['id', 'name', 'phone', 'email', 'organization', 'product', 'quantity', 'message', 'status']),
            'required_by' => $this->required_by?->toDateString(),
            'order_id' => $this->order()->value('id'),
            'created_at' => $this->created_at?->format('Y-m-d H:i:s'),
        ];
    }

    public function order(): HasOne
    {
        return $this->hasOne(Order::class);
    }
}
