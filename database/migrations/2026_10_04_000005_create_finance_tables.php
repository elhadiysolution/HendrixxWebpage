<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Sales targets: a whole period (all orders count) or a project / campaign (only linked orders count).
        Schema::create('campaigns', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('type')->default('campaign');
            $table->date('start_date');
            $table->date('end_date');
            $table->decimal('target_sales', 12, 2)->default(0);
            $table->unsignedInteger('target_orders')->nullable();
            $table->unsignedInteger('target_pieces')->nullable();
            $table->decimal('budget', 12, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('campaign_id')->nullable()->after('agent_id')->constrained()->nullOnDelete();
        });

        Schema::create('team_members', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('position')->nullable();
            $table->decimal('basic_salary', 10, 2)->default(0);
            $table->decimal('allowance', 10, 2)->default(0);
            $table->decimal('commission_percent', 5, 2)->default(0);
            $table->decimal('profit_share_percent', 5, 2)->default(0);
            $table->decimal('epf_employee_percent', 5, 2)->default(0);
            $table->decimal('epf_employer_percent', 5, 2)->default(0);
            $table->string('bank_account')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('payslips', function (Blueprint $table) {
            $table->id();
            $table->foreignId('team_member_id')->constrained()->cascadeOnDelete();
            $table->string('period', 7);
            $table->decimal('basic', 10, 2)->default(0);
            $table->decimal('allowance', 10, 2)->default(0);
            $table->decimal('sales_base', 12, 2)->default(0);
            $table->decimal('commission', 10, 2)->default(0);
            $table->decimal('profit_pool', 12, 2)->default(0);
            $table->decimal('profit_share', 10, 2)->default(0);
            $table->decimal('bonus', 10, 2)->default(0);
            $table->decimal('epf_employee', 10, 2)->default(0);
            $table->decimal('epf_employer', 10, 2)->default(0);
            $table->decimal('other_deduction', 10, 2)->default(0);
            $table->decimal('net_pay', 10, 2)->default(0);
            $table->string('notes')->nullable();
            $table->date('paid_on')->nullable();
            $table->timestamps();
            $table->unique(['team_member_id', 'period']);
        });

        // Manual cash in / cash out. Order payments are read from `payments` and are not copied here.
        Schema::create('cash_entries', function (Blueprint $table) {
            $table->id();
            $table->string('direction', 3);
            $table->string('category')->index();
            $table->decimal('amount', 12, 2);
            $table->date('entry_date')->index();
            $table->string('description');
            $table->string('party')->nullable();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('campaign_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('payslip_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('method')->nullable();
            $table->string('reference')->nullable();
            $table->string('receipt_path')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        // The team, salaries start at RM0 until an admin sets them.
        $ammar = DB::table('users')->where('name', 'like', '%Ammar%')->value('id');
        $now = now();

        DB::table('team_members')->insert([
            ['name' => 'Ammar', 'user_id' => $ammar, 'position' => 'Founder', 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Aiman', 'user_id' => null, 'position' => null, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Munir', 'user_id' => null, 'position' => null, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_entries');
        Schema::dropIfExists('payslips');
        Schema::dropIfExists('team_members');

        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('campaign_id');
        });

        Schema::dropIfExists('campaigns');
    }
};
