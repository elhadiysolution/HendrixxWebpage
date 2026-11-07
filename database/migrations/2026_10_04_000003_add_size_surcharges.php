<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->string('kind')->nullable()->after('order_id');
        });

        // Admins who already saved a custom size list in Tetapan also get 6XL–8XL.
        $saved = DB::table('settings')->where('key', 'sizes')->value('value');
        if ($saved !== null) {
            $sizes = json_decode($saved, true) ?: [];
            foreach (['6XL', '7XL', '8XL'] as $size) {
                if (! in_array($size, $sizes, true)) {
                    $sizes[] = $size;
                }
            }
            DB::table('settings')->where('key', 'sizes')->update(['value' => json_encode($sizes)]);
        }

        // Replaced by the automatic size surcharge; kept (inactive) so old orders still show its name.
        DB::table('add_ons')->where('code', 'ADD-3XL')->update(['active' => false]);
    }

    public function down(): void
    {
        DB::table('order_items')->where('kind', 'size_surcharge')->delete();

        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn('kind');
        });
    }
};
