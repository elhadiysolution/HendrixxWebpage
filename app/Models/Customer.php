<?php

namespace App\Models;

use App\Models\Concerns\SyncsToSheet;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    use SyncsToSheet;

    protected $fillable = ['name', 'phone', 'email', 'organization', 'state', 'address'];

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public static function sheetName(): string
    {
        return 'Customers';
    }

    public function toSheetRow(): array
    {
        return [
            ...$this->only(['id', 'name', 'phone', 'email', 'organization', 'state', 'address']),
            'created_at' => $this->created_at?->format('Y-m-d H:i:s'),
        ];
    }

    /**
     * Phone number in international format for wa.me links (assumes Malaysia).
     */
    public function whatsappNumber(): string
    {
        $digits = preg_replace('/\D+/', '', $this->phone);

        return str_starts_with($digits, '0') ? '6'.$digits : $digits;
    }
}
