<?php

namespace App\Http\Controllers\Finance;

use App\Http\Controllers\Controller;
use App\Models\CashEntry;
use App\Models\Payment;
use App\Services\Finance\Finance;
use App\Support\FinancePeriod;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function index(Request $request, Finance $finance): Response
    {
        $period = FinancePeriod::make($request->input('period'), $request->input('ref'));
        $previous = FinancePeriod::make($period->type, $period->previous());

        return Inertia::render('finance/report', [
            'period' => $this->periodProps($period),
            'periodTypes' => FinancePeriod::TYPES,
            'summary' => $finance->summary($period->from, $period->to),
            'previous' => collect($finance->summary($previous->from, $previous->to))
                ->only(['sales', 'gross_profit', 'net_profit', 'cash_in', 'cash_out', 'net_cash', 'orders', 'pieces']),
            'buckets' => collect($period->buckets())->map(function (array $bucket) use ($finance) {
                $summary = $finance->summary($bucket['from'], $bucket['to']);

                return [
                    'label' => $bucket['label'],
                    ...collect($summary)->only(['sales', 'orders', 'pieces', 'gross_profit', 'net_profit', 'cash_in', 'cash_out', 'net_cash'])->all(),
                ];
            }),
            'breakdown' => $finance->salesBreakdown($period->from, $period->to),
            'cashBalance' => $finance->cashBalance(),
        ]);
    }

    /** Every cash movement in the period as CSV (opens in Excel / Google Sheets). */
    public function export(Request $request): StreamedResponse
    {
        $period = FinancePeriod::make($request->input('period'), $request->input('ref'));
        [$from, $to] = [$period->from->toDateString(), $period->to->toDateString()];

        $rows = Payment::with('order.customer')->whereBetween('paid_on', [$from, $to])->get()
            ->map(fn (Payment $payment) => [
                $payment->paid_on->toDateString(), 'Masuk', 'Bayaran order', $payment->order?->order_no.' '.$payment->order?->title,
                $payment->order?->customer?->name, Payment::METHODS[$payment->method] ?? $payment->method, $payment->reference, (float) $payment->amount,
            ])
            ->concat(CashEntry::with('order')->betweenDates($from, $to)->get()->map(fn (CashEntry $entry) => [
                $entry->entry_date->toDateString(), $entry->direction === 'in' ? 'Masuk' : 'Keluar', $entry->categoryLabel(),
                trim($entry->description.' '.($entry->order ? "({$entry->order->order_no})" : '')),
                $entry->party, $entry->method, $entry->reference, ($entry->direction === 'in' ? 1 : -1) * (float) $entry->amount,
            ]))
            ->sortBy(0)
            ->values();

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // UTF-8 BOM so Excel reads Malay text correctly
            fputcsv($out, ['Tarikh', 'Jenis', 'Kategori', 'Keterangan', 'Pihak', 'Kaedah', 'Rujukan', 'Amaun (RM)']);
            $rows->each(fn (array $row) => fputcsv($out, $row));
            fputcsv($out, ['', '', '', '', '', '', 'Bersih', round($rows->sum(7), 2)]);
            fclose($out);
        }, "kewangan-{$period->ref()}.csv", ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * @return array<string, string>
     */
    private function periodProps(FinancePeriod $period): array
    {
        return [
            'type' => $period->type,
            'ref' => $period->ref(),
            'label' => $period->label(),
            'previous' => $period->previous(),
            'next' => $period->next(),
            'from' => $period->from->toDateString(),
            'to' => $period->to->toDateString(),
        ];
    }
}
