import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface FinancePeriod {
    type: string;
    ref: string;
    label: string;
    previous: string;
    next: string;
}

/** Bulanan / suku tahun / tahunan tabs plus previous / next arrows, kept as ?period=&ref= in the URL. */
export function FinancePeriodNav({
    url,
    period,
    types,
    query = {},
}: {
    url: string;
    period: FinancePeriod;
    types: Record<string, string>;
    query?: Record<string, string>;
}) {
    const href = (params: Record<string, string>) => `${url}?${new URLSearchParams({ ...query, ...params })}`;

    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="bg-muted flex rounded-md p-0.5">
                {Object.entries(types).map(([value, label]) => (
                    <Link
                        key={value}
                        href={href({ period: value })}
                        preserveScroll
                        className={cn(
                            'rounded px-3 py-1 text-sm',
                            period.type === value ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-background',
                        )}
                    >
                        {label}
                    </Link>
                ))}
            </div>
            <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" asChild aria-label="Sebelum">
                    <Link href={href({ period: period.type, ref: period.previous })} preserveScroll>
                        <ChevronLeft />
                    </Link>
                </Button>
                <span className="min-w-36 text-center text-sm font-medium">{period.label}</span>
                <Button variant="outline" size="icon" asChild aria-label="Seterusnya">
                    <Link href={href({ period: period.type, ref: period.next })} preserveScroll>
                        <ChevronRight />
                    </Link>
                </Button>
            </div>
        </div>
    );
}

/** % change vs a previous value, or null when there is nothing to compare with. */
export function percentChange(current: number, previous: number): number | null {
    return previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : null;
}
