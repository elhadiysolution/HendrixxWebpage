<?php

namespace App\Services\Finance;

use App\Models\Campaign;
use App\Models\CashEntry;
use App\Models\Order;
use App\Models\Payment;
use App\Models\TeamMember;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Sales, profit and cash figures for the Kewangan pages.
 *
 * Sales and order profit follow the order date (accrual); cash in / out follows the date money moved.
 *
 * Untung bersih order      = sales - production cost - agent commission - actual postage (Order::profit())
 * Untung bersih keseluruhan = untung bersih order + other income - kos tambahan (operating expenses)
 *
 * Kilang, commission and order postage cash-outs are not kos tambahan: the order profit already deducts them.
 */
class Finance
{
    /**
     * @return array<string, mixed>
     */
    public function summary(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $orders = $this->orders($from, $to);
        $entries = CashEntry::betweenDates($from->toDateString(), $to->toDateString())->get(['direction', 'category', 'amount', 'source']);
        $in = $entries->where('direction', 'in');
        $out = $entries->where('direction', 'out');
        $operatingEntries = $out->filter->isOperatingExpense();

        $grossProfit = round($orders->sum(fn (Order $order) => $order->profit()), 2);
        $otherIncome = (float) $in->whereNotIn('category', CashEntry::NON_INCOME)->sum('amount');
        $operating = (float) $operatingEntries->sum('amount');
        $collected = (float) Payment::whereBetween('paid_on', [$from->toDateString(), $to->toDateString()])->sum('amount');
        $cashIn = $collected + (float) $in->sum('amount');
        $cashOut = (float) $out->sum('amount');

        return [
            'sales' => round((float) $orders->sum('total'), 2),
            'orders' => $orders->count(),
            'pieces' => $orders->sum(fn (Order $order) => $order->quantity()),
            'cost_estimate' => round($orders->sum(fn (Order $order) => $order->cost()), 2),
            'commission' => round((float) $orders->sum('commission_amount'), 2),
            'postage_cost' => round($orders->sum(fn (Order $order) => $order->postageCost()), 2),
            'postage_estimated' => $orders->filter->postageEstimated()->count(),
            'gross_profit' => $grossProfit,
            'other_income' => round($otherIncome, 2),
            'operating_expenses' => round($operating, 2),
            'operating_by_category' => $this->byCategory($operatingEntries, CashEntry::CATEGORIES_OUT),
            'net_profit' => round($grossProfit + $otherIncome - $operating, 2),
            'collected' => round($collected, 2),
            'cash_in' => round($cashIn, 2),
            'cash_out' => round($cashOut, 2),
            'net_cash' => round($cashIn - $cashOut, 2),
            'kilang_paid' => round((float) $out->where('category', 'kilang')->sum('amount'), 2),
            'salary_paid' => round((float) $out->where('category', 'salary')->sum('amount'), 2),
            'cash_in_by_category' => [
                ['key' => 'orders', 'label' => 'Bayaran order customer', 'amount' => round($collected, 2)],
                ...$this->byCategory($in, CashEntry::CATEGORIES_IN),
            ],
            'cash_out_by_category' => $this->byCategory($out, CashEntry::CATEGORIES_OUT),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function salesBreakdown(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $orders = $this->orders($from, $to)->load(['sales', 'agent', 'customer', 'campaign']);
        $group = fn (callable $key, int $limit = 8) => $orders->groupBy($key)
            ->map(fn (Collection $group, string $name) => [
                'name' => $name,
                'orders' => $group->count(),
                'pieces' => $group->sum(fn (Order $order) => $order->quantity()),
                'sales' => round((float) $group->sum('total'), 2),
                'profit' => round($group->sum(fn (Order $order) => $order->profit()), 2),
            ])
            ->sortByDesc('sales')->take($limit)->values();

        return [
            'by_staff' => $group(fn (Order $order) => $order->sales?->name ?? 'Tiada PIC'),
            'by_agent' => $group(fn (Order $order) => $order->agent?->name ?? 'Jualan terus'),
            'by_campaign' => $group(fn (Order $order) => $order->campaign?->name ?? 'Tiada kempen'),
            'top_customers' => $group(fn (Order $order) => $order->customer?->organization ?: ($order->customer?->name ?? '-'), 10),
        ];
    }

    /**
     * Each sales PIC's orders, pieces and sales (postage excluded) in the range, keyed by user id.
     * Shown on the payroll page as a reference when deciding commission.
     *
     * @return Collection<int, array{orders: int, pieces: int, sales: float}>
     */
    public function salesByUser(CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        return $this->orders($from, $to)->whereNotNull('sales_user_id')->groupBy('sales_user_id')
            ->map(fn (Collection $orders) => [
                'orders' => $orders->count(),
                'pieces' => $orders->sum(fn (Order $order) => $order->quantity()),
                'sales' => round($orders->sum(fn (Order $order) => (float) $order->total - (float) $order->shipping_fee), 2),
            ]);
    }

    /** Money on hand according to the records: opening balance + all cash in - all cash out. */
    public function cashBalance(): float
    {
        $in = (float) Payment::sum('amount') + (float) CashEntry::where('direction', 'in')->sum('amount');
        $out = (float) CashEntry::where('direction', 'out')->sum('amount');

        return round((float) config('hendrixx.finance.opening_balance', 0) + $in - $out, 2);
    }

    /**
     * Payslip figures for a member and month. Commission is keyed in by finance based on performance;
     * the member's sales that month (as sales PIC, postage excluded) is shown alongside as a reference.
     *
     * @return array<string, float>
     */
    public function payslip(TeamMember $member, string $period, float $commission = 0, float $otherDeduction = 0, ?float $profitPool = null): array
    {
        $from = CarbonImmutable::createFromFormat('!Y-m', $period);
        $to = $from->endOfMonth()->startOfDay();

        $salesBase = $member->user_id
            ? round((float) $this->orders($from, $to)->where('sales_user_id', $member->user_id)->sum(fn (Order $order) => (float) $order->total - (float) $order->shipping_fee), 2)
            : 0.0;
        $profitPool ??= $this->profitPool($from, $to);

        $basic = (float) $member->basic_salary;
        $allowance = (float) $member->allowance;
        $profitShare = round(max(0, $profitPool) * (float) $member->profit_share_percent / 100, 2);
        // EPF on everything except allowance; KWSP rounds contributions up to the next ringgit.
        $epfWage = $basic + $commission + $profitShare;
        $epfEmployee = (float) ceil($epfWage * (float) $member->epf_employee_percent / 100);
        $epfEmployer = (float) ceil($epfWage * (float) $member->epf_employer_percent / 100);
        $gross = $basic + $allowance + $commission + $profitShare;

        return [
            'basic' => round($basic, 2),
            'allowance' => round($allowance, 2),
            'sales_base' => $salesBase,
            'commission' => round($commission, 2),
            'profit_pool' => round($profitPool, 2),
            'profit_share' => $profitShare,
            'epf_employee' => $epfEmployee,
            'epf_employer' => $epfEmployer,
            'other_deduction' => round($otherDeduction, 2),
            'net_pay' => round($gross - $epfEmployee - $otherDeduction, 2),
        ];
    }

    /** Net profit for the month before any salary, shared out by profit-share %. */
    public function profitPool(CarbonImmutable $from, CarbonImmutable $to): float
    {
        $summary = $this->summary($from, $to);

        return round($summary['net_profit'] + $summary['salary_paid'], 2);
    }

    /**
     * @return array<string, mixed>
     */
    public function campaignProgress(Campaign $campaign): array
    {
        $orders = $campaign->countedOrders()->with('items')->withSum('payments', 'amount')->get();
        $spend = $campaign->countsAllOrders()
            ? (float) CashEntry::where('direction', 'out')
                ->betweenDates($campaign->start_date->toDateString(), $campaign->end_date->toDateString())
                ->get(['direction', 'category', 'amount', 'source'])->filter->isOperatingExpense()->sum('amount')
            : (float) $campaign->cashEntries()->where('direction', 'out')->sum('amount');

        $today = CarbonImmutable::today();
        $start = CarbonImmutable::parse($campaign->start_date);
        $end = CarbonImmutable::parse($campaign->end_date);
        $totalDays = (int) $start->diffInDays($end) + 1;
        $elapsed = (int) max(0, min($totalDays, $start->diffInDays($today, false) + 1));
        $sales = round((float) $orders->sum('total'), 2);
        $target = (float) $campaign->target_sales;
        $daysLeft = $totalDays - $elapsed;

        return [
            'id' => $campaign->id,
            'name' => $campaign->name,
            'type' => $campaign->type,
            'type_label' => Campaign::TYPES[$campaign->type] ?? $campaign->type,
            'start_date' => $campaign->start_date->toDateString(),
            'end_date' => $campaign->end_date->toDateString(),
            'target_sales' => $target,
            'target_orders' => $campaign->target_orders,
            'target_pieces' => $campaign->target_pieces,
            'budget' => (float) $campaign->budget,
            'notes' => $campaign->notes,
            'status' => $today->lessThan($start) ? 'upcoming' : ($today->greaterThan($end) ? 'ended' : 'active'),
            'days_total' => $totalDays,
            'days_elapsed' => $elapsed,
            'days_left' => $daysLeft,
            'sales' => $sales,
            'orders' => $orders->count(),
            'pieces' => $orders->sum(fn (Order $order) => $order->quantity()),
            'collected' => round((float) $orders->sum('payments_sum_amount'), 2),
            'profit' => round($orders->sum(fn (Order $order) => $order->profit()), 2),
            'spend' => round($spend, 2),
            // Straight-line pace: sales so far spread over the whole campaign.
            'projected_sales' => $elapsed > 0 && $daysLeft > 0 ? round($sales / $elapsed * $totalDays, 2) : $sales,
            'needed_per_day' => $daysLeft > 0 && $target > $sales ? round(($target - $sales) / $daysLeft, 2) : 0,
        ];
    }

    /**
     * Figures for the forecast: recent monthly history, this month's pace and money still to come in / go out.
     *
     * @return array<string, mixed>
     */
    public function forecast(): array
    {
        $thisMonth = CarbonImmutable::today()->startOfMonth();

        $history = collect(range(6, 1))->map(function (int $back) use ($thisMonth) {
            $from = $thisMonth->subMonthsNoOverflow($back);
            $summary = $this->summary($from, $from->endOfMonth()->startOfDay());

            return [
                'month' => $from->format('Y-m'),
                'label' => $from->format('M Y'),
                'sales' => $summary['sales'],
                'gross_profit' => $summary['gross_profit'],
                'operating_expenses' => $summary['operating_expenses'],
                'net_profit' => $summary['net_profit'],
                'cash_in' => $summary['cash_in'],
                'cash_out' => $summary['cash_out'],
            ];
        })->values();

        $mtd = $this->summary($thisMonth, CarbonImmutable::today());
        $daysInMonth = $thisMonth->daysInMonth;
        $dayOfMonth = CarbonImmutable::today()->day;

        $active = Order::active()->with('items')->withSum('payments', 'amount')->get();
        $paidPerOrder = CashEntry::where('direction', 'out')->whereIn('order_id', $active->pluck('id'))
            ->get(['order_id', 'category', 'amount'])->groupBy(fn (CashEntry $entry) => $entry->order_id.'|'.$entry->category);
        $paid = fn (Order $order, string $category) => (float) ($paidPerOrder->get($order->id.'|'.$category)?->sum('amount') ?? 0);

        $members = TeamMember::where('active', true)->get();

        return [
            'history' => $history,
            'month_to_date' => [
                'sales' => $mtd['sales'],
                'net_profit' => $mtd['net_profit'],
                'day' => $dayOfMonth,
                'days_in_month' => $daysInMonth,
                'projected_sales' => round($mtd['sales'] / max(1, $dayOfMonth) * $daysInMonth, 2),
            ],
            'pipeline' => [
                'active_orders' => $active->count(),
                'receivable' => round($active->sum(fn (Order $order) => max(0, $order->balance())), 2),
                'kilang_due' => round($active->sum(fn (Order $order) => max(0, $order->cost() - $paid($order, 'kilang'))), 2),
                'postage_due' => round($active->filter->postageEstimated()->sum(fn (Order $order) => $order->postageCost()), 2),
                'commission_due' => round($active->sum(fn (Order $order) => max(0, (float) $order->commission_amount - $paid($order, 'commission'))), 2),
                'payroll_monthly' => round($members->sum(fn (TeamMember $member) => (float) $member->basic_salary + (float) $member->allowance
                    + (float) $member->basic_salary * (float) $member->epf_employer_percent / 100), 2),
            ],
            'cash_balance' => $this->cashBalance(),
        ];
    }

    /** Orders created in the range (not cancelled), with items for cost / profit. */
    private function orders(CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        return Order::notCancelled()->whereBetween('created_at', [$from->startOfDay(), $to->endOfDay()])->with('items')->get();
    }

    /**
     * @param  Collection<int, CashEntry>  $entries
     * @param  array<string, string>  $labels
     * @return list<array{key: string, label: string, amount: float}>
     */
    private function byCategory(Collection $entries, array $labels): array
    {
        return collect($labels)
            ->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label, 'amount' => round((float) $entries->where('category', $key)->sum('amount'), 2)])
            ->filter(fn (array $row) => $row['amount'] > 0)
            ->sortByDesc('amount')
            ->values()
            ->all();
    }
}
