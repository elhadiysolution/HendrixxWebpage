<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // Actual postage paid, keyed in when the order is posted. Null until then.
            $table->decimal('postage_cost', 10, 2)->nullable()->after('shipping_method');
            $table->timestamp('tracking_sent_at')->nullable()->after('shipped_at');
        });

        Schema::table('cash_entries', function (Blueprint $table) {
            // Set when the entry is created by the system (e.g. "order_postage"), so it is edited at its source.
            $table->string('source')->nullable()->after('payslip_id');
        });
    }

    public function down(): void
    {
        Schema::table('cash_entries', function (Blueprint $table) {
            $table->dropColumn('source');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['postage_cost', 'tracking_sent_at']);
        });
    }
};
