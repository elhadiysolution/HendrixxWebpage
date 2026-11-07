<?php

use App\Models\Agent;
use App\Models\Material;
use App\Models\Order;
use App\Models\PricelistItem;
use App\Models\ProductOption;
use App\Models\User;
use App\Services\GoogleSheets\SheetSync;
use App\Support\Settings;
use Database\Seeders\CatalogSeeder;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

const SHEET_URL = 'https://script.google.com/macros/s/test/exec';

beforeEach(function () {
    $this->seed(CatalogSeeder::class);
    $this->actingAs(User::factory()->create(['role' => 'admin']));
});

function connectSheet(bool $autoSync = true): void
{
    Settings::set(['sheets.url' => SHEET_URL, 'sheets.token' => 'tok', 'sheets.auto_sync' => $autoSync]);
}

function orderPayloadForSync(): array
{
    return [
        'customer' => ['name' => 'Ali', 'phone' => '0123456789'],
        'title' => 'Jersey Sync',
        'items' => [['description' => 'Jersey', 'quantity' => 10, 'unit_price' => 40, 'sizes' => ['M' => 4, 'L' => 6]]],
    ];
}

test('nothing is sent when the sheet is not connected', function () {
    Http::fake();

    $this->post('/orders', orderPayloadForSync())->assertRedirect();
    app(SheetSync::class)->flush();

    Http::assertNothingSent();
});

test('order changes are sent to the sheet in one batch with the same ids', function () {
    Http::fake([SHEET_URL.'*' => Http::response(['ok' => true, 'data' => []])]);
    connectSheet();

    $this->post('/orders', orderPayloadForSync())->assertRedirect();
    app(SheetSync::class)->flush();

    $order = Order::with('items')->first();

    Http::assertSent(function (Request $request) use ($order) {
        if ($request['action'] !== 'batch' || $request['token'] !== 'tok') {
            return false;
        }

        $upserts = collect($request['operations'])->where('action', 'upsert');
        $orderRow = $upserts->firstWhere('table', 'Orders')['data'] ?? null;
        $itemRow = $upserts->firstWhere('table', 'OrderItems')['data'] ?? null;

        return $orderRow['id'] === $order->id
            && $orderRow['order_no'] === $order->order_no
            && $orderRow['stage'] === 'order'
            && $itemRow['sizes'] === 'M:4, L:6'
            && $upserts->contains('table', 'Customers')
            && $upserts->contains('table', 'Activities');
    });
});

test('a sheet outage never breaks the website and the error is recorded', function () {
    Http::fake([SHEET_URL.'*' => Http::response(['ok' => false, 'error' => 'Unauthorized'])]);
    connectSheet();

    $this->post('/orders', orderPayloadForSync())->assertRedirect()->assertSessionHasNoErrors();
    app(SheetSync::class)->flush();

    expect(Order::count())->toBe(1)
        ->and(config('hendrixx.sheets.last_error'))->toContain('Unauthorized');
});

test('push all replaces every tab and never sends the token as a setting', function () {
    Http::fake([SHEET_URL.'*' => Http::response(['ok' => true, 'data' => []])]);
    connectSheet(autoSync: false);

    $this->post('/admin/settings/sheets/push')->assertSessionHasNoErrors();

    $tables = [];
    Http::assertSent(function (Request $request) use (&$tables) {
        $tables[] = $request['table'];

        if ($request['table'] === 'Settings') {
            expect(collect($request['rows'])->pluck('key'))->not->toContain('sheets.token');
        }

        return $request['action'] === 'replace';
    });

    expect($tables)->toContain('Orders', 'OrderItems', 'Payments', 'Materials', 'Pricelist', 'AddOns', 'ProductOptions', 'Agents', 'Customers', 'Settings');
});

test('catalog can be imported from the sheet', function () {
    connectSheet(autoSync: false);

    Http::fake(function (Request $request) {
        $rows = match ($request['table']) {
            'Materials' => [['id' => 11, 'code' => 'MAT-NEW', 'name' => 'Kain Baru', 'category' => 'Kain', 'unit' => 'kg', 'cost_per_unit' => 20, 'active' => true]],
            'Pricelist' => [['id' => 21, 'code' => 'NEW-1', 'product' => 'Jersey', 'material_code' => 'MAT-NEW', 'min_qty' => 1, 'max_qty' => null, 'price' => 50, 'cost' => 25, 'active' => true]],
            'AddOns' => [],
            'Agents' => [['id' => 1, 'name' => 'Luqman Updated', 'commission_type' => 'percent', 'commission_value' => 5, 'active' => true]],
            default => [],
        };

        return Http::response(['ok' => true, 'data' => $rows]);
    });

    $this->post('/admin/settings/sheets/pull')->assertSessionHasNoErrors();

    expect(Material::pluck('code')->all())->toBe(['MAT-NEW'])
        ->and(Material::first()->id)->toBe(11)
        ->and(PricelistItem::count())->toBe(1)
        ->and(Agent::find(1)->name)->toBe('Luqman Updated')
        ->and(ProductOption::count())->toBe(16); // empty ProductOptions tab keeps the dropdowns
});

test('connection test reports a bad url clearly', function () {
    Http::fake([SHEET_URL.'*' => Http::response('<html>Sign in</html>', 200)]);
    connectSheet(autoSync: false);

    $this->post('/admin/settings/sheets/test')->assertSessionHasErrors('sheets');
});

test('spesifikasi can be imported from the sheet', function () {
    connectSheet(autoSync: false);

    Http::fake(function (Request $request) {
        $rows = match ($request['table']) {
            'Agents' => [],
            'ProductOptions' => [
                ['id' => 5, 'group' => 'print_method', 'name' => 'DTF', 'price' => 4, 'cost' => 1.5, 'sort' => 1, 'active' => true],
                ['id' => 6, 'group' => 'not_a_group', 'name' => 'Rosak', 'price' => 0, 'cost' => 0, 'active' => true],
            ],
            default => [],
        };

        return Http::response(['ok' => true, 'data' => $rows]);
    });

    $this->post('/admin/settings/sheets/pull')->assertSessionHasNoErrors();

    expect(ProductOption::pluck('name')->all())->toBe(['DTF'])
        ->and((float) ProductOption::find(5)->price)->toBe(4.0);
});

test('saving a spesifikasi pushes it to the sheet', function () {
    connectSheet();
    Http::fake([SHEET_URL.'*' => Http::response(['ok' => true, 'data' => []])]);

    ProductOption::where('name', 'Silkscreen')->first()->update(['price' => 6]);
    app(SheetSync::class)->flush();

    Http::assertSent(fn (Request $request) => collect($request['operations'] ?? [])
        ->contains(fn ($op) => $op['table'] === 'ProductOptions' && $op['data']['name'] === 'Silkscreen' && $op['data']['price'] === 6.0));
});
