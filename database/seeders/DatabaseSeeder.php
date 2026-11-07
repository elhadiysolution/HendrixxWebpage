<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::firstOrCreate(['email' => 'admin@hendrixx.my'], [
            'name' => 'Admin Hendrixx',
            'role' => 'admin',
            'password' => 'password',
            'email_verified_at' => now(),
        ]);

        $this->call(CatalogSeeder::class);
        $this->call(DemoSeeder::class);
    }
}
