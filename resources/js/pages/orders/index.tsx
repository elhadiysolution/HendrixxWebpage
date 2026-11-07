import { RiskBadges, StageBadge, stageStyles } from '@/components/order-badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import AppLayout from '@/layouts/app-layout';
import { rm, shortDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem, type OrderSummary, type Paginated, type StageOption, type StageValue } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Columns3, List, PlusCircle, Search } from 'lucide-react';
import { FormEvent, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Order Board', href: '/orders' }];

interface Column {
    stage: StageValue;
    label: string;
    target_days: number;
    orders: OrderSummary[];
}

interface Props {
    filters: { view: 'board' | 'list'; q: string; status: string; stage: string | null };
    stages: StageOption[];
    columns?: Column[];
    orders?: Paginated<OrderSummary>;
}

export default function OrdersIndex({ filters, stages, columns, orders }: Props) {
    const [q, setQ] = useState(filters.q);

    const visit = (params: Partial<Props['filters']>) => {
        router.get('/orders', { ...filters, ...params }, { preserveState: true, replace: true });
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        visit({ q });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Order Board" />
            <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="text-primary text-xl font-semibold">Order</h1>
                    <div className="flex flex-wrap items-center gap-2">
                        <form onSubmit={submit} className="relative">
                            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                            <Input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="Cari order / customer / telefon"
                                className="w-64 pl-9"
                            />
                        </form>
                        <div className="flex rounded-md border p-0.5">
                            <ViewButton active={filters.view === 'board'} onClick={() => visit({ view: 'board' })}>
                                <Columns3 className="size-4" /> Board
                            </ViewButton>
                            <ViewButton active={filters.view === 'list'} onClick={() => visit({ view: 'list' })}>
                                <List className="size-4" /> Senarai
                            </ViewButton>
                        </div>
                        <Button asChild>
                            <Link href="/orders/create">
                                <PlusCircle /> Order Baru
                            </Link>
                        </Button>
                    </div>
                </div>

                {columns && <Board columns={columns} />}

                {orders && (
                    <>
                        <div className="flex flex-wrap gap-2">
                            <NativeSelect className="w-44" value={filters.status} onChange={(e) => visit({ status: e.target.value })}>
                                <option value="active">Aktif</option>
                                <option value="completed">Complete</option>
                                <option value="cancelled">Dibatalkan (boleh dipulihkan)</option>
                                <option value="all">Semua</option>
                            </NativeSelect>
                            <NativeSelect className="w-60" value={filters.stage ?? ''} onChange={(e) => visit({ stage: e.target.value || null })}>
                                <option value="">Semua peringkat</option>
                                {stages.map((stage) => (
                                    <option key={stage.value} value={stage.value}>
                                        {stage.label}
                                    </option>
                                ))}
                            </NativeSelect>
                        </div>
                        <OrderList orders={orders} />
                    </>
                )}
            </div>
        </AppLayout>
    );
}

function ViewButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn('flex items-center gap-1.5 rounded px-3 py-1.5 text-sm', active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}
        >
            {children}
        </button>
    );
}

function Board({ columns }: { columns: Column[] }) {
    return (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
            <div className="grid min-w-[1100px] grid-cols-5 gap-3">
                {columns.map((column, index) => (
                    <div key={column.stage} className="bg-muted/50 flex flex-col rounded-lg border">
                        <div className={cn('rounded-t-lg px-3 py-2', stageStyles[column.stage])}>
                            <div className="flex items-center justify-between text-sm font-semibold">
                                <span>
                                    {index + 1}. {column.label}
                                </span>
                                <span className="tabular-nums">{column.orders.length}</span>
                            </div>
                            <div className="text-xs opacity-80">
                                Target {column.target_days} hari · {column.orders.reduce((sum, order) => sum + order.quantity, 0)} helai
                            </div>
                        </div>
                        <div className="flex flex-1 flex-col gap-2 p-2">
                            {column.orders.length === 0 && <p className="text-muted-foreground py-6 text-center text-xs">Kosong</p>}
                            {column.orders.map((order) => (
                                <OrderCard key={order.id} order={order} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function OrderCard({ order }: { order: OrderSummary }) {
    const progress = Math.min(100, (order.days_in_stage / Math.max(1, order.target_days)) * 100);

    return (
        <Link
            href={`/orders/${order.id}`}
            className={cn('bg-card block rounded-md border p-3 text-sm shadow-xs transition hover:shadow-md', order.is_late && 'border-red-300')}
        >
            <div className="flex items-start justify-between gap-2">
                <span className="text-muted-foreground font-mono text-xs">{order.order_no}</span>
                <span className="text-xs font-medium tabular-nums">{order.quantity} hl</span>
            </div>
            <div className="mt-1 leading-snug font-medium">{order.title}</div>
            <div className="text-muted-foreground truncate text-xs">{order.organization ?? order.customer}</div>

            <div className="mt-2">
                <div className="bg-muted h-1 rounded">
                    <div className={cn('h-1 rounded', order.is_late ? 'bg-red-500' : 'bg-primary')} style={{ width: `${progress}%` }} />
                </div>
                <div className="text-muted-foreground mt-1 flex justify-between text-xs">
                    <span>
                        {order.days_in_stage}/{order.target_days} hari
                    </span>
                    {order.stage === 'production' && order.due_date ? (
                        <span>Due {shortDate(order.due_date)}</span>
                    ) : (
                        order.required_by && <span>Perlu {shortDate(order.required_by)}</span>
                    )}
                </div>
            </div>

            {(order.is_late || order.is_at_risk) && (
                <div className="mt-2 flex flex-wrap gap-1">
                    <RiskBadges order={order} />
                </div>
            )}
        </Link>
    );
}

function OrderList({ orders }: { orders: Paginated<OrderSummary> }) {
    return (
        <div className="bg-card overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-muted-foreground border-b text-left text-xs">
                        <th className="px-4 py-3 font-medium">Order</th>
                        <th className="px-4 py-3 font-medium">Customer</th>
                        <th className="px-4 py-3 font-medium">Peringkat</th>
                        <th className="px-4 py-3 text-right font-medium">Helai</th>
                        <th className="px-4 py-3 text-right font-medium">Jumlah</th>
                        <th className="px-4 py-3 text-right font-medium">Dibayar</th>
                        <th className="px-4 py-3 font-medium">Tarikh</th>
                    </tr>
                </thead>
                <tbody>
                    {orders.data.length === 0 && (
                        <tr>
                            <td colSpan={7} className="text-muted-foreground px-4 py-10 text-center">
                                Tiada order.
                            </td>
                        </tr>
                    )}
                    {orders.data.map((order) => (
                        <tr key={order.id} className="hover:bg-accent/50 border-b last:border-0">
                            <td className="px-4 py-3">
                                <Link href={`/orders/${order.id}`} className="font-medium hover:underline">
                                    {order.title}
                                </Link>
                                <div className="text-muted-foreground font-mono text-xs">{order.order_no}</div>
                            </td>
                            <td className="px-4 py-3">
                                {order.customer}
                                <div className="text-muted-foreground text-xs">{order.organization}</div>
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                    <StageBadge stage={order.stage} label={order.stage_label} />
                                    <RiskBadges order={order} />
                                </div>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">{order.quantity}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{rm(order.total)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{rm(order.paid)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{shortDate(order.created_at)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {orders.last_page > 1 && (
                <div className="flex flex-wrap gap-1 border-t p-3">
                    {orders.links.map((link, index) =>
                        link.url ? (
                            <Link
                                key={index}
                                href={link.url}
                                preserveState
                                className={cn('rounded px-3 py-1 text-sm', link.active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}
                                dangerouslySetInnerHTML={{ __html: link.label }}
                            />
                        ) : (
                            <span key={index} className="text-muted-foreground px-3 py-1 text-sm" dangerouslySetInnerHTML={{ __html: link.label }} />
                        ),
                    )}
                </div>
            )}
        </div>
    );
}
