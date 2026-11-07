<?php

namespace App\Http\Controllers;

use App\Models\Inquiry;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class InquiryController extends Controller
{
    public function index(Request $request): Response
    {
        $status = $request->input('status', 'open');

        $inquiries = Inquiry::query()
            ->with('order:id,inquiry_id,order_no')
            ->when($status === 'open', fn ($query) => $query->whereIn('status', ['new', 'contacted']))
            ->when(array_key_exists($status, Inquiry::STATUSES), fn ($query) => $query->where('status', $status))
            ->latest()
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Inquiry $inquiry) => [
                ...$inquiry->only(['id', 'name', 'phone', 'email', 'organization', 'product', 'quantity', 'message', 'status']),
                'required_by' => $inquiry->required_by?->toDateString(),
                'created_at' => $inquiry->created_at->toDateTimeString(),
                'order' => $inquiry->order?->only(['id', 'order_no']),
            ]);

        return Inertia::render('inquiries/index', [
            'inquiries' => $inquiries,
            'statuses' => Inquiry::STATUSES,
            'filters' => ['status' => $status],
        ]);
    }

    /**
     * Public quote request from the sales page.
     */
    public function store(Request $request): RedirectResponse
    {
        Inquiry::create($request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'organization' => ['nullable', 'string', 'max:255'],
            'product' => ['nullable', 'string', 'max:255'],
            'quantity' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'required_by' => ['nullable', 'date', 'after_or_equal:today'],
            'message' => ['nullable', 'string', 'max:3000'],
        ]));

        return back()->with('success', 'Terima kasih! Team kami akan hubungi anda secepat mungkin.');
    }

    public function update(Request $request, Inquiry $inquiry): RedirectResponse
    {
        $inquiry->update($request->validate([
            'status' => ['required', Rule::in(array_keys(Inquiry::STATUSES))],
        ]));

        return back()->with('success', 'Status inquiry dikemaskini.');
    }
}
