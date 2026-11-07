@extends('documents.layout')

@php
    $rm = fn ($value) => 'RM '.number_format((float) $value, 2);
    $paid = $order->amountPaid();
    $balance = $order->balance();
@endphp

@section('title', $order->invoiceNo())

@section('doc-title')
    <h2>INVOICE</h2>
    <div><strong>{{ $order->invoiceNo() }}</strong></div>
    <div class="muted">Tarikh: {{ $order->created_at->format('d/m/Y') }}</div>
    <div style="margin-top:6px">
        <span class="stamp {{ $balance <= 0 ? 'paid' : 'unpaid' }}">{{ $balance <= 0 ? 'PAID' : ($paid > 0 ? 'DEPOSIT PAID' : 'UNPAID') }}</span>
    </div>
@endsection

@section('content')
    <div class="grid">
        <div>
            <div class="label">Bill To</div>
            <strong>{{ $order->customer->name }}</strong><br>
            @if ($order->customer->organization) {{ $order->customer->organization }}<br> @endif
            {{ $order->customer->phone }}<br>
            @if ($order->customer->email) {{ $order->customer->email }}<br> @endif
            @if ($order->customer->state) {{ $order->customer->state }}<br> @endif
            @if ($order->customer->address) <span style="white-space:pre-line">{{ $order->customer->address }}</span> @endif
        </div>
        <div>
            <div class="label">Projek</div>
            <strong>{{ $order->title }}</strong><br>
            Order No: {{ $order->order_no }}<br>
            @if ($order->required_by) Tarikh diperlukan: {{ $order->required_by->format('d/m/Y') }} @endif
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width:36px">#</th>
                <th>Item</th>
                <th class="num">Kuantiti</th>
                <th class="num">Harga Seunit</th>
                <th class="num">Jumlah</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($order->items as $item)
                <tr>
                    <td>{{ $loop->iteration }}</td>
                    <td>
                        <strong>{{ $item->description }}</strong>
                        @if ($item->fabric) <div class="muted">Kain: {{ $item->fabric }}</div> @endif
                        @if ($item->specText()) <div class="muted">{{ $item->specText() }}</div> @endif
                        @if ($item->notes) <div class="muted">{{ $item->notes }}</div> @endif
                    </td>
                    <td class="num">{{ $item->quantity }} helai</td>
                    <td class="num">{{ $rm($item->unit_price) }}</td>
                    <td class="num">{{ $rm($item->lineTotal()) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <table class="totals">
        <tr><td>Subtotal</td><td class="num">{{ $rm($order->subtotal) }}</td></tr>
        @if ((float) $order->discount > 0)
            <tr><td>Diskaun</td><td class="num">- {{ $rm($order->discount) }}</td></tr>
        @endif
        @if ((float) $order->shipping_fee > 0)
            <tr><td>Penghantaran</td><td class="num">{{ $rm($order->shipping_fee) }}</td></tr>
        @endif
        <tr class="grand"><td>JUMLAH</td><td class="num">{{ $rm($order->total) }}</td></tr>
        <tr><td>Deposit diperlukan</td><td class="num">{{ $rm($order->deposit_required) }}</td></tr>
        <tr><td>Telah dibayar</td><td class="num">{{ $rm($paid) }}</td></tr>
        <tr><td><strong>Baki</strong></td><td class="num"><strong>{{ $rm(max(0, $balance)) }}</strong></td></tr>
    </table>

    @if ($order->payments->isNotEmpty())
        <div class="label" style="margin-top:20px">Rekod Bayaran</div>
        <table>
            @foreach ($order->payments as $payment)
                <tr>
                    <td>{{ $payment->paid_on->format('d/m/Y') }}</td>
                    <td>{{ \App\Models\Payment::TYPES[$payment->type] ?? $payment->type }}</td>
                    <td>{{ $payment->reference }}</td>
                    <td class="num">{{ $rm($payment->amount) }}</td>
                </tr>
            @endforeach
        </table>
    @endif

    <div class="grid foot">
        <div class="box">
            <div class="label">Maklumat Bayaran</div>
            {{ $company['bank_name'] }}<br>
            <strong>{{ $company['bank_account'] }}</strong><br>
            {{ $company['bank_holder'] }}<br>
            <span class="muted">Rujukan: {{ $order->order_no }}</span>
        </div>
        <div class="box">
            <div class="label">Terma</div>
            1. Deposit {{ config('hendrixx.deposit_percent') }}% diperlukan sebelum proses design & produksi bermula.<br>
            2. Tempoh produksi {{ config('hendrixx.production_days') }} hari bekerja selepas design disahkan.<br>
            3. Baki perlu dijelaskan sebelum penghantaran.
        </div>
    </div>
@endsection
