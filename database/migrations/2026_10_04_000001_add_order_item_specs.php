<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->string('state')->nullable()->after('organization');
        });

        Schema::create('product_options', function (Blueprint $table) {
            $table->id();
            $table->string('group')->index();
            $table->string('name');
            $table->unsignedInteger('sort')->default(0);
            $table->boolean('active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->string('garment_type')->nullable()->after('description');
            $table->string('print_method')->nullable()->after('garment_type');
            $table->string('neck_type')->nullable()->after('fabric');
            $table->string('neck_finish')->nullable()->after('neck_type');
            $table->boolean('test_print')->default(false)->after('neck_finish');
            $table->json('names')->nullable()->after('sizes');
        });

        $now = now();
        $defaults = [
            'garment_type' => ['Round Neck Short Sleeve', 'Long Sleeve', 'Muslimah', 'Polo Collar', 'Raglan', 'Singlet'],
            'print_method' => ['Sublimation', 'Silkscreen', 'Heatpress'],
            'neck_type' => ['Round Neck', 'V Neck', 'Polo Collar', 'Mandarin Collar', 'Hoodie'],
            'neck_finish' => ['Sublimation', 'Readymade'],
        ];

        foreach ($defaults as $group => $names) {
            foreach ($names as $sort => $name) {
                DB::table('product_options')->insert([
                    'group' => $group, 'name' => $name, 'sort' => $sort + 1, 'active' => true, 'created_at' => $now, 'updated_at' => $now,
                ]);
            }
        }

        foreach ([['ADD-NAMESET', 'Nameset'], ['ADD-BACKTAPE', 'Backtape']] as [$code, $name]) {
            DB::table('add_ons')->insertOrIgnore([
                'code' => $code, 'name' => $name, 'charge_type' => 'per helai', 'price' => 0, 'cost' => 0, 'active' => true, 'created_at' => $now, 'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        DB::table('add_ons')->whereIn('code', ['ADD-NAMESET', 'ADD-BACKTAPE'])->delete();

        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn(['garment_type', 'print_method', 'neck_type', 'neck_finish', 'test_print', 'names']);
        });

        Schema::dropIfExists('product_options');

        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('state');
        });
    }
};
