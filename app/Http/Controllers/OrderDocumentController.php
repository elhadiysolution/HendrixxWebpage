<?php

namespace App\Http\Controllers;

use App\Models\Order;
use Illuminate\View\View;

/**
 * Printable invoice and jobsheet (use the browser's "Save as PDF").
 */
class OrderDocumentController extends Controller
{
    public function invoice(Order $order): View
    {
        return $this->renderInvoice($order);
    }

    public function publicInvoice(string $token): View
    {
        return $this->renderInvoice(Order::where('public_token', $token)->firstOrFail());
    }

    public function jobsheet(Order $order): View
    {
        $order->load(['customer', 'items', 'attachments' => fn ($query) => $query->where('kind', 'design_final')]);

        return view('documents.jobsheet', [
            'order' => $order,
            'company' => config('hendrixx.company'),
            'sizes' => config('hendrixx.sizes'),
        ]);
    }

    private function renderInvoice(Order $order): View
    {
        $order->load(['customer', 'items', 'payments']);

        return view('documents.invoice', [
            'order' => $order,
            'company' => config('hendrixx.company'),
        ]);
    }
}
