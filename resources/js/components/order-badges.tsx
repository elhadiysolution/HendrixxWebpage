import { shortDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type OrderSummary, type StageValue } from '@/types';
import { AlertTriangle, Clock } from 'lucide-react';

export const stageStyles: Record<StageValue, string> = {
    order: 'bg-slate-100 text-slate-700',
    design: 'bg-violet-100 text-violet-700',
    jobsheet: 'bg-amber-100 text-amber-800',
    production: 'bg-sky-100 text-sky-800',
    postage: 'bg-teal-100 text-teal-800',
    completed: 'bg-emerald-100 text-emerald-800',
};

export function StageBadge({ stage, label, className }: { stage: StageValue; label: string; className?: string }) {
    return (
        <span
            className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', stageStyles[stage], className)}
        >
            {label}
        </span>
    );
}

/** Late / at-risk flags: always icon + text, never colour alone. */
export function RiskBadges({ order }: { order: Pick<OrderSummary, 'is_late' | 'is_at_risk' | 'cancelled'> & { purge_at?: string | null } }) {
    return (
        <>
            {order.cancelled && (
                <span className="inline-flex items-center rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-700">
                    Batal{order.purge_at && ` · padam ${shortDate(order.purge_at)}`}
                </span>
            )}
            {order.is_late && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    <Clock className="size-3" /> Lewat
                </span>
            )}
            {order.is_at_risk && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                    <AlertTriangle className="size-3" /> Risiko lewat
                </span>
            )}
        </>
    );
}
