import { confirmDialog } from '@/components/confirm-dialog';
import { type FinancePeriod, FinancePeriodNav } from '@/components/finance-period-nav';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import AppLayout from '@/layouts/app-layout';
import { rm, shortDate, today } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowDownLeft, ArrowUpRight, Lock, Paperclip, Pencil, Trash2, Wallet } from 'lucide-react';
import { FormEvent, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Kewangan', href: '/finance' },
    { title: 'Cash In / Out', href: '/finance/cash' },
];

type Direction = 'in' | 'out';

interface Row {
    key: string;
    id: number;
    source: 'payment' | 'entry';
    direction: Direction;
    category: string;
    category_label: string;
    amount: number;
    entry_date: string;
    description: string;
    party: string | null;
    method: string | null;
    method_label: string | null;
    reference: string | null;
    order_id?: number | null;
    campaign_id?: number | null;
    order: { id: number; order_no: string } | null;
    campaign: { id: number; name: string } | null;
    receipt_url: string | null;
    user: string | null;
    locked: string | null;
}

interface Props {
    period: FinancePeriod;
    periodTypes: Record<string, string>;
    direction: 'all' | Direction;
    rows: Row[];
    totals: { in: number; out: number };
    categories: Record<Direction, Record<string, string>>;
    methods: Record<string, string>;
    orders: { id: number; order_no: string; title: string }[];
    campaigns: { id: number; name: string }[];
    openingBalance: number;
    cashBalance: number;
}

export default function CashFlow(props: Props) {
    const { period, periodTypes, direction, rows, totals, openingBalance, cashBalance } = props;
    const [editing, setEditing] = useState<{ direction: Direction; row: Row | null } | null>(null);
    const net = totals.in - totals.out;
    const filterHref = (value: string) => `/finance/cash?${new URLSearchParams({ period: period.type, ref: period.ref, direction: value })}`;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Cash In / Out" />
            <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-primary text-xl font-semibold">Cash In / Out</h1>
                        <p className="text-muted-foreground text-sm">
                            Bayaran customer masuk automatik dari order. Rekod di sini duit lain: bayar kilang, pos, iklan, modal dan lain-lain.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setEditing({ direction: 'in', row: null })}>
                            <ArrowDownLeft /> Cash in
                        </Button>
                        <Button onClick={() => setEditing({ direction: 'out', row: null })}>
                            <ArrowUpRight /> Cash out
                        </Button>
                    </div>
                </div>

                <FinancePeriodNav url="/finance/cash" period={period} types={periodTypes} query={{ direction }} />

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Tile label="Cash in" value={rm(totals.in)} />
                    <Tile label="Cash out" value={rm(totals.out)} />
                    <Tile label="Bersih tempoh ini" value={(net >= 0 ? '+' : '') + rm(net)} tone={net < 0 ? 'bad' : 'good'} />
                    <OpeningBalance openingBalance={openingBalance} cashBalance={cashBalance} />
                </div>

                <div className="flex flex-wrap gap-1">
                    {Object.entries({ all: 'Semua', in: 'Cash in', out: 'Cash out' }).map(([value, label]) => (
                        <Link
                            key={value}
                            href={filterHref(value)}
                            preserveScroll
                            className={cn(
                                'rounded-md px-3 py-1.5 text-sm',
                                direction === value ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                            )}
                        >
                            {label}
                        </Link>
                    ))}
                </div>

                <Card>
                    <CardContent className="overflow-x-auto p-0">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-muted-foreground border-b text-left text-xs">
                                    <th className="px-4 py-2.5 font-medium">Tarikh</th>
                                    <th className="py-2.5 pr-3 font-medium">Kategori</th>
                                    <th className="py-2.5 pr-3 font-medium">Keterangan</th>
                                    <th className="py-2.5 pr-3 font-medium">Kaedah / rujukan</th>
                                    <th className="py-2.5 pr-3 text-right font-medium">Amaun</th>
                                    <th className="w-24 px-4" />
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-muted-foreground py-10 text-center">
                                            Tiada rekod dalam tempoh ini.
                                        </td>
                                    </tr>
                                )}
                                {rows.map((row) => (
                                    <tr key={row.key} className="hover:bg-accent/40 border-b last:border-0">
                                        <td className="px-4 py-2 whitespace-nowrap">{shortDate(row.entry_date)}</td>
                                        <td className="py-2 pr-3">
                                            <span
                                                className={cn(
                                                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                                                    row.direction === 'in' ? 'bg-blue-100 text-blue-900' : 'bg-orange-100 text-orange-900',
                                                )}
                                            >
                                                {row.direction === 'in' ? <ArrowDownLeft className="size-3" /> : <ArrowUpRight className="size-3" />}
                                                {row.category_label}
                                            </span>
                                        </td>
                                        <td className="py-2 pr-3">
                                            <div>{row.description}</div>
                                            <div className="text-muted-foreground text-xs">
                                                {[row.party, row.campaign?.name, row.user && `oleh ${row.user}`].filter(Boolean).join(' · ')}
                                                {row.order && (
                                                    <>
                                                        {' · '}
                                                        <Link href={`/orders/${row.order.id}`} className="hover:underline">
                                                            {row.order.order_no}
                                                        </Link>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                        <td className="text-muted-foreground py-2 pr-3 text-xs">
                                            {[row.method_label, row.reference].filter(Boolean).join(' · ') || '-'}
                                        </td>
                                        <td
                                            className={cn(
                                                'py-2 pr-3 text-right font-medium whitespace-nowrap tabular-nums',
                                                row.direction === 'out' && 'text-orange-800',
                                            )}
                                        >
                                            {row.direction === 'out' ? '- ' : '+ '}
                                            {rm(row.amount)}
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="flex justify-end gap-0.5">
                                                {row.receipt_url && (
                                                    <Button size="icon" variant="ghost" asChild aria-label="Resit">
                                                        <a href={row.receipt_url} target="_blank" rel="noreferrer">
                                                            <Paperclip />
                                                        </a>
                                                    </Button>
                                                )}
                                                {row.locked ? (
                                                    <span
                                                        className="text-muted-foreground inline-flex size-9 items-center justify-center"
                                                        title={row.locked}
                                                    >
                                                        <Lock className="size-4" />
                                                    </span>
                                                ) : (
                                                    <>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            aria-label="Edit"
                                                            onClick={() => setEditing({ direction: row.direction, row })}
                                                        >
                                                            <Pencil />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            aria-label="Padam"
                                                            onClick={async () => {
                                                                const ok = await confirmDialog({
                                                                    title: `Padam rekod ${rm(row.amount)}?`,
                                                                    confirmLabel: 'Padam',
                                                                    destructive: true,
                                                                });
                                                                if (ok !== false) router.delete(`/finance/cash/${row.id}`, { preserveScroll: true });
                                                            }}
                                                        >
                                                            <Trash2 className="text-red-600" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            </div>

            {editing && <EntryDialog {...props} direction={editing.direction} row={editing.row} onClose={() => setEditing(null)} />}
        </AppLayout>
    );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
    return (
        <Card>
            <CardContent className="p-5">
                <div className="text-muted-foreground text-sm">{label}</div>
                <div
                    className={cn(
                        'mt-1 text-2xl font-semibold tracking-tight tabular-nums',
                        tone === 'bad' && 'text-red-700',
                        tone === 'good' && 'text-emerald-700',
                    )}
                >
                    {value}
                </div>
            </CardContent>
        </Card>
    );
}

function OpeningBalance({ openingBalance, cashBalance }: { openingBalance: number; cashBalance: number }) {
    const [open, setOpen] = useState(false);
    const form = useForm({ opening_balance: String(openingBalance) });

    return (
        <Card>
            <CardContent className="p-5">
                <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
                    <Wallet className="size-4" /> Baki tunai semasa
                </div>
                <div className={cn('mt-1 text-2xl font-semibold tracking-tight tabular-nums', cashBalance < 0 && 'text-red-700')}>
                    {rm(cashBalance)}
                </div>
                {open ? (
                    <form
                        className="mt-2 flex gap-1.5"
                        onSubmit={(event) => {
                            event.preventDefault();
                            form.put('/finance/opening-balance', { preserveScroll: true, onSuccess: () => setOpen(false) });
                        }}
                    >
                        <Input
                            type="number"
                            step="0.01"
                            className="h-8"
                            value={form.data.opening_balance}
                            onChange={(e) => form.setData('opening_balance', e.target.value)}
                        />
                        <Button size="sm" disabled={form.processing}>
                            Simpan
                        </Button>
                    </form>
                ) : (
                    <button type="button" className="text-muted-foreground mt-1 text-xs hover:underline" onClick={() => setOpen(true)}>
                        Baki permulaan {rm(openingBalance)} · ubah
                    </button>
                )}
            </CardContent>
        </Card>
    );
}

function EntryDialog({
    direction,
    row,
    onClose,
    categories,
    methods,
    orders,
    campaigns,
}: Props & { direction: Direction; row: Row | null; onClose: () => void }) {
    const form = useForm({
        _method: row ? 'put' : 'post',
        direction,
        category: row?.category ?? Object.keys(categories[direction])[0],
        amount: row ? String(row.amount) : '',
        entry_date: row?.entry_date ?? today(),
        description: row?.description ?? '',
        party: row?.party ?? '',
        order_id: row?.order_id ? String(row.order_id) : '',
        campaign_id: row?.campaign_id ? String(row.campaign_id) : '',
        method: row?.method ?? 'transfer',
        reference: row?.reference ?? '',
        receipt: null as File | null,
    });
    const err = form.errors as Record<string, string | undefined>;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(row ? `/finance/cash/${row.id}` : '/finance/cash', { preserveScroll: true, forceFormData: true, onSuccess: onClose });
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{row ? 'Edit rekod' : direction === 'in' ? 'Rekod cash in' : 'Rekod cash out'}</DialogTitle>
                    <DialogDescription>
                        {direction === 'in'
                            ? 'Bayaran customer untuk order direkod di halaman order, bukan di sini.'
                            : 'Pautkan bayaran kilang / komisen ke order supaya forecast tahu apa yang sudah dibayar.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
                    <Field label="Kategori *" error={err.category}>
                        <NativeSelect value={form.data.category} onChange={(e) => form.setData('category', e.target.value)}>
                            {Object.entries(categories[direction]).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </NativeSelect>
                    </Field>
                    <Field label="Amaun (RM) *" error={err.amount}>
                        <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={form.data.amount}
                            onChange={(e) => form.setData('amount', e.target.value)}
                            required
                        />
                    </Field>
                    <Field label="Keterangan *" error={err.description} className="sm:col-span-2">
                        <Input
                            value={form.data.description}
                            onChange={(e) => form.setData('description', e.target.value)}
                            placeholder={direction === 'in' ? 'cth: Modal tambahan dari Ammar' : 'cth: Bayaran kilang batch jersey UM'}
                            required
                        />
                    </Field>
                    <Field label="Tarikh *" error={err.entry_date}>
                        <Input type="date" value={form.data.entry_date} onChange={(e) => form.setData('entry_date', e.target.value)} required />
                    </Field>
                    <Field label={direction === 'in' ? 'Dari' : 'Dibayar kepada'} error={err.party}>
                        <Input
                            value={form.data.party}
                            onChange={(e) => form.setData('party', e.target.value)}
                            placeholder={direction === 'out' ? 'cth: Kilang ABC' : ''}
                        />
                    </Field>
                    <Field label="Kaedah" error={err.method}>
                        <NativeSelect value={form.data.method} onChange={(e) => form.setData('method', e.target.value)}>
                            <option value="">-</option>
                            {Object.entries(methods).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </NativeSelect>
                    </Field>
                    <Field label="No. rujukan" error={err.reference}>
                        <Input value={form.data.reference} onChange={(e) => form.setData('reference', e.target.value)} />
                    </Field>
                    <Field label="Order berkaitan" error={err.order_id}>
                        <NativeSelect value={form.data.order_id} onChange={(e) => form.setData('order_id', e.target.value)}>
                            <option value="">Tiada</option>
                            {orders.map((order) => (
                                <option key={order.id} value={order.id}>
                                    {order.order_no} · {order.title}
                                </option>
                            ))}
                        </NativeSelect>
                    </Field>
                    <Field label="Projek / kempen" error={err.campaign_id}>
                        <NativeSelect value={form.data.campaign_id} onChange={(e) => form.setData('campaign_id', e.target.value)}>
                            <option value="">Tiada</option>
                            {campaigns.map((campaign) => (
                                <option key={campaign.id} value={campaign.id}>
                                    {campaign.name}
                                </option>
                            ))}
                        </NativeSelect>
                    </Field>
                    <Field label={row?.receipt_url ? 'Tukar resit' : 'Resit (gambar / PDF)'} error={err.receipt} className="sm:col-span-2">
                        <Input type="file" accept="image/*,.pdf" onChange={(e) => form.setData('receipt', e.target.files?.[0] ?? null)} />
                    </Field>
                    <DialogFooter className="sm:col-span-2">
                        <Button type="button" variant="ghost" onClick={onClose}>
                            Batal
                        </Button>
                        <Button disabled={form.processing}>Simpan</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function Field({ label, error, className, children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
    return (
        <div className={cn('grid gap-1.5', className)}>
            <Label>{label}</Label>
            {children}
            <InputError message={error} />
        </div>
    );
}
