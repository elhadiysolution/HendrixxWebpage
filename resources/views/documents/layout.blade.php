<!DOCTYPE html>
<html lang="ms">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title') - {{ $company['name'] }}</title>
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; color: #12113a; background-color: #FCF9EA; background-image: repeating-linear-gradient(45deg, rgba(3,1,100,.05) 0 1px, transparent 1px 26px), repeating-linear-gradient(-45deg, rgba(3,1,100,.05) 0 1px, transparent 1px 26px); font: 13px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
        .page { max-width: 820px; margin: 24px auto; background: #fff; padding: 40px 44px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
        .toolbar { max-width: 820px; margin: 24px auto 0; display: flex; gap: 8px; justify-content: flex-end; }
        .toolbar button, .toolbar a { background: #030164; color: #FCF9EA; border: 0; border-radius: 6px; padding: 8px 14px; font: inherit; cursor: pointer; text-decoration: none; }
        .toolbar a { background: #fff; color: #030164; border: 1px solid #d9d4bd; }
        .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #030164; padding-bottom: 18px; margin-bottom: 22px; gap: 24px; }
        .brand { display: flex; gap: 12px; align-items: center; }
        .logo { width: 44px; height: 44px; border-radius: 8px; background: #030164; color: #FCF9EA; font-weight: 800; display: grid; place-items: center; letter-spacing: -1px; }
        .brand h1 { margin: 0; font-size: 18px; color: #030164; }
        .muted { color: #64748b; }
        .doc-title { text-align: right; }
        .doc-title h2 { margin: 0; font-size: 22px; letter-spacing: 2px; color: #030164; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 22px; }
        .label { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #64748b; margin-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #475569; background: #FCF9EA; padding: 8px 10px; }
        td { padding: 9px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        .num { text-align: right; white-space: nowrap; }
        .totals { margin-left: auto; width: 300px; margin-top: 14px; }
        .totals td { border: 0; padding: 4px 10px; }
        .totals .grand td { font-size: 15px; font-weight: 700; border-top: 2px solid #030164; padding-top: 8px; }
        .box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; }
        .stamp { display: inline-block; padding: 3px 10px; border-radius: 999px; font-weight: 700; font-size: 11px; }
        .paid { background: #dcfce7; color: #166534; }
        .unpaid { background: #fef3c7; color: #92400e; }
        .foot { margin-top: 28px; font-size: 12px; }
        @media print {
            body { background: #fff; background-image: none; }
            .toolbar { display: none; }
            .page { margin: 0; box-shadow: none; padding: 0; max-width: none; }
            @page { margin: 14mm; }
        }
        @yield('styles')
    </style>
</head>
<body>
    <div class="toolbar">
        @auth
            @hasSection('back')
                @yield('back')
            @else
                <a href="{{ route('orders.show', $order) }}">← Kembali ke order</a>
            @endif
        @endauth
        <button onclick="window.print()">Print / Save PDF</button>
    </div>
    <div class="page">
        <div class="head">
            <div class="brand">
                <div class="logo">HX</div>
                <div>
                    <h1>{{ $company['name'] }}</h1>
                    <div class="muted">
                        @if ($company['registration_no']) ({{ $company['registration_no'] }})<br> @endif
                        {{ $company['address'] }}<br>
                        {{ $company['phone'] }} · {{ $company['email'] }}
                    </div>
                </div>
            </div>
            <div class="doc-title">
                @yield('doc-title')
            </div>
        </div>

        @yield('content')
    </div>
</body>
</html>
