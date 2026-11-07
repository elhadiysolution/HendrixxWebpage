<?php

namespace App\Console\Commands;

use App\Services\GoogleSheets\SheetSync;
use Illuminate\Console\Command;

class SheetsSync extends Command
{
    protected $signature = 'sheets:sync {direction=push : push (website → sheet) or pull (catalog sheet → website)}';

    protected $description = 'Sync the website database with the Google Sheet';

    public function handle(SheetSync $sync): int
    {
        $counts = $this->argument('direction') === 'pull' ? $sync->pullCatalog() : $sync->pushAll();

        $this->table(['Tab', 'Rows'], collect($counts)->map(fn ($rows, $tab) => [$tab, $rows])->values());

        return self::SUCCESS;
    }
}
