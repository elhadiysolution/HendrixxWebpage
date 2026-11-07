<?php

namespace App\Http\Controllers;

use App\Enums\OrderStage;
use App\Models\Order;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Public order tracking: customer enters order no + phone number.
 */
class TrackingController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $orderNo = strtoupper(trim((string) $request->input('order_no')));
        $phone = preg_replace('/\D+/', '', (string) $request->input('phone'));
        $result = null;
        $notFound = false;

        if ($orderNo !== '' && $phone !== '') {
            $order = Order::with(['customer', 'items'])->where('order_no', $orderNo)->first();
            $matches = $order && str_ends_with(preg_replace('/\D+/', '', $order->customer->phone), substr($phone, -8));

            if ($matches && strlen($phone) >= 8) {
                $result = [
                    'order_no' => $order->order_no,
                    'title' => $order->title,
                    'quantity' => $order->quantity(),
                    'stage' => $order->stage->value,
                    'cancelled' => $order->cancelled_at !== null,
                    'due_date' => $order->due_date?->toDateString(),
                    'estimated_ship_date' => $order->projectedShipDate()?->toDateString(),
                    'shipping_method' => $order->shipping_method,
                    'courier' => $order->courier,
                    'tracking_no' => $order->tracking_no,
                    'shipped_at' => $order->shipped_at?->toDateString(),
                    'invoice_url' => route('invoice.public', $order->public_token),
                ];
            } else {
                $notFound = true;
            }
        }

        return Inertia::render('track', [
            'query' => ['order_no' => $orderNo, 'phone' => (string) $request->input('phone')],
            'result' => $result,
            'notFound' => $notFound,
            'stages' => OrderStage::options(),
        ]);
    }
}
