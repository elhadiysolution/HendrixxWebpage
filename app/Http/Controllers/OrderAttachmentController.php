<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderAttachment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OrderAttachmentController extends Controller
{
    public function store(Request $request, Order $order): RedirectResponse
    {
        $data = $request->validate([
            'kind' => ['required', Rule::in(array_keys(OrderAttachment::KINDS))],
            'files' => ['required', 'array', 'min:1', 'max:10'],
            'files.*' => ['file', 'mimes:jpg,jpeg,png,webp,gif,pdf,ai,psd,eps,svg,zip,rar,cdr', 'max:30720'],
        ]);

        foreach ($request->file('files') as $file) {
            $order->attachments()->create([
                'kind' => $data['kind'],
                'path' => $file->store("orders/{$order->id}/files", 'public'),
                'original_name' => $file->getClientOriginalName(),
                'size' => $file->getSize(),
                'user_id' => $request->user()->id,
            ]);
        }

        $count = count($request->file('files'));
        $order->log('file', "{$count} fail dimuat naik (".OrderAttachment::KINDS[$data['kind']].')', $request->user());

        return back()->with('success', 'Fail dimuat naik.');
    }

    public function destroy(Request $request, Order $order, OrderAttachment $attachment): RedirectResponse
    {
        abort_unless($attachment->order_id === $order->id, 404);

        $attachment->delete();
        $order->log('file', "Fail {$attachment->original_name} dipadam", $request->user());

        return back()->with('success', 'Fail dipadam.');
    }
}
