@extends('documents.layout')

@php
    $rm = fn ($value) => 'RM '.number_format((float) $value, 2);
    $member = $payslip->member;
    $deductions = (float) $payslip->epf_employee + (float) $payslip->other_deduction;
@endphp

@section('title', 'Slip Gaji '.$member->name.' '.$month)

@section('back')
    <a href="{{ route('finance.payroll.index', ['month' => $payslip->period]) }}">← Kembali ke Gaji</a>
@endsection

@section('doc-title')
    <h2>SLIP GAJI</h2>
    <div><strong>{{ $month }}</strong></div>
    <div style="margin-top:6px">
        <span class="stamp {{ $payslip->paid_on ? 'paid' : 'unpaid' }}">{{ $payslip->paid_on ? 'DIBAYAR '.$payslip->paid_on->format('d/m/Y') : 'DRAF' }}</span>
    </div>
@endsection

@section('content')
    <div class="grid">
        <div>
            <div class="label">Nama</div>
            <strong>{{ $member->name }}</strong><br>
            @if ($member->position) {{ $member->position }}<br> @endif
            @if ($member->bank_account) <span class="muted">Akaun: {{ $member->bank_account }}</span> @endif
        </div>
        <div>
            <div class="label">Tempoh</div>
            {{ $month }}
        </div>
    </div>

    <div class="grid">
        <table>
            <thead><tr><th>Pendapatan</th><th class="num">RM</th></tr></thead>
            <tbody>
                <tr><td>Gaji pokok</td><td class="num">{{ $rm($payslip->basic) }}</td></tr>
                @if ((float) $payslip->allowance > 0)
                    <tr><td>Elaun</td><td class="num">{{ $rm($payslip->allowance) }}</td></tr>
                @endif
                @if ((float) $payslip->commission > 0)
                    <tr><td>Komisen</td><td class="num">{{ $rm($payslip->commission) }}</td></tr>
                @endif
                @if ((float) $payslip->profit_share > 0)
                    <tr><td>Bahagian untung</td><td class="num">{{ $rm($payslip->profit_share) }}</td></tr>
                @endif
                <tr><td><strong>Jumlah pendapatan</strong></td><td class="num"><strong>{{ $rm($payslip->gross()) }}</strong></td></tr>
            </tbody>
        </table>
        <table>
            <thead><tr><th>Potongan</th><th class="num">RM</th></tr></thead>
            <tbody>
                <tr><td>KWSP (pekerja)</td><td class="num">{{ $rm($payslip->epf_employee) }}</td></tr>
                @if ((float) $payslip->other_deduction > 0)
                    <tr><td>Potongan lain</td><td class="num">{{ $rm($payslip->other_deduction) }}</td></tr>
                @endif
                <tr><td><strong>Jumlah potongan</strong></td><td class="num"><strong>{{ $rm($deductions) }}</strong></td></tr>
            </tbody>
        </table>
    </div>

    <table class="totals">
        <tr class="grand"><td>GAJI BERSIH</td><td class="num">{{ $rm($payslip->net_pay) }}</td></tr>
        <tr><td class="muted">KWSP (majikan)</td><td class="num muted">{{ $rm($payslip->epf_employer) }}</td></tr>
    </table>

    @if ($payslip->notes)
        <div class="box foot"><div class="label">Catatan</div>{{ $payslip->notes }}</div>
    @endif
@endsection
