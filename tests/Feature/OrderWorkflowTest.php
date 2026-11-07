<?php

use App\Enums\OrderStage;
use App\Models\Inquiry;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\ProductOption;
use App\Models\User;
use App\Support\WorkingDays;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

function orderPayload(array $overrides = []): array
{
    return array_replace_recursive([
        'customer' => ['name' => 'Ali', 'phone' => '0123456789', 'organization' => 'UM Esports'],
        'title' => 'Jersey Esports',
        'discount' => 0,
        'shipping_fee' => 10,
        'items' => [
            ['description' => 'Jersey Round Neck', 'fabric' => 'Microfiber Eyelet', 'quantity' => 10, 'unit_price' => 40, 'sizes' => ['M' => 5, 'L' => 5]],
        ],
    ], $overrides);
}

beforeEach(function () {
    Storage::fake('public');
    $this->user = User::factory()->create(['role' => 'sales']);
    $this->actingAs($this->user);
});

test('creating an order calculates totals and a default 50% deposit', function () {
    $this->post('/orders', orderPayload())->assertRedirect();

    $order = Order::first();

    expect($order->order_no)->toStartWith('HX'.now()->format('ym').'-')
        ->and((float) $order->subtotal)->toBe(400.0)
        ->and((float) $order->total)->toBe(410.0)
        ->and((float) $order->deposit_required)->toBe(205.0)
        ->and($order->stage)->toBe(OrderStage::Order)
        ->and($order->customer->organization)->toBe('UM Esports');
});

test('existing customers are matched by phone number', function () {
    $this->post('/orders', orderPayload());
    $this->post('/orders', orderPayload(['customer' => ['name' => 'Ali Updated'], 'title' => 'Second order']));

    expect(Order::count())->toBe(2)
        ->and(Order::pluck('customer_id')->unique())->toHaveCount(1);
});

test('order cannot proceed until invoice is sent and deposit is received', function () {
    $this->post('/orders', orderPayload());
    $order = Order::first();

    $this->post("/orders/{$order->id}/advance")->assertSessionHasErrors('stage');
    expect($order->fresh()->stage)->toBe(OrderStage::Order);

    $this->post("/orders/{$order->id}/invoice-sent");
    $this->post("/orders/{$order->id}/payments", ['type' => 'deposit', 'amount' => 100, 'paid_on' => today()->toDateString()]);
    $this->post("/orders/{$order->id}/advance")->assertSessionHasErrors('stage');

    $this->post("/orders/{$order->id}/payments", ['type' => 'deposit', 'amount' => 105, 'paid_on' => today()->toDateString()]);
    $this->post("/orders/{$order->id}/advance")->assertSessionHasNoErrors();

    $order->refresh();
    expect($order->stage)->toBe(OrderStage::Design)
        ->and($order->confirmed_at)->not->toBeNull();
});

test('full workflow runs through every gate to complete', function () {
    Carbon::setTestNow('2026-10-05 10:00:00'); // Monday

    $this->post('/orders', orderPayload());
    $order = Order::first();
    $id = $order->id;

    // 1. Order + deposit
    $this->post("/orders/{$id}/invoice-sent");
    $this->post("/orders/{$id}/payments", ['type' => 'deposit', 'amount' => 205, 'paid_on' => '2026-10-05']);
    $this->post("/orders/{$id}/advance")->assertSessionHasNoErrors();

    // 2. Design: need final design upload + approval
    $this->post("/orders/{$id}/approve-design")->assertSessionHasErrors('design');
    $this->post("/orders/{$id}/attachments", ['kind' => 'design_final', 'files' => [UploadedFile::fake()->create('front.pdf', 200, 'application/pdf')]])->assertSessionHasNoErrors();
    $this->post("/orders/{$id}/advance")->assertSessionHasErrors('stage');
    $this->post("/orders/{$id}/approve-design");
    $this->post("/orders/{$id}/advance")->assertSessionHasNoErrors();

    // 3. Jobsheet: due date = 6 working days later (skips weekend)
    $this->post("/orders/{$id}/submit-jobsheet", ['supplier_ref' => 'KLG-1'])->assertSessionHasNoErrors();
    expect(Order::find($id)->due_date->toDateString())->toBe('2026-10-13');
    $this->post("/orders/{$id}/advance")->assertSessionHasNoErrors();

    // 4. Production
    $this->post("/orders/{$id}/advance")->assertSessionHasErrors('stage');
    $this->post("/orders/{$id}/receive-production");
    $this->post("/orders/{$id}/advance")->assertSessionHasNoErrors();

    // 5. Postage: balance paid, posted with the actual postage cost, tracking sent to the customer
    $this->post("/orders/{$id}/tracking-sent")->assertSessionHasErrors('tracking');
    $this->post("/orders/{$id}/ship", ['shipping_method' => 'courier'])->assertSessionHasErrors('postage_cost');
    $this->post("/orders/{$id}/ship", ['shipping_method' => 'courier', 'postage_cost' => 12.5])->assertSessionHasNoErrors();
    $this->post("/orders/{$id}/payments", ['type' => 'balance', 'amount' => 205, 'paid_on' => '2026-10-14']);
    $this->post("/orders/{$id}/advance")->assertSessionHasErrors('stage');
    $this->post("/orders/{$id}/tracking-sent")->assertSessionHasNoErrors();
    $this->post("/orders/{$id}/advance")->assertSessionHasNoErrors();

    $order = Order::find($id);
    expect($order->stage)->toBe(OrderStage::Completed)
        ->and($order->completed_at)->not->toBeNull();

    $this->post("/orders/{$id}/feedback", ['feedback_rating' => 5, 'feedback_comment' => 'Mantap'])->assertSessionHasNoErrors();
    expect($order->fresh()->feedback_rating)->toBe(5);

    Carbon::setTestNow();
});

test('jobsheet requires a complete size breakdown', function () {
    $this->post('/orders', orderPayload(['items' => [['sizes' => ['M' => 3]]]]));
    $order = Order::first();
    $order->forceFill(['stage' => OrderStage::Jobsheet])->save();

    $this->post("/orders/{$order->id}/submit-jobsheet")->assertSessionHasErrors('jobsheet');
    expect($order->fresh()->jobsheet_submitted_at)->toBeNull();
});

test('only admins can revert or cancel orders', function () {
    $this->post('/orders', orderPayload());
    $order = Order::first();

    $this->post("/orders/{$order->id}/cancel")->assertForbidden();

    $this->actingAs(User::factory()->create(['role' => 'admin']));
    $this->post("/orders/{$order->id}/cancel", ['reason' => 'Customer tarik diri']);

    expect($order->fresh()->cancelled_at)->not->toBeNull();
    $this->post("/orders/{$order->id}/advance")->assertSessionHasErrors('stage');
});

test('order pages and documents render', function () {
    $this->post('/orders', orderPayload());
    $order = Order::first();

    $this->get('/dashboard')->assertOk();
    $this->get('/orders')->assertOk();
    $this->get('/orders?view=list&status=all')->assertOk();
    $this->get('/orders/create')->assertOk();
    $this->get("/orders/{$order->id}")->assertOk();
    $this->get("/orders/{$order->id}/edit")->assertOk();
    $this->get("/orders/{$order->id}/invoice")->assertOk()->assertSee($order->invoiceNo());
    $this->get("/orders/{$order->id}/jobsheet")->assertOk()->assertSee($order->order_no);
});

test('public invoice link and tracking work for customers', function () {
    $this->post('/orders', orderPayload());
    $order = Order::first();
    auth()->logout();

    $this->get("/i/{$order->public_token}")->assertOk()->assertSee($order->invoiceNo());
    $this->get('/i/wrong-token')->assertNotFound();

    $this->get("/track?order_no={$order->order_no}&phone=012-345 6789")
        ->assertInertia(fn ($page) => $page->component('track')->where('result.order_no', $order->order_no));

    $this->get("/track?order_no={$order->order_no}&phone=0199999999")
        ->assertInertia(fn ($page) => $page->where('result', null)->where('notFound', true));
});

test('sales page inquiry can be converted into an order', function () {
    auth()->logout();
    $this->get('/')->assertOk();
    $this->post('/inquiries', ['name' => 'Cikgu Rahman', 'phone' => '0137778899', 'product' => 'Jersey Bola', 'quantity' => 30])->assertSessionHasNoErrors();

    $inquiry = Inquiry::first();
    $this->actingAs($this->user);
    $this->get("/orders/create?inquiry={$inquiry->id}")->assertOk();
    $this->post('/orders', orderPayload(['inquiry_id' => $inquiry->id]));

    expect($inquiry->fresh()->status)->toBe('converted');
});

test('working days skip weekends', function () {
    expect(WorkingDays::add(Carbon::parse('2026-10-09'), 1)->toDateString())->toBe('2026-10-12') // Fri -> Mon
        ->and(WorkingDays::between(Carbon::parse('2026-10-09'), Carbon::parse('2026-10-12')))->toBe(1);
});

test('users page is admin only', function () {
    $this->get('/users')->assertForbidden();

    $this->actingAs(User::factory()->create(['role' => 'admin']));
    $this->get('/users')->assertOk();
    $this->post('/users', ['name' => 'Designer', 'email' => 'd@hx.my', 'role' => 'designer', 'password' => 'password123'])->assertSessionHasNoErrors();
    expect(User::where('email', 'd@hx.my')->value('role'))->toBe('designer');
});

test('a name list is sorted by size and drives the size breakdown', function () {
    $this->post('/orders', orderPayload([
        'customer' => ['state' => 'Selangor'],
        'items' => [[
            'quantity' => 3,
            'sizes' => ['M' => 5, 'L' => 5],
            'print_method' => 'Sublimation',
            'neck_finish' => 'Readymade',
            'test_print' => true,
            'names' => [
                ['name' => 'AMIR', 'number' => '10', 'size' => 'XL'],
                ['name' => 'HAZIQ', 'number' => '23', 'size' => 'S'],
                ['name' => 'FARHAN', 'number' => '7', 'size' => 'S'],
            ],
        ]],
    ]))->assertSessionHasNoErrors();

    $item = Order::first()->items->first();

    expect(collect($item->names)->pluck('name')->all())->toBe(['FARHAN', 'HAZIQ', 'AMIR'])
        ->and($item->sizes)->toBe(['S' => 2, 'XL' => 1])
        ->and($item->test_print)->toBeTrue()
        ->and($item->specText())->toBe('Sublimation · Readymade · Test print')
        ->and(Order::first()->customer->state)->toBe('Selangor');
});

test('an unknown delivery state is rejected', function () {
    $this->post('/orders', orderPayload(['customer' => ['state' => 'Narnia']]))->assertSessionHasErrors('customer.state');
});

test('spec option costs are added to the item cost', function () {
    ProductOption::where('group', 'print_method')->where('name', 'Silkscreen')->update(['price' => 6, 'cost' => 2.5]);

    $this->post('/orders', orderPayload(['items' => [['print_method' => 'Silkscreen']]]))->assertSessionHasNoErrors();

    expect((float) Order::first()->items->first()->unit_cost)->toBe(2.5);
});

test('names & sizes are filled on the jobsheet page without touching the invoice', function () {
    $this->post('/orders', orderPayload(['items' => [['quantity' => 3, 'sizes' => []]]]))->assertSessionHasNoErrors();
    $order = Order::first();
    $item = $order->items->first();

    $this->get("/orders/{$order->id}/names")->assertOk();

    $this->put("/orders/{$order->id}/names", [
        'jobsheet_notes' => 'Logo di lengan kanan',
        'items' => [[
            'id' => $item->id,
            'names' => [
                ['name' => 'AMIR', 'number' => '10', 'size' => 'XL'],
                ['name' => 'FARHAN', 'number' => '7', 'size' => 'S'],
                ['name' => 'HAZIQ', 'number' => '23', 'size' => 'S'],
            ],
        ]],
    ])->assertRedirect("/orders/{$order->id}");

    $item->refresh();
    $order->refresh();

    expect(collect($item->names)->pluck('name')->all())->toBe(['FARHAN', 'HAZIQ', 'AMIR'])
        ->and($item->sizes)->toBe(['S' => 2, 'XL' => 1])
        ->and($order->sizesComplete())->toBeTrue()
        ->and($order->jobsheet_notes)->toBe('Logo di lengan kanan')
        ->and((float) $order->total)->toBe(130.0); // 3 × 40 + 10 postage, unchanged

    // Editing the invoice afterwards keeps the jobsheet notes.
    $this->put("/orders/{$order->id}", orderPayload(['items' => [['quantity' => 3, 'names' => $item->names]]]))->assertSessionHasNoErrors();
    expect($order->fresh()->jobsheet_notes)->toBe('Logo di lengan kanan')
        ->and(collect($order->fresh()->items->first()->names)->count())->toBe(3);
});

test('the names page rejects items from another order', function () {
    $this->post('/orders', orderPayload())->assertSessionHasNoErrors();
    $this->post('/orders', orderPayload(['title' => 'Lain']))->assertSessionHasNoErrors();
    [$first, $second] = Order::orderBy('id')->get();

    $this->put("/orders/{$first->id}/names", ['items' => [['id' => $second->items->first()->id, 'sizes' => ['M' => 1]]]])
        ->assertSessionHasErrors('items.0.id');
});

test('big sizes add a size surcharge line to the invoice', function () {
    $this->post('/orders', orderPayload(['items' => [['quantity' => 5, 'sizes' => []]]]))->assertSessionHasNoErrors();
    $order = Order::first();
    $order->forceFill(['invoice_sent_at' => now()])->save();

    $this->put("/orders/{$order->id}/names", [
        'items' => [['id' => $order->items->first()->id, 'sizes' => ['L' => 1, '3XL' => 1, '5XL' => 1, '6XL' => 1, '8XL' => 1]]],
    ])->assertSessionHasNoErrors();

    $order->refresh()->load('items');
    $surcharges = $order->items->filter->isSizeSurcharge()->values();

    expect($surcharges->map->only(['description', 'quantity'])->all())->toBe([
        ['description' => 'Caj saiz besar (3XL, 5XL)', 'quantity' => 2],
        ['description' => 'Caj saiz besar (6XL, 8XL)', 'quantity' => 2],
    ])
        ->and((float) $order->total)->toBe(5 * 40 + 2 * 4 + 2 * 6 + 10.0)
        ->and($order->quantity())->toBe(5) // surcharge lines are not garments
        ->and($order->sizesComplete())->toBeTrue()
        ->and($order->activities()->where('message', 'like', 'Jumlah invoice berubah%')->exists())->toBeTrue();

    // Editing the invoice keeps one set of surcharge lines, rebuilt from the sizes.
    $item = $order->items->reject->isSizeSurcharge()->first();
    $this->put("/orders/{$order->id}", orderPayload(['items' => [['quantity' => 5, 'sizes' => $item->sizes]]]))->assertSessionHasNoErrors();

    expect(Order::first()->items->filter->isSizeSurcharge()->count())->toBe(2)
        ->and((float) Order::first()->total)->toBe(230.0);
});

test('cancelled orders can be restored within 3 days, then are purged for good', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $this->actingAs($admin);
    $this->post('/orders', orderPayload())->assertSessionHasNoErrors();
    $order = Order::first();
    $order->payments()->create(['type' => 'deposit', 'amount' => 50, 'paid_on' => today()]);

    $this->post("/orders/{$order->id}/cancel", ['reason' => 'Customer tarik diri']);
    expect($order->fresh()->cancel_reason)->toBe('Customer tarik diri')
        ->and($order->fresh()->purgeAt()->toDateString())->toBe(now()->addDays(3)->toDateString());

    // Restore clears the cancellation.
    $this->post("/orders/{$order->id}/cancel");
    expect($order->fresh()->cancelled_at)->toBeNull()->and($order->fresh()->cancel_reason)->toBeNull();

    $this->post("/orders/{$order->id}/cancel");

    $this->travel(2)->days();
    expect(Order::purgeExpiredCancelled())->toBe(0)->and(Order::find($order->id))->not->toBeNull();

    $this->travel(2)->days();
    expect(Order::purgeExpiredCancelled())->toBe(1)
        ->and(Order::find($order->id))->toBeNull()
        ->and(OrderItem::where('order_id', $order->id)->exists())->toBeFalse()
        ->and(Payment::where('order_id', $order->id)->exists())->toBeFalse();
});

test('active orders are never purged', function () {
    $this->post('/orders', orderPayload())->assertSessionHasNoErrors();
    $this->travel(30)->days();

    expect(Order::purgeExpiredCancelled())->toBe(0)->and(Order::count())->toBe(1);
});
