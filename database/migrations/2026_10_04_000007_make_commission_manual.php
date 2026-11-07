<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Commission is now an amount finance keys in each month (based on performance), not a % of sales,
 * and it replaces the separate bonus.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('team_members', function (Blueprint $table) {
            $table->dropColumn('commission_percent');
        });

        Schema::table('payslips', function (Blueprint $table) {
            $table->dropColumn('bonus');
        });
    }

    public function down(): void
    {
        Schema::table('team_members', function (Blueprint $table) {
            $table->decimal('commission_percent', 5, 2)->default(0);
        });

        Schema::table('payslips', function (Blueprint $table) {
            $table->decimal('bonus', 10, 2)->default(0);
        });
    }
};
