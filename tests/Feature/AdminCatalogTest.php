<?php

use App\Models\AddOn;
use App\Models\Agent;
use App\Models\Material;
use App\Models\Order;
use App\Models\PricelistItem;
use App\Models\ProductOption;
use App\Models\Setting;
use App\Models\User;
use App\Support\Settings;
use Database\Seeders\CatalogSeeder;

beforeEach(function () {
    $this->seed(CatalogSeeder::class);
    $this->admin = User::factory()->create(['role' => 'admin']);
});

test('admin can open every catalog page and the settings page', function () {
    $this->actingAs($this->admin);

    foreach (['materials', 'pricelist', 'addons', 'agents'] as $resource) {
        $this->get("/admin/catalog/{$resource}")->assertOk()
            ->assertInertia(fn ($page) => $page->component('admin/catalog')->where('resource', $resource)->has('rows'));
    }

    $this->get('/admin/settings')->assertOk();
    $this->get('/admin/catalog/unknown')->assertNotFound();
});

test('non-admin staff cannot manage the catalog or settings', function () {
    $this->actingAs(User::factory()->create(['role' => 'sales']));

    $this->get('/admin/catalog/materials')->assertForbidden();
    $this->post('/admin/catalog/materials', ['code' => 'X'])->assertForbidden();
    $this->get('/admin/settings')->assertForbidden();
});

test('admin can create, update and delete a material', function () {
    $this->actingAs($this->admin);

    $this->post('/admin/catalog/materials', [
        'code' => 'MAT-BIRDEYE', 'name' => 'Bird Eye', 'category' => 'Kain', 'unit' => 'kg', 'cost_per_unit' => 27.5, 'active' => true,
    ])->assertSessionHasNoErrors();

    $material = Material::where('code', 'MAT-BIRDEYE')->firstOrFail();

    $this->post('/admin/catalog/materials', ['code' => 'MAT-BIRDEYE', 'name' => 'Dup', 'category' => 'Kain', 'unit' => 'kg', 'cost_per_unit' => 1])
        ->assertSessionHasErrors('code');

    $this->put("/admin/catalog/materials/{$material->id}", [...$material->only(['code', 'name', 'category', 'unit']), 'cost_per_unit' => 30, 'active' => false])
        ->assertSessionHasNoErrors();
    expect((float) $material->fresh()->cost_per_unit)->toBe(30.0)->and($material->fresh()->active)->toBeFalse();

    $this->delete("/admin/catalog/materials/{$material->id}")->assertSessionHasNoErrors();
    expect(Material::find($material->id))->toBeNull();
});

test('a material used by the pricelist and an agent with orders cannot be deleted', function () {
    $this->actingAs($this->admin);

    $eyelet = Material::where('code', 'MAT-EYELET')->first();
    $this->delete("/admin/catalog/materials/{$eyelet->id}")->assertSessionHasErrors('delete');

    $agent = Agent::first();
    $this->post('/orders', [
        'customer' => ['name' => 'Ali', 'phone' => '0123456789'], 'title' => 'Test', 'agent_id' => $agent->id,
        'items' => [['description' => 'Jersey', 'quantity' => 10, 'unit_price' => 40]],
    ]);
    $this->delete("/admin/catalog/agents/{$agent->id}")->assertSessionHasErrors('delete');
    expect(Agent::find($agent->id))->not->toBeNull();
});

test('order uses pricelist cost, add-on cost and agent commission from the database', function () {
    $this->actingAs($this->admin);
    $tier = PricelistItem::where('code', 'JRS-SS-EYE-10')->first(); // price 45, cost 26
    $lycra = AddOn::where('code', 'ADD-LYCRA')->first(); // price 8, cost 4
    $agent = Agent::where('commission_type', 'per helai')->first(); // RM4.50 / helai

    $this->post('/orders', [
        'customer' => ['name' => 'Ali', 'phone' => '0123456789'],
        'title' => 'Jersey UM',
        'agent_id' => $agent->id,
        'items' => [
            ['pricelist_code' => $tier->code, 'addons' => ['ADD-LYCRA'], 'description' => 'Jersey', 'quantity' => 20, 'unit_price' => 53, 'unit_cost' => 0.01],
            ['addons' => ['ADD-RUSH'], 'description' => 'Rush order', 'quantity' => 1, 'unit_price' => 150],
        ],
    ])->assertSessionHasNoErrors();

    $order = Order::with('items')->first();
    $garment = $order->items->firstWhere('pricelist_code', $tier->code);

    expect((float) $garment->unit_cost)->toBe((float) $tier->cost + (float) $lycra->cost) // never trusts the browser
        ->and($order->quantity())->toBe(20) // rush line is not a garment
        ->and((float) $order->commission_amount)->toBe(90.0) // 20 × 4.50
        ->and($order->cost())->toBe(20 * 30.0 + 80.0)
        ->and($order->profit())->toBe(round((float) $order->total - 680 - 90, 2));
});

test('settings saved by admin override config and keep the token encrypted', function () {
    $this->actingAs($this->admin);

    $this->put('/admin/settings', [
        'company' => ['name' => 'Hendrixx Exclusive Sdn Bhd', 'phone' => '60111222333', 'bank_account' => '5123 4567 8910'],
        'production_days' => 5,
        'deposit_percent' => 40,
        'working_days' => [1, 2, 3, 4, 5, 6],
        'holidays' => "2026-12-25\nnot-a-date",
        'stage_targets' => ['order' => 1, 'design' => 2, 'jobsheet' => 1, 'production' => 5, 'postage' => 1],
        'sizes' => 'XS, S, M, L, XL',
        'couriers' => 'J&T Express, Pos Laju',
        'postage_rates' => ['Semenanjung' => 10, 'Sabah / Sarawak' => 25, 'Narnia' => 99],
        'sheets' => ['url' => 'https://script.google.com/macros/s/abc/exec', 'token' => 'secret-token', 'auto_sync' => false],
    ])->assertSessionHasNoErrors();

    expect(config('hendrixx.postage_rates'))->toBe(['Semenanjung' => 10.0, 'Sabah / Sarawak' => 25.0])
        ->and(config('hendrixx.company.name'))->toBe('Hendrixx Exclusive Sdn Bhd')
        ->and(config('hendrixx.production_days'))->toBe(5)
        ->and(config('hendrixx.holidays'))->toBe(['2026-12-25'])
        ->and(config('hendrixx.sizes'))->toBe(['XS', 'S', 'M', 'L', 'XL']);

    $stored = Setting::where('key', 'sheets.token')->value('value');
    expect($stored)->not->toContain('secret-token');

    config(['hendrixx.sheets.token' => null]);
    Settings::applyToConfig();
    expect(config('hendrixx.sheets.token'))->toBe('secret-token');

    // Blank token keeps the existing one
    $this->put('/admin/settings', [
        'company' => ['name' => 'Hendrixx', 'phone' => '601'], 'production_days' => 6, 'deposit_percent' => 50, 'working_days' => [1],
        'stage_targets' => ['order' => 2], 'sizes' => 'M', 'sheets' => ['url' => null, 'token' => '', 'auto_sync' => false],
    ])->assertSessionHasNoErrors();
    expect(config('hendrixx.sheets.token'))->toBe('secret-token');
});

test('pricelist items are priced by the server from tier, add-ons and specs', function () {
    $this->actingAs($this->admin);
    ProductOption::where('group', 'print_method')->where('name', 'Silkscreen')->update(['price' => 6, 'cost' => 2]);

    $this->post('/orders', [
        'customer' => ['name' => 'Ali', 'phone' => '0123456789'],
        'title' => 'Jersey UM',
        'items' => [
            // Browser claims tier 10-29 at RM1; quantity 30 must use the 30-99 tier (RM40).
            ['pricelist_code' => 'JRS-SS-EYE-10', 'addons' => ['ADD-LYCRA'], 'print_method' => 'Silkscreen', 'description' => 'Jersey', 'quantity' => 30, 'unit_price' => 1],
            ['addons' => ['ADD-RUSH'], 'description' => 'Rush order', 'quantity' => 1, 'unit_price' => 1],
        ],
    ])->assertSessionHasNoErrors();

    $items = Order::first()->items;
    $garment = $items->firstWhere('description', 'Jersey');

    expect($garment->pricelist_code)->toBe('JRS-SS-EYE-30')
        ->and((float) $garment->unit_price)->toBe(40.0 + 8 + 6)
        ->and((float) $garment->unit_cost)->toBe(24.0 + 4 + 2)
        ->and((float) $items->firstWhere('description', 'Rush order')->unit_price)->toBe(150.0);
});
