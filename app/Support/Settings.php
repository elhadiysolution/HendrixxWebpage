<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Support\Facades\Crypt;
use Throwable;

/**
 * Admin-editable settings. Stored as JSON in the `settings` table and applied on top of
 * config('hendrixx.*'), so the rest of the app keeps reading config() as usual.
 */
class Settings
{
    /** Keys stored encrypted at rest. */
    public const SECRETS = ['sheets.token'];

    public static function get(string $key, mixed $default = null): mixed
    {
        return config("hendrixx.{$key}", $default);
    }

    /**
     * @param  array<string, mixed>  $values  dot-notation keys, e.g. ['company.name' => 'Hendrixx']
     */
    public static function set(array $values): void
    {
        foreach ($values as $key => $value) {
            $stored = in_array($key, self::SECRETS, true) && filled($value) ? Crypt::encryptString($value) : $value;

            Setting::updateOrCreate(['key' => $key], ['value' => json_encode($stored)]);
            config(["hendrixx.{$key}" => $value]);
        }
    }

    public static function applyToConfig(): void
    {
        foreach (Setting::all(['key', 'value']) as $setting) {
            $value = json_decode((string) $setting->value, true);

            if (in_array($setting->key, self::SECRETS, true) && is_string($value)) {
                try {
                    $value = Crypt::decryptString($value);
                } catch (Throwable) {
                    $value = null;
                }
            }

            config(["hendrixx.{$setting->key}" => $value]);
        }
    }
}
