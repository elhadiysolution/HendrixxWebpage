<?php

namespace App\Models\Concerns;

use App\Services\GoogleSheets\SheetSync;

/**
 * Mirrors every save/delete of the model to its Google Sheet tab.
 * Changes are buffered and sent in one batch after the response is sent.
 */
trait SyncsToSheet
{
    public static function bootSyncsToSheet(): void
    {
        static::saved(fn ($model) => app(SheetSync::class)->queue($model));
        static::deleted(fn ($model) => app(SheetSync::class)->queue($model, deleted: true));
    }

    /** Tab name in the Google Sheet. */
    abstract public static function sheetName(): string;

    /**
     * Row for the Google Sheet, keyed by the tab's header keys.
     *
     * @return array<string, mixed>
     */
    abstract public function toSheetRow(): array;
}
