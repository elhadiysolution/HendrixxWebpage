import { rm } from '@/lib/format';
import { useState } from 'react';

/** Colour-blind-safe pair (validated against the card surface): blue = money in / actual, orange = money out / projected. */
export const SERIES_COLORS = { in: '#2f4fb8', out: '#d0661a' };

export interface ChartSeries {
    key: string;
    label: string;
    color: string;
    /** Draw as a hatched bar, e.g. for projected values. */
    hatched?: boolean;
}

type Row = { label: string };

function niceMax(value: number) {
    if (value <= 0) return 1000;
    const step = Math.pow(10, Math.floor(Math.log10(value)));
    return Math.ceil(value / step) * step;
}

function short(value: number) {
    return value >= 1000 ? `${+(value / 1000).toFixed(1)}k` : String(value);
}

/**
 * Grouped bar chart (one bar per series per row) with a legend and a hover tooltip.
 * Missing or null values are skipped, so a series can cover only some rows.
 */
export function GroupedBarChart<T extends Row>({ rows, series, extra }: { rows: T[]; series: ChartSeries[]; extra?: (row: T) => React.ReactNode }) {
    const get = (row: T, key: string) => (row as unknown as Record<string, number | null | undefined>)[key];
    const [hover, setHover] = useState<number | null>(null);
    const max = niceMax(Math.max(0, ...rows.flatMap((row) => series.map((s) => Number(get(row, s.key) ?? 0)))));
    const ticks = [0, 0.5, 1].map((ratio) => max * ratio);

    return (
        <div>
            {series.length > 1 && (
                <div className="text-muted-foreground mb-3 flex flex-wrap gap-4 text-xs">
                    {series.map((s) => (
                        <span key={s.key} className="inline-flex items-center gap-1.5">
                            <span className="size-2.5 rounded-sm" style={swatch(s)} />
                            {s.label}
                        </span>
                    ))}
                </div>
            )}
            <div className="grid grid-cols-[auto_1fr] gap-3">
                <div className="text-muted-foreground flex h-52 flex-col-reverse justify-between text-right text-xs tabular-nums">
                    {ticks.map((tick) => (
                        <span key={tick}>{short(tick)}</span>
                    ))}
                </div>
                <div className="relative h-52 border-b">
                    {ticks.slice(1).map((tick) => (
                        <div
                            key={tick}
                            className="border-border/60 absolute inset-x-0 border-t border-dashed"
                            style={{ bottom: `${(tick / max) * 100}%` }}
                        />
                    ))}
                    <div className="absolute inset-0 flex items-end gap-2">
                        {rows.map((row, index) => (
                            <div
                                key={row.label}
                                className="relative flex h-full flex-1 items-end justify-center gap-[2px]"
                                onMouseEnter={() => setHover(index)}
                                onMouseLeave={() => setHover(null)}
                            >
                                {series.map((s) => {
                                    const value = get(row, s.key);
                                    if (value === null || value === undefined) return null;
                                    return (
                                        <div
                                            key={s.key}
                                            className={
                                                'w-full max-w-7 rounded-t transition-opacity ' +
                                                (hover !== null && hover !== index ? 'opacity-40' : '')
                                            }
                                            style={{
                                                ...swatch(s),
                                                height: `${(Math.max(0, Number(value)) / max) * 100}%`,
                                                minHeight: Number(value) > 0 ? 2 : 0,
                                            }}
                                        />
                                    );
                                })}
                                {hover === index && (
                                    <div className="bg-popover text-popover-foreground absolute bottom-full z-10 mb-1 rounded-md border px-3 py-2 text-xs whitespace-nowrap shadow-md">
                                        <div className="mb-1 font-medium">{row.label}</div>
                                        {series.map((s) =>
                                            get(row, s.key) == null ? null : (
                                                <div key={s.key} className="flex items-center gap-1.5">
                                                    <span className="size-2 rounded-sm" style={swatch(s)} />
                                                    {s.label}: <span className="font-medium tabular-nums">{rm(Number(get(row, s.key)), 0)}</span>
                                                </div>
                                            ),
                                        )}
                                        {extra?.(row)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                <div />
                <div className="text-muted-foreground flex gap-2 text-center text-xs">
                    {rows.map((row) => (
                        <span key={row.label} className="flex-1 truncate">
                            {row.label}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

function swatch(series: ChartSeries): React.CSSProperties {
    return series.hatched
        ? {
              backgroundImage: `repeating-linear-gradient(45deg, ${series.color} 0 3px, transparent 3px 6px)`,
              boxShadow: `inset 0 0 0 1.5px ${series.color}`,
          }
        : { backgroundColor: series.color };
}
