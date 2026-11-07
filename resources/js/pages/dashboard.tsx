import { RiskBadges, StageBadge } from '@/components/order-badges';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { rm, shortDate } from '@/lib/format';
import { type BreadcrumbItem, type OrderSummary, type StageValue } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Clock, Inbox, PlusCircle, Star } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Dashboard', href: '/dashboard' }];

interface Stats {
    sales_month: number;
    sales_last_month: number;
    profit_month: number;
    commission_month: number;
    orders_month: number;
    pieces_month: number;
    collected_month: number;
    outstanding: number;
    active_orders: number;
    active_pieces: number;
    late_count: number;
    at_risk_count: number;
    new_inquiries: number;
    kilang_on_time: number | null;
    kilang_count: number;
    delivery_on_time: number | null;
    delivery_count: number;
    avg_lead_days: number | null;
    avg_rating: number | null;
}

interface PipelineStage {
    stage: StageValue;
    label: string;
    count: number;
    pieces: number;
    late: number;
}

interface TrendPoint {
    month: string;
    label: string;
    sales: number;
    collected: number;
}

interface Props {
    stats: Stats;
    pipeline: PipelineStage[];
    attention: OrderSummary[];
    dueSoon: OrderSummary[];
    salesTrend: TrendPoint[];
    targets: { production_days: number; lead_days: number };
}

export default function Dashboard({ stats, pipeline, attention, dueSoon, salesTrend, targets }: Props) {
    const change = stats.sales_last_month > 0 ? ((stats.sales_month - stats.sales_last_month) / stats.sales_last_month) * 100 : null;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-primary text-xl font-semibold">Dashboard Operasi</h1>
                        <p className="text-muted-foreground text-sm">
                            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {stats.new_inquiries > 0 && (
                            <Button variant="outline" asChild>
                                <Link href="/inquiries">
                                    <Inbox /> {stats.new_inquiries} inquiry baru
                                </Link>
                            </Button>
                        )}
                        <Button asChild>
                            <Link href="/orders/create">
                                <PlusCircle /> Order Baru
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* KPI tiles */}
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <StatTile
                        label="Jualan bulan ini"
                        value={rm(stats.sales_month, 0)}
                        hint={
                            change === null ? (
                                `${stats.orders_month} order · ${stats.pieces_month} helai`
                            ) : (
                                <span className="inline-flex items-center gap-1">
                                    {change >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                                    {Math.abs(change).toFixed(0)}% vs bulan lepas · {stats.pieces_month} helai
                                </span>
                            )
                        }
                    />
                    <StatTile
                        label="Untung bersih order bulan ini"
                        value={rm(stats.profit_month, 0)}
                        hint={`Selepas kos baju, pos & komisen ejen ${rm(stats.commission_month, 0)}`}
                    />
                    <StatTile label="Kutipan bulan ini" value={rm(stats.collected_month, 0)} hint={`Baki belum kutip: ${rm(stats.outstanding, 0)}`} />
                    <StatTile
                        label="Job aktif (pending)"
                        value={String(stats.active_orders)}
                        hint={`${stats.active_pieces} helai dalam proses`}
                        alert={
                            stats.late_count + stats.at_risk_count > 0 ? `${stats.late_count} lewat · ${stats.at_risk_count} risiko lewat` : undefined
                        }
                    />
                    <StatTile
                        label="Kilang on-time (bulan ini)"
                        value={stats.kilang_on_time === null ? '-' : `${stats.kilang_on_time}%`}
                        hint={`${stats.kilang_count} job siap · target ${targets.production_days} hari bekerja`}
                    />
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                    {/* Pipeline */}
                    <Card className="lg:col-span-2">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Pipeline semasa</CardTitle>
                            <CardDescription>Bilangan order di setiap peringkat. Klik untuk buka board.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Pipeline pipeline={pipeline} />
                        </CardContent>
                    </Card>

                    {/* Delivery KPIs */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Prestasi penghantaran</CardTitle>
                            <CardDescription>Order dipos bulan ini</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <KpiRow
                                label="Sampai sebelum tarikh customer"
                                value={stats.delivery_on_time === null ? '-' : `${stats.delivery_on_time}%`}
                                hint={`${stats.delivery_count} order ada tarikh diperlukan`}
                            />
                            <KpiRow
                                label="Purata lead time (deposit → pos)"
                                value={stats.avg_lead_days === null ? '-' : `${stats.avg_lead_days} hari`}
                                hint={`Target ${targets.lead_days} hari bekerja`}
                            />
                            <KpiRow
                                label="Rating customer"
                                value={
                                    stats.avg_rating === null ? (
                                        '-'
                                    ) : (
                                        <span className="inline-flex items-center gap-1">
                                            {stats.avg_rating} <Star className="size-4 fill-amber-400 text-amber-400" />
                                        </span>
                                    )
                                }
                                hint="Purata semua feedback"
                            />
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                    {/* Attention list */}
                    <Card className="lg:col-span-2">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <AlertTriangle className="size-4" /> Perlu perhatian
                            </CardTitle>
                            <CardDescription>Order yang melebihi target peringkat atau dijangka lewat dari tarikh customer.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {attention.length === 0 ? (
                                <p className="text-muted-foreground py-6 text-center text-sm">Semua order on-track. 👍</p>
                            ) : (
                                <OrderTable orders={attention} />
                            )}
                        </CardContent>
                    </Card>

                    {/* Due at kilang */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Clock className="size-4" /> Due di kilang
                            </CardTitle>
                            <CardDescription>Job sedang dalam produksi</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {dueSoon.length === 0 && <p className="text-muted-foreground py-6 text-center text-sm">Tiada job di kilang.</p>}
                            {dueSoon.map((order) => (
                                <Link
                                    key={order.id}
                                    href={`/orders/${order.id}`}
                                    className="hover:bg-accent flex items-center justify-between gap-2 rounded-md border p-3 text-sm"
                                >
                                    <div className="min-w-0">
                                        <div className="truncate font-medium">{order.title}</div>
                                        <div className="text-muted-foreground text-xs">
                                            {order.order_no} · {order.quantity} helai
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-medium">{shortDate(order.due_date)}</div>
                                        <RiskBadges order={order} />
                                    </div>
                                </Link>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Jualan 6 bulan</CardTitle>
                        <CardDescription>Nilai order (ikut tarikh order dicipta). Hover untuk lihat kutipan.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <SalesChart data={salesTrend} />
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

function StatTile({ label, value, hint, alert }: { label: string; value: string; hint?: React.ReactNode; alert?: string }) {
    return (
        <Card>
            <CardContent className="p-5">
                <div className="text-muted-foreground text-sm">{label}</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
                {hint && <div className="text-muted-foreground mt-1 text-xs">{hint}</div>}
                {alert && (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        <AlertTriangle className="size-3" /> {alert}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function KpiRow({ label, value, hint }: { label: string; value: React.ReactNode; hint: string }) {
    return (
        <div className="flex items-end justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
            <div>
                <div className="text-sm">{label}</div>
                <div className="text-muted-foreground text-xs">{hint}</div>
            </div>
            <div className="text-xl font-semibold tabular-nums">{value}</div>
        </div>
    );
}

function Pipeline({ pipeline }: { pipeline: PipelineStage[] }) {
    const max = Math.max(1, ...pipeline.map((stage) => stage.count));

    return (
        <div className="space-y-2.5">
            {pipeline.map((stage, index) => (
                <Link key={stage.stage} href="/orders" className="group grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3 text-sm">
                    <span className="truncate">
                        <span className="text-muted-foreground mr-1.5 tabular-nums">{index + 1}.</span>
                        {stage.label}
                    </span>
                    <span className="bg-muted relative h-6 rounded">
                        <span
                            className="bg-primary group-hover:bg-primary/80 absolute inset-y-0 left-0 rounded transition-all"
                            style={{ width: `${(stage.count / max) * 100}%`, minWidth: stage.count ? '0.5rem' : 0 }}
                        />
                    </span>
                    <span className="flex min-w-24 items-center justify-end gap-2 tabular-nums">
                        <span className="font-semibold">{stage.count}</span>
                        <span className="text-muted-foreground text-xs">{stage.pieces} hl</span>
                        {stage.late > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-600" title={`${stage.late} lewat`}>
                                <Clock className="size-3" />
                                {stage.late}
                            </span>
                        )}
                    </span>
                </Link>
            ))}
        </div>
    );
}

function OrderTable({ orders }: { orders: OrderSummary[] }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-muted-foreground border-b text-left text-xs">
                        <th className="py-2 pr-3 font-medium">Order</th>
                        <th className="py-2 pr-3 font-medium">Peringkat</th>
                        <th className="py-2 pr-3 font-medium">Tarikh customer</th>
                        <th className="py-2 pr-3 font-medium">Jangka pos</th>
                        <th className="py-2 font-medium">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {orders.map((order) => (
                        <tr key={order.id} className="hover:bg-accent/50 border-b last:border-0">
                            <td className="py-2 pr-3">
                                <Link href={`/orders/${order.id}`} className="font-medium hover:underline">
                                    {order.title}
                                </Link>
                                <div className="text-muted-foreground text-xs">
                                    {order.order_no} · {order.organization ?? order.customer}
                                </div>
                            </td>
                            <td className="py-2 pr-3">
                                <StageBadge stage={order.stage} label={order.stage_label} />
                                <div className="text-muted-foreground mt-0.5 text-xs">
                                    {order.days_in_stage}/{order.target_days} hari
                                </div>
                            </td>
                            <td className="py-2 pr-3 whitespace-nowrap">{shortDate(order.required_by)}</td>
                            <td className="py-2 pr-3 whitespace-nowrap">{shortDate(order.projected_ship_date)}</td>
                            <td className="py-2">
                                <div className="flex flex-wrap gap-1">
                                    <RiskBadges order={order} />
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function SalesChart({ data }: { data: TrendPoint[] }) {
    const [hover, setHover] = useState<number | null>(null);
    const max = Math.max(1, ...data.map((point) => point.sales));
    const niceMax = Math.ceil(max / 5000) * 5000 || 5000;
    const ticks = [0, 0.5, 1].map((ratio) => niceMax * ratio);

    return (
        <div className="relative">
            <div className="grid grid-cols-[auto_1fr] gap-3">
                <div className="text-muted-foreground flex h-48 flex-col-reverse justify-between text-right text-xs tabular-nums">
                    {ticks.map((tick) => (
                        <span key={tick}>{tick >= 1000 ? `${tick / 1000}k` : tick}</span>
                    ))}
                </div>
                <div className="relative h-48 border-b">
                    {ticks.slice(1).map((tick) => (
                        <div
                            key={tick}
                            className="border-border/60 absolute inset-x-0 border-t border-dashed"
                            style={{ bottom: `${(tick / niceMax) * 100}%` }}
                        />
                    ))}
                    <div className="absolute inset-0 flex items-end gap-[2px]">
                        {data.map((point, index) => (
                            <div
                                key={point.month}
                                className="relative flex h-full flex-1 items-end justify-center"
                                onMouseEnter={() => setHover(index)}
                                onMouseLeave={() => setHover(null)}
                            >
                                <div
                                    className={
                                        'bg-primary w-full max-w-14 rounded-t transition-opacity ' +
                                        (hover !== null && hover !== index ? 'opacity-50' : '')
                                    }
                                    style={{ height: `${(point.sales / niceMax) * 100}%`, minHeight: point.sales ? 2 : 0 }}
                                />
                                {hover === index && (
                                    <div className="bg-popover text-popover-foreground absolute bottom-full z-10 mb-1 rounded-md border px-3 py-2 text-xs whitespace-nowrap shadow-md">
                                        <div className="font-medium">{point.month}</div>
                                        <div>Jualan: {rm(point.sales, 0)}</div>
                                        <div className="text-muted-foreground">Kutipan: {rm(point.collected, 0)}</div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                <div />
                <div className="text-muted-foreground flex gap-[2px] text-center text-xs">
                    {data.map((point) => (
                        <span key={point.month} className="flex-1">
                            {point.label}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
