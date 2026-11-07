import { confirmDialog } from '@/components/confirm-dialog';
import { GroupedBarChart, SERIES_COLORS } from '@/components/finance-chart';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { rm, shortDate, today } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Kewangan', href: '/finance' },
    { title: 'Target & Forecast', href: '/finance/targets' },
];

interface Campaign {
    id: number;
    name: string;
    type: string;
    type_label: string;
    start_date: string;
    end_date: string;
    target_sales: number;
    target_orders: number | null;
    target_pieces: number | null;
    budget: number;
    notes: string | null;
    status: 'upcoming' | 'active' | 'ended';
    days_total: number;
    days_elapsed: number;
    days_left: number;
    sales: number;
    orders: number;
    pieces: number;
    collected: number;
    profit: number;
    spend: number;
    projected_sales: number;
    needed_per_day: number;
}

interface HistoryMonth {
    month: string;
    label: string;
    sales: number;
    gross_profit: number;
    operating_expenses: number;
    net_profit: number;
    cash_in: number;
    cash_out: number;
}

interface Forecast {
    history: HistoryMonth[];
    month_to_date: { sales: number; net_profit: number; day: number; days_in_month: number; projected_sales: number };
    pipeline: { active_orders: number; receivable: number; kilang_due: number; postage_due: number; commission_due: number; payroll_monthly: number };
    cash_balance: number;
}

interface Props {
    campaigns: Campaign[];
    types: Record<string, string>;
    forecast: Forecast;
}

const statusLabel = { upcoming: 'Akan datang', active: 'Sedang berjalan', ended: 'Tamat' };
const statusStyle = { upcoming: 'bg-sky-100 text-sky-800', active: 'bg-emerald-100 text-emerald-800', ended: 'bg-neutral-200 text-neutral-700' };

export default function Targets({ campaigns, types, forecast }: Props) {
    const [editing, setEditing] = useState<Campaign | 'new' | null>(null);
    const active = campaigns.filter((c) => c.status !== 'ended');
    const ended = campaigns.filter((c) => c.status === 'ended');

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Target & Forecast" />
            <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-primary text-xl font-semibold">Target & Forecast</h1>
                        <p className="text-muted-foreground text-sm">
                            Set target jualan ikut tempoh, projek atau kempen, dan jangka jualan & tunai bulan depan.
                        </p>
                    </div>
                    <Button onClick={() => setEditing('new')}>
                        <Plus /> Target baru
                    </Button>
                </div>

                <CashOutlook forecast={forecast} />
                <SalesForecast forecast={forecast} />

                <div>
                    <h2 className="mb-2 flex items-center gap-2 font-semibold">
                        <Target className="size-4" /> Target aktif
                    </h2>
                    {active.length === 0 ? (
                        <Card>
                            <CardContent className="text-muted-foreground py-10 text-center text-sm">
                                Belum ada target. Cuba “Target Oktober” (jenis tempoh) atau satu kempen seperti “Jersey Raya 2027”.
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4 lg:grid-cols-2">
                            {active.map((campaign) => (
                                <CampaignCard key={campaign.id} campaign={campaign} onEdit={() => setEditing(campaign)} />
                            ))}
                        </div>
                    )}
                </div>

                {ended.length > 0 && (
                    <div>
                        <h2 className="text-muted-foreground mb-2 font-semibold">Target lepas</h2>
                        <div className="grid gap-4 lg:grid-cols-2">
                            {ended.map((campaign) => (
                                <CampaignCard key={campaign.id} campaign={campaign} onEdit={() => setEditing(campaign)} />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {editing && <CampaignDialog campaign={editing === 'new' ? null : editing} types={types} onClose={() => setEditing(null)} />}
        </AppLayout>
    );
}

function CashOutlook({ forecast }: { forecast: Forecast }) {
    const { pipeline, cash_balance } = forecast;
    const comingOut = pipeline.kilang_due + pipeline.postage_due + pipeline.commission_due + pipeline.payroll_monthly;
    const after = cash_balance + pipeline.receivable - comingOut;

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Jangkaan tunai</CardTitle>
                <CardDescription>
                    Berdasarkan {pipeline.active_orders} order aktif. Bayaran kilang / komisen yang dipautkan ke order sudah ditolak.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Figure label="Baki tunai sekarang" value={cash_balance} />
                <Figure label="Akan masuk (baki customer)" value={pipeline.receivable} prefix="+" />
                <div>
                    <div className="text-muted-foreground">Akan keluar</div>
                    <div className="text-xl font-semibold tabular-nums">- {rm(comingOut, 0)}</div>
                    <div className="text-muted-foreground mt-0.5 text-xs">
                        Kilang {rm(pipeline.kilang_due, 0)} · pos {rm(pipeline.postage_due, 0)} · komisen {rm(pipeline.commission_due, 0)} · gaji
                        tetap {rm(pipeline.payroll_monthly, 0)}
                    </div>
                </div>
                <Figure label="Anggaran baki selepas semua selesai" value={after} strong />
            </CardContent>
        </Card>
    );
}

function Figure({ label, value, prefix = '', strong }: { label: string; value: number; prefix?: string; strong?: boolean }) {
    return (
        <div className={cn(strong && 'bg-muted/60 -m-3 rounded-md p-3 sm:m-0 sm:p-3')}>
            <div className="text-muted-foreground">{label}</div>
            <div className={cn('text-xl font-semibold tabular-nums', value < 0 && 'text-red-700')}>
                {prefix}
                {rm(value, 0)}
            </div>
        </div>
    );
}

function SalesForecast({ forecast }: { forecast: Forecast }) {
    const { history, month_to_date: mtd } = forecast;
    const [growth, setGrowth] = useState('5');
    const [wantedProfit, setWantedProfit] = useState('');

    const model = useMemo(() => {
        const recent = history.slice(-3);
        const withSales = recent.filter((m) => m.sales > 0);
        const base = recent.reduce((sum, m) => sum + m.sales, 0) / Math.max(1, recent.length);
        const margin = withSales.length ? withSales.reduce((sum, m) => sum + m.gross_profit, 0) / withSales.reduce((sum, m) => sum + m.sales, 0) : 0;
        const opex = recent.reduce((sum, m) => sum + m.operating_expenses, 0) / Math.max(1, recent.length);
        const rate = (Number(growth) || 0) / 100;
        const now = new Date();

        const projected = [1, 2, 3].map((ahead) => {
            const date = new Date(now.getFullYear(), now.getMonth() + ahead, 1);
            const sales = base * Math.pow(1 + rate, ahead);
            return {
                label: date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
                sales,
                gross_profit: sales * margin,
                operating_expenses: opex,
                net_profit: sales * margin - opex,
            };
        });

        return { base, margin, opex, projected };
    }, [history, growth]);

    const breakEven = model.margin > 0 ? model.opex / model.margin : null;
    const neededSales = model.margin > 0 && wantedProfit !== '' ? ((Number(wantedProfit) || 0) + model.opex) / model.margin : null;

    const rows = [
        ...history.map((m) => ({ label: m.label.replace(/ \d{4}$/, ''), actual: m.sales, projected: null as number | null })),
        { label: 'Bulan ini', actual: mtd.sales, projected: mtd.projected_sales },
        ...model.projected.map((m) => ({ label: m.label.replace(/ \d{4}$/, ''), actual: null as number | null, projected: m.sales })),
    ];

    return (
        <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Forecast jualan</CardTitle>
                    <CardDescription>
                        6 bulan lepas, bulan ini (setakat hari ke-{mtd.day} dan unjuran hujung bulan), dan 3 bulan depan dari purata 3 bulan terakhir.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <GroupedBarChart
                        rows={rows}
                        series={[
                            { key: 'actual', label: 'Jualan sebenar', color: SERIES_COLORS.in },
                            { key: 'projected', label: 'Unjuran', color: SERIES_COLORS.out, hatched: true },
                        ]}
                    />
                </CardContent>
            </Card>

            <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Andaian forecast</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                            <Label>Pertumbuhan sebulan (%)</Label>
                            <Input type="number" step="1" value={growth} onChange={(e) => setGrowth(e.target.value)} />
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Untung bersih dimahukan</Label>
                            <Input
                                type="number"
                                step="100"
                                min="0"
                                value={wantedProfit}
                                onChange={(e) => setWantedProfit(e.target.value)}
                                placeholder="RM sebulan"
                            />
                        </div>
                    </div>
                    <dl className="space-y-1.5">
                        <Line label="Purata jualan (3 bulan)" value={rm(model.base, 0)} />
                        <Line label="Margin untung bersih order" value={`${(model.margin * 100).toFixed(1)}%`} />
                        <Line label="Purata belanja operasi" value={rm(model.opex, 0)} />
                        <Line label="Jualan pulang modal (break-even)" value={breakEven === null ? '-' : rm(breakEven, 0)} strong />
                        {neededSales !== null && (
                            <Line label={`Jualan perlu untuk untung ${rm(Number(wantedProfit) || 0, 0)}`} value={rm(neededSales, 0)} strong />
                        )}
                    </dl>
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-muted-foreground border-b text-left">
                                <th className="py-1.5 font-medium">Bulan</th>
                                <th className="py-1.5 text-right font-medium">Jualan</th>
                                <th className="py-1.5 text-right font-medium">Untung bersih</th>
                            </tr>
                        </thead>
                        <tbody className="tabular-nums">
                            {model.projected.map((m) => (
                                <tr key={m.label} className="border-b last:border-0">
                                    <td className="py-1.5">{m.label}</td>
                                    <td className="py-1.5 text-right">{rm(m.sales, 0)}</td>
                                    <td className={cn('py-1.5 text-right', m.net_profit < 0 && 'text-red-700')}>{rm(m.net_profit, 0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {model.base === 0 && <p className="text-muted-foreground text-xs">Belum cukup data jualan 3 bulan lepas untuk forecast.</p>}
                </CardContent>
            </Card>
        </div>
    );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
    return (
        <div className={cn('flex justify-between gap-3', strong && 'font-semibold')}>
            <dt className={cn(!strong && 'text-muted-foreground')}>{label}</dt>
            <dd className="tabular-nums">{value}</dd>
        </div>
    );
}

function CampaignCard({ campaign: c, onEdit }: { campaign: Campaign; onEdit: () => void }) {
    const roi = c.spend > 0 ? c.sales / c.spend : null;

    return (
        <Card>
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
                <div className="min-w-0">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                        {c.name}
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusStyle[c.status])}>{statusLabel[c.status]}</span>
                    </CardTitle>
                    <CardDescription>
                        {c.type_label} · {shortDate(c.start_date)} - {shortDate(c.end_date)}
                        {c.status === 'active' && ` · tinggal ${c.days_left} hari`}
                    </CardDescription>
                </div>
                <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Edit">
                    <Pencil />
                </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
                {c.target_sales > 0 && (
                    <Progress
                        label="Jualan"
                        value={c.sales}
                        target={c.target_sales}
                        money
                        projected={c.status === 'active' ? c.projected_sales : null}
                    />
                )}
                {c.target_orders ? <Progress label="Order" value={c.orders} target={c.target_orders} /> : null}
                {c.target_pieces ? <Progress label="Helai" value={c.pieces} target={c.target_pieces} /> : null}
                {c.budget > 0 && <Progress label="Belanja vs bajet" value={c.spend} target={c.budget} money cost />}

                <div className="text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-3 text-xs sm:grid-cols-3">
                    <span>
                        Jualan <b className="text-foreground tabular-nums">{rm(c.sales, 0)}</b>
                    </span>
                    <span>
                        Dikutip <b className="text-foreground tabular-nums">{rm(c.collected, 0)}</b>
                    </span>
                    <span>
                        Untung bersih <b className="text-foreground tabular-nums">{rm(c.profit, 0)}</b>
                    </span>
                    <span>
                        {c.orders} order · {c.pieces} helai
                    </span>
                    {roi !== null && (
                        <span>
                            Pulangan <b className="text-foreground tabular-nums">{roi.toFixed(1)}x</b> belanja
                        </span>
                    )}
                    {c.status === 'active' && c.needed_per_day > 0 && (
                        <span>
                            Perlu <b className="text-foreground tabular-nums">{rm(c.needed_per_day, 0)}</b>/hari
                        </span>
                    )}
                </div>
                {c.notes && <p className="text-muted-foreground text-xs whitespace-pre-line">{c.notes}</p>}
            </CardContent>
        </Card>
    );
}

function Progress({
    label,
    value,
    target,
    money,
    cost,
    projected,
}: {
    label: string;
    value: number;
    target: number;
    money?: boolean;
    cost?: boolean;
    projected?: number | null;
}) {
    const percent = target > 0 ? (value / target) * 100 : 0;
    const fmt = (n: number) => (money ? rm(n, 0) : String(n));
    // Reaching the target is good, except for spending where going over the budget is the warning.
    const tone = cost ? (percent > 100 ? 'bg-red-600' : 'bg-primary') : percent >= 100 ? 'bg-emerald-600' : 'bg-primary';

    return (
        <div>
            <div className="mb-1 flex justify-between gap-2 text-xs">
                <span className="font-medium">{label}</span>
                <span className="tabular-nums">
                    {fmt(value)} / {fmt(target)} <span className="text-muted-foreground">({percent.toFixed(0)}%)</span>
                </span>
            </div>
            <div className="bg-muted relative h-2.5 overflow-hidden rounded-full">
                {projected != null && projected > value && (
                    <div
                        className="bg-primary/25 absolute inset-y-0 left-0 rounded-full"
                        style={{ width: `${Math.min(100, (projected / target) * 100)}%` }}
                    />
                )}
                <div className={cn('absolute inset-y-0 left-0 rounded-full', tone)} style={{ width: `${Math.min(100, percent)}%` }} />
            </div>
            {projected != null && projected > value && (
                <div className="text-muted-foreground mt-0.5 text-xs">
                    Ikut kadar sekarang: {fmt(Math.round(projected))} ({((projected / target) * 100).toFixed(0)}% target)
                </div>
            )}
        </div>
    );
}

function CampaignDialog({ campaign, types, onClose }: { campaign: Campaign | null; types: Record<string, string>; onClose: () => void }) {
    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const form = useForm({
        name: campaign?.name ?? '',
        type: campaign?.type ?? 'campaign',
        start_date: campaign?.start_date ?? today(),
        end_date:
            campaign?.end_date ??
            `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, '0')}-${String(monthEnd.getDate()).padStart(2, '0')}`,
        target_sales: campaign ? String(campaign.target_sales) : '',
        target_orders: campaign?.target_orders ? String(campaign.target_orders) : '',
        target_pieces: campaign?.target_pieces ? String(campaign.target_pieces) : '',
        budget: campaign?.budget ? String(campaign.budget) : '',
        notes: campaign?.notes ?? '',
    });
    const err = form.errors as Record<string, string | undefined>;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: onClose };
        if (campaign) form.put(`/finance/targets/${campaign.id}`, options);
        else form.post('/finance/targets', options);
    };

    const field = (key: keyof typeof form.data, label: string, props: React.ComponentProps<typeof Input> = {}) => (
        <div className="grid gap-1.5">
            <Label>{label}</Label>
            <Input value={String(form.data[key])} onChange={(e) => form.setData(key, e.target.value)} {...props} />
            <InputError message={err[key]} />
        </div>
    );

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{campaign ? 'Edit target' : 'Target baru'}</DialogTitle>
                    <DialogDescription>
                        Jenis “tempoh” kira semua jualan dalam tarikh tersebut. Projek / kempen hanya kira order yang dipilih kempen ini dalam borang
                        order.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">{field('name', 'Nama *', { required: true, placeholder: 'cth: Kempen Jersey Merdeka' })}</div>
                    <div className="grid gap-1.5 sm:col-span-2">
                        <Label>Jenis</Label>
                        <NativeSelect value={form.data.type} onChange={(e) => form.setData('type', e.target.value)}>
                            {Object.entries(types).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </NativeSelect>
                    </div>
                    {field('start_date', 'Tarikh mula *', { type: 'date', required: true })}
                    {field('end_date', 'Tarikh tamat *', { type: 'date', required: true })}
                    {field('target_sales', 'Target jualan (RM)', { type: 'number', min: 0, step: '0.01' })}
                    {field('budget', 'Bajet belanja (RM)', { type: 'number', min: 0, step: '0.01' })}
                    {field('target_orders', 'Target bilangan order', { type: 'number', min: 0 })}
                    {field('target_pieces', 'Target helai', { type: 'number', min: 0 })}
                    <div className="grid gap-1.5 sm:col-span-2">
                        <Label>Catatan</Label>
                        <Textarea value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} rows={2} />
                    </div>
                    <DialogFooter className="sm:col-span-2 sm:justify-between">
                        {campaign ? (
                            <Button
                                type="button"
                                variant="ghost"
                                className="text-red-600"
                                onClick={async () => {
                                    const ok = await confirmDialog({
                                        title: `Padam target ${campaign.name}?`,
                                        confirmLabel: 'Padam',
                                        destructive: true,
                                    });
                                    if (ok !== false) router.delete(`/finance/targets/${campaign.id}`, { preserveScroll: true, onSuccess: onClose });
                                }}
                            >
                                <Trash2 /> Padam
                            </Button>
                        ) : (
                            <span />
                        )}
                        <div className="flex gap-2">
                            <Button type="button" variant="ghost" onClick={onClose}>
                                Batal
                            </Button>
                            <Button disabled={form.processing}>Simpan</Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
