<?php

namespace App\Providers;

use App\Models\User;
use App\Services\GoogleSheets\SheetSync;
use App\Support\Settings;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(SheetSync::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::define('admin', fn (User $user) => $user->isAdmin());

        // Admin-edited settings override config/hendrixx.php (table may not exist before migrating).
        rescue(fn () => Settings::applyToConfig(), report: false);

        // Send buffered Google Sheet changes after the response has been sent to the browser.
        $this->app->terminating(fn () => $this->app->make(SheetSync::class)->flush());
    }
}
