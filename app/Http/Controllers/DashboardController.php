<?php

namespace App\Http\Controllers;

use App\Enums\OrderStage;
use App\Models\Inquiry;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Support\WorkingDays;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(): Response
    {
        $monthStart = now()->startOfMonth();
        $lastMonthStart = now()->subMonthNoOverflow()->startOfMonth();

        $active = Order::active()->with(['customer', 'items', 'agent'])->withSum('payments', 'amount')->get();

        $monthOrders = Order::notCancelled()->where('created_at', '>=', $monthStart)->with('items')->get();
        $lastMonthSales = (float) Order::notCancelled()->whereBetween('created_at', [$lastMonthStart, $monthStart])->sum('total');

        $produced = Order::notCancelled()->where('production_received_at', '>=', $monthStart)->get(['due_date', 'production_received_at']);
        $shipped = Order::notCancelled()->where('shipped_at', '>=', $monthStart)->get(['required_by', 'confirmed_at', 'shipped_at']);
        $withRequiredBy = $shipped->whereNotNull('required_by');
        $withConfirm = $shipped->whereNotNull('confirmed_at');

        $outstanding = (float) Order::notCancelled()->sum('total')
            - (float) Payment::whereHas('order', fn ($query) => $query->whereNull('cancelled_at'))->sum('amount');

        return Inertia::render('dashboard', [
            'stats' => [
                'sales_month' => (float) $monthOrders->sum('total'),
                'sales_last_month' => $lastMonthSales,
                'profit_month' => round($monthOrders->sum(fn (Order $order) => $order->profit()), 2),
                'commission_month' => (float) $monthOrders->sum('commission_amount'),
                'orders_month' => $monthOrders->count(),
                'pieces_month' => (int) OrderItem::whereIn('order_id', $monthOrders->pluck('id'))->sum('quantity'),
                'collected_month' => (float) Payment::where('paid_on', '>=', $monthStart->toDateString())->sum('amount'),
                'outstanding' => max(0, round($outstanding, 2)),
                'active_orders' => $active->count(),
                'active_pieces' => $active->sum(fn (Order $order) => $order->quantity()),
                'late_count' => $active->filter->isLate()->count(),
                'at_risk_count' => $active->filter->isAtRisk()->count(),
                'new_inquiries' => Inquiry::where('status', 'new')->count(),
                'kilang_on_time' => $this->rate($produced, fn ($order) => $order->due_date === null || $order->production_received_at->startOfDay()->lessThanOrEqualTo($order->due_date)),
                'kilang_count' => $produced->count(),
                'delivery_on_time' => $this->rate($withRequiredBy, fn ($order) => $order->shipped_at->startOfDay()->lessThanOrEqualTo($order->required_by)),
                'delivery_count' => $withRequiredBy->count(),
                'avg_lead_days' => $withConfirm->isEmpty() ? null : round($withConfirm->avg(fn ($order) => WorkingDays::between($order->confirmed_at, $order->shipped_at)), 1),
                'avg_rating' => ($rating = Order::whereNotNull('feedback_rating')->avg('feedback_rating')) ? round((float) $rating, 1) : null,
            ],
            'pipeline' => collect(OrderStage::active())->map(fn (OrderStage $stage) => [
                'stage' => $stage->value,
                'label' => $stage->label(),
                'count' => $active->where('stage', $stage)->count(),
                'pieces' => $active->where('stage', $stage)->sum(fn (Order $order) => $order->quantity()),
                'late' => $active->where('stage', $stage)->filter->isLate()->count(),
            ]),
            'attention' => $active
                ->filter(fn (Order $order) => $order->isLate() || $order->isAtRisk())
                ->sortBy(fn (Order $order) => $order->required_by ?? $order->due_date ?? now()->addYear())
                ->take(10)
                ->map->summary()
                ->values(),
            'dueSoon' => $active
                ->where('stage', OrderStage::Production)
                ->sortBy('due_date')
                ->take(10)
                ->map->summary()
                ->values(),
            'salesTrend' => $this->salesTrend(),
            'targets' => [
                'production_days' => config('hendrixx.production_days'),
                'lead_days' => array_sum(config('hendrixx.stage_targets')),
            ],
        ]);
    }

    private function rate(Collection $orders, callable $onTime): ?int
    {
        return $orders->isEmpty() ? null : (int) round($orders->filter($onTime)->count() / $orders->count() * 100);
    }

    /**
     * @return list<array{month: string, label: string, sales: float, collected: float}>
     */
    private function salesTrend(): array
    {
        $start = now()->subMonthsNoOverflow(5)->startOfMonth();

        $sales = Order::notCancelled()->where('created_at', '>=', $start)->get(['total', 'created_at'])
            ->groupBy(fn (Order $order) => $order->created_at->format('Y-m'));
        $collected = Payment::where('paid_on', '>=', $start->toDateString())->get(['amount', 'paid_on'])
            ->groupBy(fn (Payment $payment) => $payment->paid_on->format('Y-m'));

        return collect(range(0, 5))->map(function (int $offset) use ($start, $sales, $collected) {
            $month = $start->copy()->addMonthsNoOverflow($offset);
            $key = $month->format('Y-m');

            return [
                'month' => $key,
                'label' => $month->format('M'),
                'sales' => (float) ($sales->get($key)?->sum('total') ?? 0),
                'collected' => (float) ($collected->get($key)?->sum('amount') ?? 0),
            ];
        })->all();
    }
}
