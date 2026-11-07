<?php

namespace App\Http\Controllers;

use App\Enums\OrderStage;
use App\Http\Requests\OrderRequest;
use App\Models\AddOn;
use App\Models\Agent;
use App\Models\Campaign;
use App\Models\Customer;
use App\Models\Inquiry;
use App\Models\Material;
use App\Models\Order;
use App\Models\OrderActivity;
use App\Models\OrderAttachment;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\PricelistItem;
use App\Models\ProductOption;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    public function index(Request $request): Response
    {
        // No cron on a plain XAMPP install, so expired cancelled orders are also cleared here (at most hourly).
        if (Cache::add('orders:purge-cancelled', true, now()->addHour())) {
            Order::purgeExpiredCancelled();
        }

        $view = $request->input('view', 'board');
        $search = trim((string) $request->input('q'));
        $status = $request->input('status', 'active');

        $query = Order::query()
            ->with(['customer', 'items', 'agent'])
            ->withSum('payments', 'amount')
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($query) use ($search) {
                    $query->where('order_no', 'like', "%{$search}%")
                        ->orWhere('title', 'like', "%{$search}%")
                        ->orWhereHas('customer', fn ($query) => $query
                            ->where('name', 'like', "%{$search}%")
                            ->orWhere('organization', 'like', "%{$search}%")
                            ->orWhere('phone', 'like', "%{$search}%"));
                });
            });

        $props = [
            'filters' => ['view' => $view, 'q' => $search, 'status' => $status, 'stage' => $request->input('stage')],
            'stages' => OrderStage::options(),
        ];

        if ($view === 'board') {
            $orders = $query->active()->orderBy('stage_entered_at')->get();

            $props['columns'] = collect(OrderStage::active())->map(fn (OrderStage $stage) => [
                'stage' => $stage->value,
                'label' => $stage->label(),
                'target_days' => $stage->targetDays(),
                'orders' => $orders->where('stage', $stage)->map->summary()->values(),
            ]);
        } else {
            $query
                ->when($status === 'active', fn ($query) => $query->active())
                ->when($status === 'completed', fn ($query) => $query->notCancelled()->where('stage', OrderStage::Completed))
                ->when($status === 'cancelled', fn ($query) => $query->whereNotNull('cancelled_at'))
                ->when($request->filled('stage'), fn ($query) => $query->where('stage', $request->input('stage')))
                ->latest();

            $props['orders'] = $query->paginate(20)->withQueryString()->through(fn (Order $order) => $order->summary());
        }

        return Inertia::render('orders/index', $props);
    }

    public function create(Request $request): Response
    {
        $inquiry = $request->filled('inquiry') ? Inquiry::find($request->input('inquiry')) : null;

        return Inertia::render('orders/form', [
            ...$this->formOptions(),
            'order' => null,
            'sizeSurcharges' => [],
            'inquiry' => $inquiry ? [
                ...$inquiry->only(['id', 'name', 'phone', 'email', 'organization', 'product', 'quantity', 'message']),
                'required_by' => $inquiry->required_by?->toDateString(),
            ] : null,
        ]);
    }

    public function store(OrderRequest $request): RedirectResponse
    {
        $order = DB::transaction(function () use ($request) {
            $order = new Order;
            $this->fill($order, $request);
            $order->log('created', 'Order dicipta', $request->user());

            if ($order->inquiry_id) {
                Inquiry::whereKey($order->inquiry_id)->update(['status' => 'converted']);
            }

            return $order;
        });

        return to_route('orders.show', $order)->with('success', "Order {$order->order_no} dicipta.");
    }

    public function show(Order $order): Response
    {
        $order->load(['customer', 'sales', 'agent', 'items', 'payments.user', 'attachments', 'activities.user']);

        return Inertia::render('orders/show', [
            'order' => [
                ...$order->summary(),
                'customer' => [
                    ...$order->customer->only(['name', 'phone', 'email', 'organization', 'state', 'address']),
                    'whatsapp' => $order->customer->whatsappNumber(),
                ],
                'sales' => $order->sales?->name,
                'subtotal' => (float) $order->subtotal,
                'discount' => (float) $order->discount,
                'shipping_fee' => (float) $order->shipping_fee,
                'deposit_required' => (float) $order->deposit_required,
                'balance' => $order->balance(),
                'commission_amount' => (float) $order->commission_amount,
                'cost' => $order->cost(),
                'profit' => $order->profit(),
                'profit_per_piece' => $order->profitPerPiece(),
                'postage_cost' => $order->postageCost(),
                'postage_estimated' => $order->postageEstimated(),
                'tracking_sent_at' => $order->tracking_sent_at?->toDateTimeString(),
                'notes' => $order->notes,
                'jobsheet_notes' => $order->jobsheet_notes,
                'invoice_no' => $order->invoiceNo(),
                'invoice_sent_at' => $order->invoice_sent_at?->toDateTimeString(),
                'confirmed_at' => $order->confirmed_at?->toDateTimeString(),
                'design_approved_at' => $order->design_approved_at?->toDateTimeString(),
                'jobsheet_submitted_at' => $order->jobsheet_submitted_at?->toDateTimeString(),
                'supplier_ref' => $order->supplier_ref,
                'production_received_at' => $order->production_received_at?->toDateTimeString(),
                'shipping_method' => $order->shipping_method,
                'courier' => $order->courier,
                'tracking_no' => $order->tracking_no,
                'shipped_at' => $order->shipped_at?->toDateTimeString(),
                'completed_at' => $order->completed_at?->toDateTimeString(),
                'cancelled_at' => $order->cancelled_at?->toDateTimeString(),
                'cancel_reason' => $order->cancel_reason,
                'feedback_rating' => $order->feedback_rating,
                'feedback_comment' => $order->feedback_comment,
                'checklist' => $order->checklist(),
                'can_advance' => $order->canAdvance(),
                'next_stage_label' => $order->stage->next()?->label(),
                'stage_position' => $order->stage->position(),
                'public_invoice_url' => route('invoice.public', $order->public_token),
                'track_url' => route('track', ['order_no' => $order->order_no]),
                'items' => $order->items->map(fn (OrderItem $item) => [
                    ...$item->only(['id', 'pricelist_code', 'description', 'fabric', 'quantity', 'notes']),
                    'spec' => $item->specText(),
                    'names' => $item->names ?? [],
                    'unit_price' => (float) $item->unit_price,
                    'addons' => AddOn::whereIn('code', $item->addons ?? [])->pluck('name'),
                    'is_service' => $item->isServiceLine(),
                    'sizes' => $item->sizes ?? (object) [],
                    'sizes_total' => $item->sizesTotal(),
                    'line_total' => $item->lineTotal(),
                ]),
                'payments' => $order->payments->map(fn (Payment $payment) => [
                    'id' => $payment->id,
                    'type' => Payment::TYPES[$payment->type] ?? $payment->type,
                    'amount' => (float) $payment->amount,
                    'method' => Payment::METHODS[$payment->method] ?? $payment->method,
                    'reference' => $payment->reference,
                    'paid_on' => $payment->paid_on->toDateString(),
                    'proof_url' => $payment->proof_path ? Storage::disk('public')->url($payment->proof_path) : null,
                    'user' => $payment->user?->name,
                ]),
                'attachments' => $order->attachments->map(fn (OrderAttachment $attachment) => [
                    'id' => $attachment->id,
                    'kind' => $attachment->kind,
                    'kind_label' => OrderAttachment::KINDS[$attachment->kind] ?? $attachment->kind,
                    'url' => $attachment->url(),
                    'name' => $attachment->original_name,
                    'size' => $attachment->size,
                    'is_image' => $attachment->isImage(),
                    'created_at' => $attachment->created_at->toDateTimeString(),
                ]),
                'activities' => $order->activities->map(fn (OrderActivity $activity) => [
                    'id' => $activity->id,
                    'type' => $activity->type,
                    'message' => $activity->message,
                    'user' => $activity->user?->name,
                    'created_at' => $activity->created_at->toDateTimeString(),
                ]),
            ],
            'stages' => OrderStage::options(),
            'paymentTypes' => Payment::TYPES,
            'paymentMethods' => Payment::METHODS,
            'attachmentKinds' => OrderAttachment::KINDS,
            'company' => config('hendrixx.company'),
            'retentionDays' => (int) config('hendrixx.cancelled_retention_days'),
        ]);
    }

    public function edit(Order $order): Response
    {
        $order->load(['customer', 'items']);

        return Inertia::render('orders/form', [
            ...$this->formOptions($order->agent_id, $order->campaign_id),
            'inquiry' => null,
            'sizeSurcharges' => $order->items->filter->isSizeSurcharge()->values()
                ->map(fn (OrderItem $item) => [...$item->only(['description', 'quantity']), 'unit_price' => (float) $item->unit_price]),
            'order' => [
                'id' => $order->id,
                'order_no' => $order->order_no,
                'customer' => $order->customer->only(['name', 'phone', 'organization', 'state']),
                'title' => $order->title,
                'required_by' => $order->required_by?->toDateString(),
                'sales_user_id' => $order->sales_user_id,
                'agent_id' => $order->agent_id,
                'campaign_id' => $order->campaign_id,
                'discount' => (float) $order->discount,
                'shipping_fee' => (float) $order->shipping_fee,
                'deposit_required' => (float) $order->deposit_required,
                'notes' => $order->notes,
                'jobsheet_notes' => $order->jobsheet_notes,
                // Size surcharge lines are rebuilt by the server, so the form only shows them.
                'items' => $order->items->reject->isSizeSurcharge()->values()->map(fn (OrderItem $item) => [
                    ...$item->only(['pricelist_code', 'description', 'garment_type', 'print_method', 'fabric', 'neck_type', 'neck_finish', 'test_print', 'quantity', 'notes']),
                    'unit_price' => (float) $item->unit_price,
                    'addons' => $item->addons ?? [],
                    'sizes' => $item->sizes ?? (object) [],
                    'names' => $item->names ?? [],
                ]),
            ],
        ]);
    }

    public function update(OrderRequest $request, Order $order): RedirectResponse
    {
        $previousTotal = (float) $order->total;

        $resend = DB::transaction(function () use ($request, $order, $previousTotal) {
            $this->fill($order, $request);
            $order->log('updated', 'Detail order dikemaskini', $request->user());

            return $order->noteInvoiceChange($previousTotal, $request->user());
        });

        return to_route('orders.show', $order)->with('success', $resend
            ? 'Order dikemaskini. Jumlah invoice berubah — hantar semula invoice kepada customer.'
            : 'Order dikemaskini.');
    }

    public function destroy(Order $order): RedirectResponse
    {
        Gate::authorize('admin');

        DB::transaction(fn () => $order->purge());

        return to_route('orders.index')->with('success', "Order {$order->order_no} dipadam.");
    }

    private function fill(Order $order, OrderRequest $request): void
    {
        $data = $request->validated();

        $customer = Customer::firstOrNew(['phone' => trim($data['customer']['phone'])]);
        $customer->fill($data['customer'])->save();

        $order->fill([
            'customer_id' => $customer->id,
            'title' => $data['title'],
            'required_by' => $data['required_by'] ?? null,
            'sales_user_id' => $data['sales_user_id'] ?? $order->sales_user_id ?? $request->user()->id,
            'agent_id' => $data['agent_id'] ?? null,
            'campaign_id' => $data['campaign_id'] ?? null,
            'inquiry_id' => $data['inquiry_id'] ?? $order->inquiry_id,
            'discount' => $data['discount'] ?? 0,
            'shipping_fee' => $data['shipping_fee'] ?? 0,
            'notes' => $data['notes'] ?? null,
            // Filled on the jobsheet page; the invoice form leaves it alone.
            'jobsheet_notes' => array_key_exists('jobsheet_notes', $data) ? $data['jobsheet_notes'] : $order->jobsheet_notes,
        ])->save();

        $order->items()->delete();

        $tiers = PricelistItem::whereIn('code', collect($data['items'])->pluck('pricelist_code')->filter())->get()->keyBy('code');
        $addOnRates = AddOn::whereIn('code', collect($data['items'])->pluck('addons')->flatten()->filter())->get()->keyBy('code');
        $specRates = ProductOption::rates();

        foreach ($data['items'] as $item) {
            $addOns = array_values(array_unique($item['addons'] ?? []));
            $names = OrderItem::sortNames($item['names'] ?? []);
            $chosen = collect($addOns)->map(fn ($code) => $addOnRates[$code] ?? null)->filter();
            $perPiece = $chosen->where('charge_type', 'per helai');

            // Price & cost come from the pricelist / add-on / spec tables, never from the browser.
            // Only "harga manual" lines (not in the pricelist) keep the price typed in the form.
            if ($tier = $tiers[$item['pricelist_code'] ?? ''] ?? null) {
                $tier = $tier->tierFor((int) $item['quantity']);
                $item['pricelist_code'] = $tier->code;
                $item['unit_price'] = (float) $tier->price + $perPiece->sum('price') + ProductOption::surcharge($specRates, $item, 'price');
                $unitCost = (float) $tier->cost + $perPiece->sum('cost') + ProductOption::surcharge($specRates, $item, 'cost');
            } elseif ($chosen->where('charge_type', 'per order')->isNotEmpty()) {
                $item['unit_price'] = $chosen->sum('price');
                $unitCost = $chosen->sum('cost');
            } else {
                $unitCost = $chosen->sum('cost') + ProductOption::surcharge($specRates, $item, 'cost');
            }

            // With a name list, the size breakdown is counted from it.
            $sizes = $names
                ? collect($names)->whereNotNull('size')->countBy('size')->all()
                : array_filter(array_map('intval', $item['sizes'] ?? []));

            $order->items()->create([
                ...$item,
                'unit_price' => round((float) $item['unit_price'], 2),
                'test_print' => (bool) ($item['test_print'] ?? false),
                'addons' => $addOns ?: null,
                'unit_cost' => round($unitCost, 2),
                'sizes' => $sizes ?: null,
                'names' => $names ?: null,
            ]);
        }

        $order->syncSizeSurcharges();

        $order->deposit_required = $data['deposit_required']
            ?? round((float) $order->total * config('hendrixx.deposit_percent') / 100, 2);
        $order->save();
    }

    /**
     * @return array<string, mixed>
     */
    private function formOptions(?int $currentAgentId = null, ?int $currentCampaignId = null): array
    {
        $materials = Material::pluck('name', 'code');

        return [
            'fabrics' => Material::fabricNames(),
            'pricelist' => PricelistItem::where('active', true)
                ->orderBy('product')->orderBy('min_qty')
                ->get()
                ->map(fn (PricelistItem $item) => [
                    ...$item->only(['code', 'product', 'material_code', 'sleeve', 'collar', 'min_qty', 'max_qty']),
                    'material' => $materials[$item->material_code] ?? null,
                    'price' => (float) $item->price,
                ]),
            'addOns' => AddOn::where('active', true)->orderBy('name')->get()
                ->map(fn (AddOn $addOn) => [...$addOn->only(['code', 'name', 'charge_type']), 'price' => (float) $addOn->price]),
            'agents' => Agent::where('active', true)->orWhere('id', $currentAgentId)->orderBy('name')->get()
                ->map(fn (Agent $agent) => [...$agent->only(['id', 'name', 'area', 'commission_type']), 'commission_value' => (float) $agent->commission_value]),
            'campaigns' => Campaign::linkable()->orWhere('id', $currentCampaignId)->orderByDesc('start_date')->get(['id', 'name', 'type']),
            'specOptions' => ProductOption::grouped(),
            'sizeRates' => array_filter(array_map('floatval', (array) config('hendrixx.size_surcharges', []))),
            'states' => config('hendrixx.states'),
            'postageRates' => array_map('floatval', config('hendrixx.postage_rates')),
            'sizes' => config('hendrixx.sizes'),
            'depositPercent' => config('hendrixx.deposit_percent'),
            'salesUsers' => User::orderBy('name')->get(['id', 'name']),
        ];
    }
}
