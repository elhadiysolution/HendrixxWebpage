<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Name / number / size list per item, filled at the "Submit Jobsheet ke Kilang" stage.
 * Quantities and prices are fixed by the invoice; this only breaks the pieces down.
 */
class OrderNamesController extends Controller
{
    public function edit(Order $order): Response
    {
        $order->load('items');

        return Inertia::render('orders/names', [
            'order' => [
                ...$order->only(['id', 'order_no', 'title', 'jobsheet_notes']),
                'stage_label' => $order->stage->label(),
                'jobsheet_submitted_at' => $order->jobsheet_submitted_at?->toDateTimeString(),
                'items' => $order->items->reject->isServiceLine()->values()->map(fn (OrderItem $item) => [
                    ...$item->only(['id', 'description', 'fabric', 'quantity']),
                    'spec' => $item->specText(),
                    'sizes' => $item->sizes ?? (object) [],
                    'names' => $item->names ?? [],
                ]),
            ],
            'sizes' => config('hendrixx.sizes'),
            'sizeRates' => array_filter(array_map('floatval', (array) config('hendrixx.size_surcharges', []))),
        ]);
    }

    public function update(Request $request, Order $order): RedirectResponse
    {
        $itemIds = $order->items()->pluck('id');

        $data = $request->validate([
            'jobsheet_notes' => ['nullable', 'string', 'max:10000'],
            'items' => ['array'],
            'items.*.id' => ['required', Rule::in($itemIds)],
            'items.*.sizes' => ['nullable', 'array'],
            'items.*.sizes.*' => ['nullable', 'integer', 'min:0'],
            'items.*.names' => ['nullable', 'array', 'max:2000'],
            'items.*.names.*.name' => ['nullable', 'string', 'max:100'],
            'items.*.names.*.number' => ['nullable', 'string', 'max:10'],
            'items.*.names.*.size' => ['nullable', 'string', 'max:10'],
        ]);

        $previousTotal = (float) $order->total;

        foreach ($data['items'] ?? [] as $row) {
            $names = OrderItem::sortNames($row['names'] ?? []);

            // With a name list, the size breakdown is counted from it.
            $sizes = $names
                ? collect($names)->whereNotNull('size')->countBy('size')->all()
                : array_filter(array_map('intval', $row['sizes'] ?? []));

            OrderItem::whereKey($row['id'])->first()->update(['names' => $names ?: null, 'sizes' => $sizes ?: null]);
        }

        $order->update(['jobsheet_notes' => $data['jobsheet_notes'] ?? null]);
        $order->syncSizeSurcharges();
        $order->log('jobsheet', 'Senarai nama / saiz dikemaskini', $request->user());

        $message = 'Senarai nama & saiz disimpan.';
        if (round($previousTotal, 2) !== round((float) $order->total, 2)) {
            $message .= ' Caj saiz besar dikemaskini: jumlah invoice kini RM '.number_format((float) $order->total, 2).'.';
            if ($order->noteInvoiceChange($previousTotal, $request->user())) {
                $message .= ' Hantar semula invoice kepada customer.';
            }
        }

        return to_route('orders.show', $order)->with('success', $message);
    }
}
