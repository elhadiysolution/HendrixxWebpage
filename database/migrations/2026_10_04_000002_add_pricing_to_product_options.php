<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_options', function (Blueprint $table) {
            $table->decimal('price', 10, 2)->default(0)->after('name');
            $table->decimal('cost', 10, 2)->default(0)->after('price');
        });

        DB::table('add_ons')->insertOrIgnore([
            'code' => 'ADD-TESTPRINT', 'name' => 'Test print', 'charge_type' => 'per order', 'price' => 0, 'cost' => 0,
            'active' => true, 'notes' => 'Dicaj sekali bagi setiap item yang minta test print.', 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('add_ons')->where('code', 'ADD-TESTPRINT')->delete();

        Schema::table('product_options', function (Blueprint $table) {
            $table->dropColumn(['price', 'cost']);
        });
    }
};
