@extends('documents.layout')

@section('title', 'Jobsheet '.$order->order_no)

@section('styles')
    .sizes th, .sizes td { text-align: center; padding: 6px 4px; border: 1px solid #e2e8f0; }
    .sizes th:first-child, .sizes td:first-child { text-align: left; }
    .designs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 8px; }
    .designs img { width: 100%; border: 1px solid #e2e8f0; border-radius: 6px; }
    .notes { white-space: pre-line; font-family: ui-monospace, Consolas, monospace; font-size: 12px; }
@endsection

@section('doc-title')
    <h2>JOBSHEET</h2>
    <div><strong>{{ $order->order_no }}</strong></div>
    @if ($order->supplier_ref) <div class="muted">Ref kilang: {{ $order->supplier_ref }}</div> @endif
    <div class="muted">Dihantar: {{ ($order->jobsheet_submitted_at ?? now())->format('d/m/Y') }}</div>
    @if ($order->due_date) <div><strong>Due: {{ $order->due_date->format('d/m/Y') }}</strong></div> @endif
@endsection

@section('content')
    <div class="grid">
        <div>
            <div class="label">Projek</div>
            <strong>{{ $order->title }}</strong><br>
            {{ $order->customer->organization ?: $order->customer->name }}
        </div>
        <div>
            <div class="label">Jumlah</div>
            <strong style="font-size:18px">{{ $order->quantity() }} helai</strong>
        </div>
    </div>

    @foreach ($order->items->reject->isServiceLine() as $item)
        <div class="box" style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                <div>
                    <strong>{{ $loop->iteration }}. {{ $item->description }}</strong>
                    <span class="muted"> · Kain: {{ $item->fabric ?: '-' }}</span>
                    @if ($item->specText()) <div>{{ $item->specText() }}</div> @endif
                    @if ($item->addons)
                        <div class="muted">Add-on: {{ \App\Models\AddOn::whereIn('code', $item->addons)->pluck('name')->implode(', ') }}</div>
                    @endif
                    @if ($item->notes) <div class="muted">{{ $item->notes }}</div> @endif
                </div>
                <strong>{{ $item->quantity }} helai</strong>
            </div>
            <table class="sizes">
                <tr>
                    <th>Size</th>
                    @foreach ($sizes as $size) <th>{{ $size }}</th> @endforeach
                    <th>Jumlah</th>
                </tr>
                <tr>
                    <td>Qty</td>
                    @foreach ($sizes as $size) <td>{{ ($item->sizes[$size] ?? 0) ?: '' }}</td> @endforeach
                    <td><strong>{{ $item->sizesTotal() }}</strong></td>
                </tr>
            </table>
            @if ($item->names)
                <table class="sizes" style="margin-top:8px">
                    <tr><th style="width:36px">#</th><th>Nama</th><th>Nombor</th><th>Saiz</th></tr>
                    @foreach ($item->names as $row)
                        <tr>
                            <td>{{ $loop->iteration }}</td>
                            <td>{{ $row['name'] ?? '' }}</td>
                            <td>{{ $row['number'] ?? '' }}</td>
                            <td><strong>{{ $row['size'] ?? '' }}</strong></td>
                        </tr>
                    @endforeach
                </table>
            @endif
        </div>
    @endforeach

    @if ($order->jobsheet_notes)
        <div class="label" style="margin-top:18px">Nota Produksi</div>
        <div class="box notes">{{ $order->jobsheet_notes }}</div>
    @endif

    @php $images = $order->attachments->filter->isImage(); @endphp
    @if ($images->isNotEmpty())
        <div class="label" style="margin-top:18px">Design Final</div>
        <div class="designs">
            @foreach ($images as $image)
                <img src="{{ $image->url() }}" alt="{{ $image->original_name }}">
            @endforeach
        </div>
    @endif
    @foreach ($order->attachments->reject->isImage() as $file)
        <div class="muted">Fail: {{ $file->original_name }} — {{ $file->url() }}</div>
    @endforeach
@endsection
