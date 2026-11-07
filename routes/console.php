<?php

use App\Models\Order;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('orders:purge-cancelled', function () {
    $count = Order::purgeExpiredCancelled();
    $this->info("{$count} order dibatalkan dipadam kekal.");
})->purpose('Padam kekal order yang dibatalkan melebihi tempoh simpanan');

Schedule::command('orders:purge-cancelled')->hourly();
