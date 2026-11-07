<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Payment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class PaymentController extends Controller
{
    public function store(Request $request, Order $order): RedirectResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(array_keys(Payment::TYPES))],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'method' => ['nullable', Rule::in(array_keys(Payment::METHODS))],
            'reference' => ['nullable', 'string', 'max:255'],
            'paid_on' => ['required', 'date'],
            'proof' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
        ]);

        $payment = $order->payments()->create([
            ...collect($data)->except('proof')->all(),
            'user_id' => $request->user()->id,
            'proof_path' => $request->file('proof')?->store("orders/{$order->id}/payments", 'public'),
        ]);

        $order->log('payment', sprintf('%s diterima: RM %s', Payment::TYPES[$payment->type], number_format((float) $payment->amount, 2)), $request->user());

        return back()->with('success', 'Bayaran direkod.');
    }

    public function destroy(Request $request, Order $order, Payment $payment): RedirectResponse
    {
        Gate::authorize('admin');
        abort_unless($payment->order_id === $order->id, 404);

        if ($payment->proof_path) {
            Storage::disk('public')->delete($payment->proof_path);
        }

        $payment->delete();
        $order->log('payment', sprintf('Rekod bayaran RM %s dipadam', number_format((float) $payment->amount, 2)), $request->user());

        return back()->with('success', 'Rekod bayaran dipadam.');
    }
}
