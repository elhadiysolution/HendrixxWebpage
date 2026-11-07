<?php

use App\Enums\OrderStage;
use App\Models\Campaign;
use App\Models\CashEntry;
use App\Models\Order;
use App\Models\Payslip;
use App\Models\TeamMember;
use App\Models\User;
use App\Services\Finance\Finance;
use App\Support\FinancePeriod;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Storage::fake('public');
    $this->admin = User::factory()->create(['role' => 'admin']);
    $this->actingAs($this->admin);
});

/** One RM410 order (RM400 items + RM10 postage, no cost) with a RM205 deposit, plus some cash entries. */
function seedMonth(array $order = []): Order
{
    test()->post('/orders', [
        'customer' => ['name' => 'Ali', 'phone' => '0123456789'],
        'title' => 'Jersey Esports',
        'shipping_fee' => 10,
        'items' => [['description' => 'Jersey', 'quantity' => 10, 'unit_price' => 40]],
        ...$order,
    ]);
    $created = Order::latest('id')->first();
    test()->post("/orders/{$created->id}/payments", ['type' => 'deposit', 'amount' => 205, 'paid_on' => today()->toDateString()]);

    $entry = fn (string $direction, string $category, float $amount) => test()->post('/finance/cash', [
        'direction' => $direction, 'category' => $category, 'amount' => $amount, 'entry_date' => today()->toDateString(), 'description' => $category,
    ])->assertSessionHasNoErrors();

    $entry('out', 'kilang', 150);
    $entry('out', 'marketing', 50);
    $entry('in', 'capital', 1000);

    return $created;
}

test('finance pages are for admins only', function () {
    $this->actingAs(User::factory()->create(['role' => 'sales']));

    foreach (['/finance', '/finance/cash', '/finance/payroll', '/finance/targets'] as $url) {
        $this->get($url)->assertForbidden();
    }
});

test('finance pages render', function () {
    seedMonth();

    $this->get('/finance')->assertOk()->assertInertia(fn (Assert $page) => $page->component('finance/report')->has('buckets'));
    $this->get('/finance?period=quarter')->assertOk()->assertInertia(fn (Assert $page) => $page->has('buckets', 3));
    $this->get('/finance?period=year')->assertOk()->assertInertia(fn (Assert $page) => $page->has('buckets', 12));
    $this->get('/finance/cash')->assertOk()->assertInertia(fn (Assert $page) => $page->has('rows', 4));
    $this->get('/finance/payroll')->assertOk();
    $this->get('/finance/targets')->assertOk();
    $this->get('/finance/export')->assertOk()->assertDownload();
});

test('summary separates profit from cash and does not count kilang payments twice', function () {
    seedMonth();
    $period = FinancePeriod::make('month');

    $summary = app(Finance::class)->summary($period->from, $period->to);

    expect($summary['sales'])->toBe(410.0)
        // not posted yet, so postage cost is estimated at the RM10 charged: 410 - 0 cost - 10 postage
        ->and($summary['gross_profit'])->toBe(400.0)
        // kilang is already in order cost, capital is not income: 400 - 50 marketing
        ->and($summary['operating_expenses'])->toBe(50.0)
        ->and($summary['net_profit'])->toBe(350.0)
        ->and($summary['cash_in'])->toBe(1205.0)
        ->and($summary['cash_out'])->toBe(200.0)
        ->and($summary['net_cash'])->toBe(1005.0);
});

test('cash balance starts from the opening balance', function () {
    seedMonth();
    $this->put('/finance/opening-balance', ['opening_balance' => 500])->assertSessionHasNoErrors();

    expect(app(Finance::class)->cashBalance())->toBe(1505.0);
});

test('periods cover the right dates', function () {
    $quarter = FinancePeriod::make('quarter', '2026-Q4');
    $month = FinancePeriod::make('month', '2026-02');

    expect($quarter->from->toDateString())->toBe('2026-10-01')
        ->and($quarter->to->toDateString())->toBe('2026-12-31')
        ->and($quarter->previous())->toBe('2026-Q3')
        ->and($quarter->next())->toBe('2027-Q1')
        ->and($month->to->toDateString())->toBe('2026-02-28')
        ->and(collect($month->buckets())->last()['to']->toDateString())->toBe('2026-02-28');
});

test('payroll adds the commission keyed in, profit share and EPF, and paying records a salary cash out', function () {
    seedMonth();
    $member = TeamMember::create([
        'name' => 'Ammar', 'user_id' => $this->admin->id, 'basic_salary' => 2000,
        'profit_share_percent' => 10, 'epf_employee_percent' => 11, 'epf_employer_percent' => 13,
    ]);
    $period = now()->format('Y-m');

    $this->post("/finance/payroll/{$member->id}/{$period}/pay", ['paid_on' => today()->toDateString(), 'commission' => 20])->assertSessionHasNoErrors();

    $slip = Payslip::firstWhere('team_member_id', $member->id);
    // RM400 sales as sales PIC (postage excluded) is kept for reference; profit share 10% of RM350; EPF rounded up to the ringgit
    expect((float) $slip->sales_base)->toBe(400.0)
        ->and((float) $slip->commission)->toBe(20.0)
        ->and((float) $slip->profit_share)->toBe(35.0)
        ->and((float) $slip->epf_employee)->toBe(227.0)
        ->and((float) $slip->epf_employer)->toBe(268.0)
        ->and((float) $slip->net_pay)->toBe(1828.0)
        ->and((float) $slip->cashEntry->amount)->toBe(2323.0)
        ->and($slip->cashEntry->category)->toBe('salary');

    // A paid payslip is locked, and its cash out can only be changed from the payroll page.
    $this->post("/finance/payroll/{$member->id}/{$period}", ['commission' => 100])->assertSessionHasErrors('payslip');
    $this->delete("/finance/cash/{$slip->cashEntry->id}")->assertForbidden();
    $this->get("/finance/payslips/{$slip->id}")->assertOk()->assertSee('1,828.00');

    $this->post("/finance/payslips/{$slip->id}/unpay");
    expect($slip->fresh()->paid_on)->toBeNull()
        ->and(CashEntry::where('category', 'salary')->exists())->toBeFalse();
});

test('a campaign counts only linked orders, a period target counts all orders', function () {
    $campaign = Campaign::create(['name' => 'Merdeka', 'type' => 'campaign', 'start_date' => today()->subDays(5), 'end_date' => today()->addDays(5), 'target_sales' => 1000]);
    $period = Campaign::create(['name' => 'Bulan ini', 'type' => 'period', 'start_date' => today()->startOfMonth(), 'end_date' => today()->endOfMonth(), 'target_sales' => 5000]);

    seedMonth(['campaign_id' => $campaign->id]);
    seedMonth(['customer' => ['name' => 'Abu', 'phone' => '0199999999']]);

    $finance = app(Finance::class);

    expect($finance->campaignProgress($campaign)['sales'])->toBe(410.0)
        ->and($finance->campaignProgress($campaign)['orders'])->toBe(1)
        ->and($finance->campaignProgress($period)['sales'])->toBe(820.0);
});

test('actual postage replaces the estimate in order profit and is recorded once as cash out', function () {
    $order = seedMonth();
    $order->forceFill(['stage' => OrderStage::Postage])->save();
    $period = FinancePeriod::make('month');
    $finance = app(Finance::class);

    $this->post("/orders/{$order->id}/ship", ['shipping_method' => 'courier', 'postage_cost' => 15])->assertSessionHasNoErrors();

    $order->refresh();
    $summary = $finance->summary($period->from, $period->to);
    // 410 - 0 cost - 15 actual postage = 395, over 10 pieces
    expect($order->profit())->toBe(395.0)
        ->and($order->load('items')->profitPerPiece())->toBe(39.5)
        ->and($summary['net_profit'])->toBe(345.0) // postage is not counted again as kos tambahan
        ->and($summary['cash_out'])->toBe(215.0);

    // Correcting the cost updates the same cash-out record, which cannot be edited from Cash In / Out.
    $this->post("/orders/{$order->id}/ship", ['shipping_method' => 'courier', 'postage_cost' => 12])->assertSessionHasNoErrors();
    $entries = CashEntry::where('source', CashEntry::SOURCE_ORDER_POSTAGE)->get();
    expect($entries)->toHaveCount(1)->and((float) $entries->first()->amount)->toBe(12.0);
    $this->delete("/finance/cash/{$entries->first()->id}")->assertForbidden();

    // Self pickup costs nothing.
    $this->post("/orders/{$order->id}/ship", ['shipping_method' => 'pickup'])->assertSessionHasNoErrors();
    expect((float) $order->fresh()->postage_cost)->toBe(0.0)
        ->and(CashEntry::where('source', CashEntry::SOURCE_ORDER_POSTAGE)->exists())->toBeFalse();
});

test('payroll shows each member pcs and sales as sales PIC, and the report counts pcs', function () {
    seedMonth();
    TeamMember::query()->delete();
    $linked = TeamMember::create(['name' => 'Ammar', 'user_id' => $this->admin->id]);
    TeamMember::create(['name' => 'Munir']);

    $this->get('/finance/payroll')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('rows.0.member.id', $linked->id)
        ->where('rows.0.linked', true)
        ->where('rows.0.performance.pieces', 10)
        ->where('rows.0.performance.orders', 1)
        ->where('rows.0.performance.sales', 400)
        ->where('rows.1.linked', false)
        ->where('rows.1.performance.pieces', 0));

    $this->get('/finance')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('summary.pieces', 10)
        ->has('previous.pieces')
        ->has('buckets.0.pieces')
        ->where('breakdown.by_staff.0.pieces', 10));
});

test('team members with payslips cannot be deleted', function () {
    $member = TeamMember::create(['name' => 'Munir']);
    $member->payslips()->create(['period' => '2026-09']);

    $this->delete("/finance/team/{$member->id}")->assertSessionHasErrors('member');
    expect($member->fresh())->not->toBeNull();
});
