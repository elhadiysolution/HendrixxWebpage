<?php

namespace App\Http\Controllers;

use App\Enums\OrderStage;
use App\Models\CashEntry;
use App\Models\Order;
use App\Support\WorkingDays;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Stage gates and the milestone actions that satisfy them.
 */
class OrderWorkflowController extends Controller
{
    public function advance(Request $request, Order $order): RedirectResponse
    {
        $order->advance($request->user());

        return back()->with('success', "Order kini di peringkat: {$order->stage->label()}");
    }

    public function revert(Request $request, Order $order): RedirectResponse
    {
        Gate::authorize('admin');

        $order->revert($request->user());

        return back()->with('success', "Order diundur ke: {$order->stage->label()}");
    }

    public function cancel(Request $request, Order $order): RedirectResponse
    {
        Gate::authorize('admin');

        if ($order->cancelled_at) {
            $order->forceFill(['cancelled_at' => null, 'cancel_reason' => null])->save();
            $order->log('cancel', 'Order dipulihkan', $request->user());

            return back()->with('success', 'Order dipulihkan dan aktif semula.');
        }

        $reason = $request->validate(['reason' => ['nullable', 'string', 'max:255']])['reason'] ?? null;
        $order->forceFill(['cancelled_at' => now(), 'cancel_reason' => $reason])->save();
        $order->log('cancel', 'Order dibatalkan'.($reason ? ": {$reason}" : ''), $request->user());

        $days = (int) config('hendrixx.cancelled_retention_days');

        return back()->with('success', "Order dibatalkan. Boleh dipulihkan dalam {$days} hari sebelum dipadam kekal.");
    }

    public function invoiceSent(Request $request, Order $order): RedirectResponse
    {
        if ($order->items()->doesntExist()) {
            throw ValidationException::withMessages(['invoice' => 'Isi detail helaian & harga dahulu sebelum hantar invoice.']);
        }

        $order->forceFill(['invoice_sent_at' => now()])->save();
        $order->log('invoice', "Invoice {$order->invoiceNo()} dihantar ke customer", $request->user());

        return back()->with('success', 'Invoice ditanda sebagai dihantar.');
    }

    public function approveDesign(Request $request, Order $order): RedirectResponse
    {
        if (! $order->hasFinalDesign()) {
            throw ValidationException::withMessages(['design' => 'Muat naik design final dahulu.']);
        }

        $order->forceFill(['design_approved_at' => now()])->save();
        $order->log('design', 'Design disahkan oleh customer', $request->user());

        return back()->with('success', 'Design disahkan.');
    }

    public function submitJobsheet(Request $request, Order $order): RedirectResponse
    {
        $this->ensureStage($order, OrderStage::Jobsheet);

        $data = $request->validate(['supplier_ref' => ['nullable', 'string', 'max:255']]);

        if (! $order->load('items')->sizesComplete()) {
            throw ValidationException::withMessages(['jobsheet' => 'Senarai nama / saiz belum lengkap. Isi di page "Senarai nama & saiz" dahulu.']);
        }

        $due = WorkingDays::add(now(), (int) config('hendrixx.production_days'));

        $order->forceFill([
            'jobsheet_submitted_at' => now(),
            'supplier_ref' => $data['supplier_ref'] ?? null,
            'due_date' => $due,
        ])->save();

        $order->log('jobsheet', "Jobsheet dihantar ke kilang. Due: {$due->format('d/m/Y')}", $request->user());

        return back()->with('success', "Jobsheet dihantar. Baju dijangka siap {$due->format('d/m/Y')}.");
    }

    public function receiveProduction(Request $request, Order $order): RedirectResponse
    {
        $this->ensureStage($order, OrderStage::Production);

        $order->forceFill(['production_received_at' => now()])->save();

        $onTime = $order->due_date === null || now()->startOfDay()->lessThanOrEqualTo($order->due_date);
        $order->log('production', 'Baju diterima dari kilang'.($onTime ? ' (on-time)' : ' (LEWAT dari due date)'), $request->user());

        return back()->with('success', 'Baju ditanda siap.');
    }

    /**
     * Mark the order posted / picked up with the actual postage paid. Also used to correct the
     * postage cost later (after completion too); the cash-out record follows the cost.
     */
    public function ship(Request $request, Order $order): RedirectResponse
    {
        if (! in_array($order->stage, [OrderStage::Postage, OrderStage::Completed], true)) {
            $this->ensureStage($order, OrderStage::Postage);
        }

        $data = $request->validate([
            'shipping_method' => ['required', Rule::in(['courier', 'pickup'])],
            'postage_cost' => ['required_if:shipping_method,courier', 'nullable', 'numeric', 'min:0', 'max:100000'],
        ], [], ['postage_cost' => 'kos pos sebenar']);

        $cost = $data['shipping_method'] === 'pickup' ? 0.0 : round((float) $data['postage_cost'], 2);
        $editing = $order->shipped_at !== null;

        DB::transaction(function () use ($order, $data, $cost, $request) {
            $order->forceFill([
                'shipping_method' => $data['shipping_method'],
                'postage_cost' => $cost,
                'shipped_at' => $order->shipped_at ?? now(),
            ])->save();

            // Postage paid is a cash out; it is kept in step with the order and edited only here.
            if ($cost > 0) {
                $order->postageEntry()->updateOrCreate([], [
                    'direction' => 'out',
                    'category' => 'postage',
                    'source' => CashEntry::SOURCE_ORDER_POSTAGE,
                    'amount' => $cost,
                    'entry_date' => $order->shipped_at->toDateString(),
                    'description' => "Pos {$order->order_no} {$order->title}",
                    'user_id' => $request->user()->id,
                ]);
            } else {
                $order->postageEntry()->delete();
            }
        });

        $money = 'RM '.number_format($cost, 2);
        $order->log('postage', match (true) {
            $editing => "Kos pos sebenar dikemaskini: {$money}",
            $data['shipping_method'] === 'pickup' => 'Baju diambil sendiri oleh customer',
            default => "Baju dipos. Kos pos sebenar {$money}",
        }, $request->user());

        return back()->with('success', $editing ? 'Kos pos dikemaskini.' : 'Penghantaran & kos pos direkod.');
    }

    public function trackingSent(Request $request, Order $order): RedirectResponse
    {
        if ($order->shipped_at === null) {
            throw ValidationException::withMessages(['tracking' => 'Rekod baju dipos & kos pos dahulu.']);
        }

        $order->forceFill(['tracking_sent_at' => now()])->save();
        $order->log('postage', $order->shipping_method === 'pickup'
            ? 'Customer dimaklumkan baju sedia diambil'
            : 'No. tracking dihantar ke customer', $request->user());

        return back()->with('success', 'Ditanda sudah dimaklumkan kepada customer.');
    }

    public function feedback(Request $request, Order $order): RedirectResponse
    {
        $data = $request->validate([
            'feedback_rating' => ['required', 'integer', 'between:1,5'],
            'feedback_comment' => ['nullable', 'string', 'max:2000'],
        ]);

        $order->fill($data)->save();
        $order->log('feedback', "Feedback customer: {$data['feedback_rating']}/5", $request->user());

        return back()->with('success', 'Feedback disimpan.');
    }

    private function ensureStage(Order $order, OrderStage $stage): void
    {
        if ($order->stage !== $stage) {
            throw ValidationException::withMessages(['stage' => "Tindakan ini hanya untuk peringkat {$stage->label()}."]);
        }
    }
}
