<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        Schema::create('materials', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->string('category')->default('Kain');
            $table->unsignedInteger('gsm')->nullable();
            $table->string('unit')->default('kg');
            $table->decimal('cost_per_unit', 10, 2)->default(0);
            $table->string('supplier')->nullable();
            $table->decimal('stock_qty', 10, 2)->nullable();
            $table->decimal('reorder_level', 10, 2)->nullable();
            $table->text('description')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('pricelist_items', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('product');
            $table->string('material_code')->nullable();
            $table->string('sleeve')->nullable();
            $table->string('collar')->nullable();
            $table->unsignedInteger('min_qty')->default(1);
            $table->unsignedInteger('max_qty')->nullable();
            $table->decimal('price', 10, 2);
            $table->decimal('cost', 10, 2)->default(0);
            $table->boolean('active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('add_ons', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->string('charge_type')->default('per helai');
            $table->decimal('price', 10, 2)->default(0);
            $table->decimal('cost', 10, 2)->default(0);
            $table->boolean('active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('agents', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('area')->nullable();
            $table->string('commission_type')->default('percent');
            $table->decimal('commission_value', 10, 2)->default(0);
            $table->string('bank_account')->nullable();
            $table->boolean('active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->unsignedBigInteger('agent_id')->nullable()->index()->after('sales_user_id');
            $table->decimal('commission_amount', 12, 2)->default(0)->after('deposit_required');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->string('pricelist_code')->nullable()->after('order_id');
            $table->json('addons')->nullable()->after('sizes');
            $table->decimal('unit_cost', 10, 2)->default(0)->after('unit_price');
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn(['pricelist_code', 'addons', 'unit_cost']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['agent_id']);
            $table->dropColumn(['agent_id', 'commission_amount']);
        });

        Schema::dropIfExists('agents');
        Schema::dropIfExists('add_ons');
        Schema::dropIfExists('pricelist_items');
        Schema::dropIfExists('materials');
        Schema::dropIfExists('settings');
    }
};
