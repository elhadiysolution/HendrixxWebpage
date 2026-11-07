<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Payslip extends Model
{
    protected $fillable = [
        'team_member_id', 'period', 'basic', 'allowance', 'sales_base', 'commission', 'profit_pool', 'profit_share',
        'epf_employee', 'epf_employer', 'other_deduction', 'net_pay', 'notes', 'paid_on',
    ];

    protected function casts(): array
    {
        return [
            'basic' => 'decimal:2',
            'allowance' => 'decimal:2',
            'sales_base' => 'decimal:2',
            'commission' => 'decimal:2',
            'profit_pool' => 'decimal:2',
            'profit_share' => 'decimal:2',
            'epf_employee' => 'decimal:2',
            'epf_employer' => 'decimal:2',
            'other_deduction' => 'decimal:2',
            'net_pay' => 'decimal:2',
            'paid_on' => 'date',
        ];
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(TeamMember::class, 'team_member_id');
    }

    public function cashEntry(): HasOne
    {
        return $this->hasOne(CashEntry::class);
    }

    public function gross(): float
    {
        return round((float) $this->basic + (float) $this->allowance + (float) $this->commission + (float) $this->profit_share, 2);
    }

    /** What the company spends: gross pay less deductions kept back, plus employer EPF. */
    public function employerCost(): float
    {
        return round($this->gross() - (float) $this->other_deduction + (float) $this->epf_employer, 2);
    }
}
