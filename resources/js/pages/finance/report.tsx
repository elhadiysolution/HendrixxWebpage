import { GroupedBarChart, SERIES_COLORS } from '@/components/finance-chart';
import { type FinancePeriod, FinancePeriodNav, percentChange } from '@/components/finance-period-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { rm } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ArrowDownRight, ArrowUpRight, Download, Wallet } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Kewangan', href: '/finance' }];

interface CategoryAmount {
    key: string;
    label: string;
    amount: number;
}

interface Summary {
    sales: number;
    orders: number;
    pieces: number;
    cost_estimate: number;
    commission: number;
    postage_cost: number;
    postage_estimated: number;
    gross_profit: number;
    other_income: number;
    operating_expenses: number;
    operating_by_category: CategoryAmount[];
    net_profit: number;
    collected: number;
    cash_in: number;
    cash_out: number;
    net_cash: number;
    kilang_paid: number;
    salary_paid: number;
    cash_in_by_category: CategoryAmount[];
    cash_out_by_category: CategoryAmount[];
}

interface Bucket {
    label: string;
    sales: number;
    orders: number;
    pieces: number;
    gross_profit: number;
    net_profit: number;
    cash_in: number;
    cash_out: number;
    net_cash: number;
}

interface GroupRow {
    name: string;
    orders: number;
    pieces: number;
    sales: number;
    profit: number;
}

interface Props {
    period: FinancePeriod & { from: string; to: string };
    periodTypes: Record<string, string>;
    summary: Summary;
    previous: Pick<Summary, 'sales' | 'gross_profit' | 'net_profit' | 'cash_in' | 'cash_out' | 'net_cash' | 'orders' | 'pieces'>;
    buckets: Bucket[];
    breakdown: { by_staff: GroupRow[]; by_agent: GroupRow[]; by_campaign: GroupRow[]; top_customers: GroupRow[] };
    cashBalance: number;
}

const previousLabel: Record<string, string> = { month: 'bulan lepas', quarter: 'suku lepas', year: 'tahun lepas' };

export default function FinanceReport({ period, periodTypes, summary, previous, buckets, breakdown, cashBalance }: Props) {
    const vs = previousLabel[period.type];
    const margin = summary.sales > 0 ? (summary.net_profit / summary.sales) * 100 : null;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Laporan Kewangan" />
            <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-primary text-xl font-semibold">Laporan Kewangan</h1>
                        <p className="text-muted-foreground text-sm">Jualan, untung dan aliran tunai syarikat.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            href="/finance/cash"
                            className="bg-card hover:bg-accent inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                            title="Baki permulaan + semua cash in - semua cash out"
                        >
                            <Wallet className="size-4" /> Baki tunai:{' '}
                            <span className={cn('font-semibold tabular-nums', cashBalance < 0 && 'text-red-700')}>{rm(cashBalance)}</span>
                        </Link>
                        <Button variant="outline" asChild>
                            <a href={`/finance/export?period=${period.type}&ref=${period.ref}`}>
                                <Download /> Export CSV
                            </a>
                        </Button>
                    </div>
                </div>

                <FinancePeriodNav url="/finance" period={period} types={periodTypes} />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    <StatTile label="Jualan" value={rm(summary.sales, 0)} change={percentChange(summary.sales, previous.sales)} vs={vs}>
                        {summary.orders} order
                    </StatTile>
                    <StatTile
                        label="Helai dijual"
                        value={`${summary.pieces.toLocaleString('en-MY')} pcs`}
                        change={percentChange(summary.pieces, previous.pieces)}
                        vs={vs}
                    >
                        {summary.pieces > 0
                            ? `Purata ${rm(summary.sales / summary.pieces)} · untung ${rm(summary.gross_profit / summary.pieces)} / pcs`
                            : 'Tiada helai'}
                    </StatTile>
                    <StatTile
                        label="Untung bersih keseluruhan"
                        value={rm(summary.net_profit, 0)}
                        change={percentChange(summary.net_profit, previous.net_profit)}
                        vs={vs}
                        negative={summary.net_profit < 0}
                    >
                        {margin === null ? 'Tiada jualan' : `Margin ${margin.toFixed(1)}%`}
                    </StatTile>
                    <StatTile label="Cash in" value={rm(summary.cash_in, 0)} change={percentChange(summary.cash_in, previous.cash_in)} vs={vs}>
                        Kutipan order {rm(summary.collected, 0)}
                    </StatTile>
                    <StatTile
                        label="Cash out"
                        value={rm(summary.cash_out, 0)}
                        change={percentChange(summary.cash_out, previous.cash_out)}
                        vs={vs}
                        inverse
                    >
                        Bersih{' '}
                        <span className={cn('font-medium', summary.net_cash < 0 ? 'text-red-700' : 'text-emerald-700')}>
                            {summary.net_cash >= 0 ? '+' : ''}
                            {rm(summary.net_cash, 0)}
                        </span>
                    </StatTile>
                </div>

                <div className="grid gap-4 lg:grid-cols-5">
                    <Card className="lg:col-span-3">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Cash in vs cash out</CardTitle>
                            <CardDescription>
                                {period.type === 'month' ? 'Ikut minggu.' : 'Ikut bulan.'} Hover untuk lihat jualan & untung.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <GroupedBarChart
                                rows={buckets}
                                series={[
                                    { key: 'cash_in', label: 'Cash in', color: SERIES_COLORS.in },
                                    { key: 'cash_out', label: 'Cash out', color: SERIES_COLORS.out },
                                ]}
                                extra={(row) => (
                                    <div className="text-muted-foreground mt-1 border-t pt-1">
                                        Jualan {rm(row.sales, 0)} · {row.pieces} pcs · Untung {rm(row.net_profit, 0)}
                                    </div>
                                )}
                            />
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Untung rugi</CardTitle>
                            <CardDescription>Jualan ikut tarikh order. Kos tambahan ikut tarikh bayar.</CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm">
                            <PnlLine label="Jualan (termasuk caj pos)" value={summary.sales} />
                            <PnlLine label="Kos baju (pricelist)" value={-summary.cost_estimate} />
                            <PnlLine label="Komisen ejen" value={-summary.commission} />
                            <PnlLine label="Kos pos sebenar" value={-summary.postage_cost} />
                            <PnlLine label="Untung bersih order" value={summary.gross_profit} total />
                            {summary.other_income > 0 && <PnlLine label="Pendapatan lain" value={summary.other_income} />}
                            <PnlLine label="Kos tambahan" value={-summary.operating_expenses} />
                            {summary.operating_by_category.map((row) => (
                                <PnlLine key={row.key} label={row.label} value={-row.amount} sub />
                            ))}
                            <PnlLine label="Untung bersih keseluruhan" value={summary.net_profit} total strong />
                            <div className="text-muted-foreground mt-3 space-y-1 text-xs">
                                {summary.postage_estimated > 0 && (
                                    <p>{summary.postage_estimated} order belum dipos: kos pos dianggar sama dengan caj pos kepada customer.</p>
                                )}
                                <p>
                                    Kilang dibayar tempoh ini: {rm(summary.kilang_paid)} (kos baju ikut pricelist: {rm(summary.cost_estimate)}).
                                    Bayaran kilang, komisen dan pos order tidak ditolak dua kali dalam kos tambahan.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <CategoryCard title="Cash in ikut sumber" rows={summary.cash_in_by_category} total={summary.cash_in} color={SERIES_COLORS.in} />
                    <CategoryCard
                        title="Cash out ikut kategori"
                        rows={summary.cash_out_by_category}
                        total={summary.cash_out}
                        color={SERIES_COLORS.out}
                    />
                </div>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Pecahan {period.type === 'month' ? 'mingguan' : 'bulanan'}</CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-muted-foreground border-b text-left text-xs">
                                    <th className="py-2 pr-3 font-medium">Tempoh</th>
                                    <th className="py-2 pr-3 text-right font-medium">Order</th>
                                    <th className="py-2 pr-3 text-right font-medium">Pcs</th>
                                    <th className="py-2 pr-3 text-right font-medium">Jualan</th>
                                    <th className="py-2 pr-3 text-right font-medium">Untung bersih</th>
                                    <th className="py-2 pr-3 text-right font-medium">Cash in</th>
                                    <th className="py-2 pr-3 text-right font-medium">Cash out</th>
                                    <th className="py-2 text-right font-medium">Bersih</th>
                                </tr>
                            </thead>
                            <tbody className="tabular-nums">
                                {buckets.map((row) => (
                                    <tr key={row.label} className="border-b last:border-0">
                                        <td className="py-2 pr-3">{row.label}</td>
                                        <td className="py-2 pr-3 text-right">{row.orders}</td>
                                        <td className="py-2 pr-3 text-right">{row.pieces}</td>
                                        <td className="py-2 pr-3 text-right">{rm(row.sales)}</td>
                                        <td className={cn('py-2 pr-3 text-right', row.net_profit < 0 && 'text-red-700')}>{rm(row.net_profit)}</td>
                                        <td className="py-2 pr-3 text-right">{rm(row.cash_in)}</td>
                                        <td className="py-2 pr-3 text-right">{rm(row.cash_out)}</td>
                                        <td className={cn('py-2 text-right font-medium', row.net_cash < 0 && 'text-red-700')}>{rm(row.net_cash)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="tabular-nums">
                                <tr className="border-t-2 font-semibold">
                                    <td className="py-2 pr-3">Jumlah</td>
                                    <td className="py-2 pr-3 text-right">{summary.orders}</td>
                                    <td className="py-2 pr-3 text-right">{summary.pieces}</td>
                                    <td className="py-2 pr-3 text-right">{rm(summary.sales)}</td>
                                    <td className="py-2 pr-3 text-right">{rm(summary.net_profit)}</td>
                                    <td className="py-2 pr-3 text-right">{rm(summary.cash_in)}</td>
                                    <td className="py-2 pr-3 text-right">{rm(summary.cash_out)}</td>
                                    <td className="py-2 text-right">{rm(summary.net_cash)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2">
                    <GroupCard title="Jualan ikut sales PIC" rows={breakdown.by_staff} />
                    <GroupCard title="Jualan ikut ejen" rows={breakdown.by_agent} />
                    <GroupCard title="Jualan ikut projek / kempen" rows={breakdown.by_campaign} />
                    <GroupCard title="Customer teratas" rows={breakdown.top_customers} />
                </div>
            </div>
        </AppLayout>
    );
}

function StatTile({
    label,
    value,
    change,
    vs,
    inverse = false,
    negative = false,
    children,
}: {
    label: string;
    value: string;
    change: number | null;
    vs: string;
    inverse?: boolean;
    negative?: boolean;
    children?: React.ReactNode;
}) {
    // For cash out, going up is bad news.
    const good = change !== null && (inverse ? change <= 0 : change >= 0);

    return (
        <Card>
            <CardContent className="p-5">
                <div className="text-muted-foreground text-sm">{label}</div>
                <div className={cn('mt-1 text-2xl font-semibold tracking-tight tabular-nums', negative && 'text-red-700')}>{value}</div>
                <div className="text-muted-foreground mt-1 text-xs">{children}</div>
                {change !== null && (
                    <div className={cn('mt-1 inline-flex items-center gap-0.5 text-xs font-medium', good ? 'text-emerald-700' : 'text-red-700')}>
                        {change >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                        {Math.abs(change).toFixed(0)}% vs {vs}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function PnlLine({ label, value, total, strong, sub }: { label: string; value: number; total?: boolean; strong?: boolean; sub?: boolean }) {
    return (
        <div
            className={cn(
                'flex justify-between gap-3 py-1',
                total && 'mt-1 border-t pt-2 font-medium',
                strong && 'text-base font-semibold',
                sub && 'text-muted-foreground pl-4 text-xs',
            )}
        >
            <span>{label}</span>
            <span className={cn('tabular-nums', value < 0 && strong && 'text-red-700')}>{value < 0 ? `(${rm(-value)})` : rm(value)}</span>
        </div>
    );
}

function CategoryCard({ title, rows, total, color }: { title: string; rows: CategoryAmount[]; total: number; color: string }) {
    const visible = rows.filter((row) => row.amount > 0);

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
                {visible.length === 0 && <p className="text-muted-foreground py-4 text-center text-sm">Tiada rekod dalam tempoh ini.</p>}
                {visible.map((row) => (
                    <div key={row.key} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
                        <span className="truncate">{row.label}</span>
                        <span className="bg-muted relative h-2.5 rounded-full">
                            <span
                                className="absolute inset-y-0 left-0 rounded-full"
                                style={{ width: `${(row.amount / Math.max(total, 1)) * 100}%`, backgroundColor: color }}
                            />
                        </span>
                        <span className="text-right tabular-nums">
                            {rm(row.amount, 0)}{' '}
                            <span className="text-muted-foreground text-xs">{((row.amount / Math.max(total, 1)) * 100).toFixed(0)}%</span>
                        </span>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

function GroupCard({ title, rows }: { title: string; rows: GroupRow[] }) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                {rows.length === 0 ? (
                    <p className="text-muted-foreground py-4 text-center text-sm">Tiada jualan dalam tempoh ini.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-muted-foreground border-b text-left text-xs">
                                <th className="py-1.5 pr-3 font-medium">Nama</th>
                                <th className="py-1.5 pr-3 text-right font-medium">Order</th>
                                <th className="py-1.5 pr-3 text-right font-medium">Pcs</th>
                                <th className="py-1.5 pr-3 text-right font-medium">Jualan</th>
                                <th className="py-1.5 text-right font-medium">Untung bersih</th>
                            </tr>
                        </thead>
                        <tbody className="tabular-nums">
                            {rows.map((row) => (
                                <tr key={row.name} className="border-b last:border-0">
                                    <td className="max-w-48 truncate py-1.5 pr-3">{row.name}</td>
                                    <td className="py-1.5 pr-3 text-right">{row.orders}</td>
                                    <td className="py-1.5 pr-3 text-right">{row.pieces}</td>
                                    <td className="py-1.5 pr-3 text-right">{rm(row.sales, 0)}</td>
                                    <td className="py-1.5 text-right">{rm(row.profit, 0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </CardContent>
        </Card>
    );
}
