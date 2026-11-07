import { confirmDialog } from '@/components/confirm-dialog';
import InputError from '@/components/input-error';
import { RiskBadges, StageBadge } from '@/components/order-badges';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { dateTime, fileSize, rm, shortDate, today } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type OrderSummary, type SharedData, type StageOption } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    Check,
    CheckCircle2,
    Circle,
    ExternalLink,
    FileText,
    ListOrdered,
    MessageCircle,
    Pencil,
    Printer,
    Star,
    Trash2,
    Undo2,
    Upload,
    XCircle,
} from 'lucide-react';
import { FormEvent, useState } from 'react';

interface ChecklistItem {
    key: string;
    label: string;
    done: boolean;
}

interface OrderDetail extends OrderSummary {
    sales: string | null;
    subtotal: number;
    discount: number;
    shipping_fee: number;
    deposit_required: number;
    balance: number;
    commission_amount: number;
    cost: number;
    profit: number;
    profit_per_piece: number | null;
    postage_cost: number;
    postage_estimated: boolean;
    notes: string | null;
    jobsheet_notes: string | null;
    invoice_no: string;
    invoice_sent_at: string | null;
    confirmed_at: string | null;
    design_approved_at: string | null;
    jobsheet_submitted_at: string | null;
    supplier_ref: string | null;
    production_received_at: string | null;
    shipping_method: string | null;
    shipped_at: string | null;
    tracking_sent_at: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
    cancel_reason: string | null;
    feedback_rating: number | null;
    feedback_comment: string | null;
    checklist: ChecklistItem[];
    can_advance: boolean;
    next_stage_label: string | null;
    stage_position: number;
    public_invoice_url: string;
    track_url: string;
    items: {
        id: number;
        description: string;
        fabric: string | null;
        spec: string | null;
        names: { name: string | null; number: string | null; size: string | null }[];
        quantity: number;
        unit_price: number;
        pricelist_code: string | null;
        addons: string[];
        is_service: boolean;
        sizes: Record<string, number>;
        sizes_total: number;
        line_total: number;
        notes: string | null;
    }[];
    payments: {
        id: number;
        type: string;
        amount: number;
        method: string | null;
        reference: string | null;
        paid_on: string;
        proof_url: string | null;
        user: string | null;
    }[];
    attachments: { id: number; kind: string; kind_label: string; url: string; name: string; size: number; is_image: boolean; created_at: string }[];
    activities: { id: number; type: string; message: string; user: string | null; created_at: string }[];
}

type CustomerInfo = {
    name: string;
    phone: string;
    email: string | null;
    organization: string | null;
    state: string | null;
    address: string | null;
    whatsapp: string;
};

interface Props {
    order: Omit<OrderDetail, 'customer'> & { customer: CustomerInfo };
    stages: StageOption[];
    paymentTypes: Record<string, string>;
    paymentMethods: Record<string, string>;
    attachmentKinds: Record<string, string>;
    company: { name: string };
    retentionDays: number;
}

type Order = Props['order'];

const post = (url: string, data: Record<string, unknown> = {}) => router.post(url, data as never, { preserveScroll: true });

function waLink(order: Order, text: string) {
    return `https://wa.me/${order.customer.whatsapp}?text=${encodeURIComponent(text)}`;
}

export default function OrderShow(props: Props) {
    const { order, stages } = props;
    const { auth } = usePage<SharedData>().props;

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Order Board', href: '/orders' },
                { title: order.order_no, href: `/orders/${order.id}` },
            ]}
        >
            <Head title={`${order.order_no} · ${order.title}`} />
            <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="text-muted-foreground font-mono text-sm">{order.order_no}</div>
                        <h1 className="text-primary text-xl font-semibold">{order.title}</h1>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <StageBadge stage={order.stage} label={order.stage_label} />
                            <RiskBadges order={order} />
                            <span className="text-muted-foreground text-sm">
                                · {order.quantity} helai · {rm(order.total)}
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" asChild>
                            <Link href={`/orders/${order.id}/edit`}>
                                <Pencil /> Edit
                            </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <a href={`/orders/${order.id}/invoice`} target="_blank">
                                <FileText /> Invoice
                            </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <a href={`/orders/${order.id}/jobsheet`} target="_blank">
                                <Printer /> Jobsheet
                            </a>
                        </Button>
                        {auth.is_admin && <AdminActions order={order} retentionDays={props.retentionDays} />}
                    </div>
                </div>

                <Stepper stages={stages} order={order} />

                <div className="grid gap-4 lg:grid-cols-3">
                    <div className="flex flex-col gap-4 lg:col-span-2">
                        <CurrentStage {...props} />
                        <Items order={order} />
                        <Files order={order} kinds={props.attachmentKinds} />
                        <Activity order={order} />
                    </div>
                    <div className="flex flex-col gap-4">
                        <CustomerCard order={order} />
                        <Payments order={order} types={props.paymentTypes} methods={props.paymentMethods} />
                        <KeyDates order={order} />
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function AdminActions({ order, retentionDays }: { order: Order; retentionDays: number }) {
    return (
        <>
            {order.stage_position > 0 && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                        const ok = await confirmDialog({
                            title: 'Undur order ke peringkat sebelumnya?',
                            message: 'Checklist peringkat semasa tidak dipadam.',
                            confirmLabel: 'Undur',
                        });
                        if (ok !== false) post(`/orders/${order.id}/revert`);
                    }}
                    title="Undur peringkat"
                >
                    <Undo2 /> Undur
                </Button>
            )}
            <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                    if (order.cancelled) {
                        const ok = await confirmDialog({ title: `Pulihkan order ${order.order_no}?`, confirmLabel: 'Pulihkan' });
                        if (ok !== false) post(`/orders/${order.id}/cancel`);
                        return;
                    }
                    const reason = await confirmDialog({
                        title: `Batal order ${order.order_no}?`,
                        message: `Order akan dikeluarkan dari Order Board. Admin boleh pulihkan dalam ${retentionDays} hari — selepas itu order dipadam kekal.`,
                        input: { label: 'Sebab batal (optional)', placeholder: 'cth: Customer tarik diri' },
                        confirmLabel: 'Batal order',
                        destructive: true,
                    });
                    if (reason !== false) post(`/orders/${order.id}/cancel`, { reason });
                }}
            >
                <XCircle /> {order.cancelled ? 'Pulihkan order' : 'Batal order'}
            </Button>
        </>
    );
}

function Stepper({ stages, order }: { stages: StageOption[]; order: Order }) {
    return (
        <Card>
            <CardContent className="overflow-x-auto p-4">
                <ol className="flex min-w-[720px] items-center">
                    {stages.map((stage, index) => {
                        const done = index < order.stage_position || order.stage === 'completed';
                        const current = index === order.stage_position && order.stage !== 'completed';

                        return (
                            <li key={stage.value} className="flex flex-1 items-center last:flex-none">
                                <div className="flex items-center gap-2">
                                    <span
                                        className={cn(
                                            'flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold',
                                            done && 'border-emerald-600 bg-emerald-600 text-white',
                                            current && 'border-primary text-primary',
                                            !done && !current && 'text-muted-foreground border-border',
                                        )}
                                    >
                                        {done ? <Check className="size-4" /> : index + 1}
                                    </span>
                                    <span
                                        className={cn(
                                            'text-xs leading-tight',
                                            current ? 'font-semibold' : 'text-muted-foreground',
                                            done && 'text-foreground',
                                        )}
                                    >
                                        {stage.label}
                                    </span>
                                </div>
                                {index < stages.length - 1 && (
                                    <span className={cn('mx-2 h-0.5 min-w-4 flex-1', done ? 'bg-emerald-600' : 'bg-border')} />
                                )}
                            </li>
                        );
                    })}
                </ol>
            </CardContent>
        </Card>
    );
}

function CurrentStage({ order, paymentMethods, company }: Props) {
    const { auth } = usePage<SharedData>().props;

    if (order.cancelled) {
        const daysLeft = order.purge_at
            ? Math.max(0, Math.ceil((new Date(order.purge_at.replace(' ', 'T')).getTime() - Date.now()) / 86_400_000))
            : null;

        return (
            <Card className="border-red-200 bg-red-50/40">
                <CardContent className="space-y-3 p-6 text-center">
                    <XCircle className="mx-auto size-8 text-red-500" />
                    <div>
                        <p className="font-medium">Order ini telah dibatalkan</p>
                        <p className="text-muted-foreground text-sm">
                            {dateTime(order.cancelled_at)}
                            {order.cancel_reason && ` · Sebab: ${order.cancel_reason}`}
                        </p>
                    </div>
                    {order.purge_at && (
                        <p className="text-sm text-red-700">
                            Akan dipadam kekal pada <strong>{shortDate(order.purge_at)}</strong>
                            {daysLeft !== null && ` (${daysLeft === 0 ? 'hari ini' : `${daysLeft} hari lagi`})`}.
                        </p>
                    )}
                    {auth.is_admin ? (
                        <Button onClick={() => post(`/orders/${order.id}/cancel`)}>
                            <Undo2 /> Pulihkan order
                        </Button>
                    ) : (
                        <p className="text-muted-foreground text-xs">Hubungi admin untuk pulihkan order ini.</p>
                    )}
                </CardContent>
            </Card>
        );
    }

    if (order.stage === 'completed') {
        return <Feedback order={order} company={company} />;
    }

    return (
        <Card className="border-primary/40">
            <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">
                        Peringkat {order.stage_position + 1}: {order.stage_label}
                    </CardTitle>
                    <span className={cn('text-xs', order.is_late ? 'font-medium text-red-600' : 'text-muted-foreground')}>
                        {order.stage === 'production' && order.due_date
                            ? `Due kilang: ${shortDate(order.due_date)}`
                            : `${order.days_in_stage} / ${order.target_days} hari bekerja di peringkat ini`}
                    </span>
                </div>
                <p className="text-muted-foreground text-sm">Lengkapkan semua di bawah untuk proceed ke peringkat seterusnya.</p>
            </CardHeader>
            <CardContent className="space-y-3">
                {order.checklist.map((item) => (
                    <div key={item.key} className={cn('rounded-lg border p-3', item.done && 'bg-emerald-50/60')}>
                        <div className="flex items-center gap-2 text-sm font-medium">
                            {item.done ? (
                                <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                            ) : (
                                <Circle className="text-muted-foreground size-5 shrink-0" />
                            )}
                            <span className={cn(item.done && 'text-emerald-800')}>{item.label}</span>
                        </div>
                        <div className="mt-2 pl-7">
                            <ChecklistAction itemKey={item.key} done={item.done} order={order} methods={paymentMethods} company={company} />
                        </div>
                    </div>
                ))}

                <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-3">
                    {!order.can_advance && <span className="text-muted-foreground text-xs">Butang aktif bila semua checklist lengkap.</span>}
                    <Button disabled={!order.can_advance} onClick={() => post(`/orders/${order.id}/advance`)}>
                        Proceed ke {order.next_stage_label} <ArrowRight />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function ChecklistAction({
    itemKey,
    done,
    order,
    methods,
    company,
}: {
    itemKey: string;
    done: boolean;
    order: Order;
    methods: Record<string, string>;
    company: { name: string };
}) {
    switch (itemKey) {
        case 'items':
            return (
                <Button size="sm" variant="outline" asChild>
                    <Link href={`/orders/${order.id}/edit`}>
                        <Pencil /> {done ? 'Edit helaian & harga' : 'Isi helaian & harga'}
                    </Link>
                </Button>
            );

        case 'invoice': {
            const message =
                `Salam ${order.customer.name}, terima kasih kerana memilih ${company.name}! 🙏\n\n` +
                `Invoice ${order.invoice_no} untuk "${order.title}" (${order.quantity} helai):\n${order.public_invoice_url}\n\n` +
                `Jumlah: ${rm(order.total)}\nDeposit untuk mula proses: ${rm(order.deposit_required)}`;

            return (
                <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" asChild>
                        <a href={`/orders/${order.id}/invoice`} target="_blank">
                            <FileText /> Lihat invoice
                        </a>
                    </Button>
                    <Button size="sm" variant="outline" asChild onClick={() => !done && post(`/orders/${order.id}/invoice-sent`)}>
                        <a href={waLink(order, message)} target="_blank" rel="noreferrer">
                            <MessageCircle /> Hantar via WhatsApp
                        </a>
                    </Button>
                    {!done && (
                        <Button size="sm" variant="ghost" onClick={() => post(`/orders/${order.id}/invoice-sent`)}>
                            Tanda dah hantar
                        </Button>
                    )}
                    {done && <span className="text-muted-foreground text-xs">Dihantar {dateTime(order.invoice_sent_at)}</span>}
                </div>
            );
        }

        case 'deposit':
            return done ? null : (
                <PaymentForm order={order} methods={methods} type="deposit" amount={Math.max(0, order.deposit_required - order.paid)} compact />
            );

        case 'design_final':
            return <UploadForm order={order} kind="design_final" compact />;

        case 'design_approved':
            return done ? (
                <span className="text-muted-foreground text-xs">Disahkan {dateTime(order.design_approved_at)}</span>
            ) : (
                <Button size="sm" variant="outline" onClick={() => post(`/orders/${order.id}/approve-design`)}>
                    <Check /> Customer dah approve design
                </Button>
            );

        case 'sizes':
            return (
                <Button size="sm" variant={done ? 'outline' : 'default'} asChild>
                    <Link href={`/orders/${order.id}/names`}>
                        <ListOrdered /> {done ? 'Semak senarai nama & saiz' : 'Isi senarai nama & saiz'}
                    </Link>
                </Button>
            );

        case 'jobsheet':
            return done ? (
                <span className="text-muted-foreground text-xs">
                    Dihantar {dateTime(order.jobsheet_submitted_at)} {order.supplier_ref && `· Ref ${order.supplier_ref}`} · Due{' '}
                    {shortDate(order.due_date)}
                </span>
            ) : (
                <JobsheetForm order={order} />
            );

        case 'received':
            return done ? (
                <span className="text-muted-foreground text-xs">Diterima {dateTime(order.production_received_at)}</span>
            ) : (
                <div className="flex flex-wrap items-center gap-3">
                    <Button size="sm" variant="outline" onClick={() => post(`/orders/${order.id}/receive-production`)}>
                        <Check /> Baju dah sampai & QC OK
                    </Button>
                    <span className="text-muted-foreground text-xs">Due kilang: {shortDate(order.due_date)}</span>
                </div>
            );

        case 'balance':
            return done ? null : <PaymentForm order={order} methods={methods} type="balance" amount={Math.max(0, order.balance)} compact />;

        case 'shipped':
            return done ? <ShippedSummary order={order} /> : <ShipForm order={order} />;

        case 'tracking_sent': {
            if (!order.shipped_at) {
                return <span className="text-muted-foreground text-xs">Rekod baju dipos & kos pos dahulu.</span>;
            }

            const pickup = order.shipping_method === 'pickup';
            const message = pickup
                ? `Salam ${order.customer.name}, baju "${order.title}" (${order.quantity} helai) dah siap dan sedia untuk diambil. 🙌\n\nTerima kasih kerana memilih ${company.name}!`
                : `Salam ${order.customer.name}, baju "${order.title}" (${order.quantity} helai) dah dipos! 📦\n\nNo. tracking: \n\nTerima kasih kerana memilih ${company.name}!`;

            return done ? (
                <span className="text-muted-foreground text-xs">Dimaklumkan {dateTime(order.tracking_sent_at)}</span>
            ) : (
                <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" asChild onClick={() => post(`/orders/${order.id}/tracking-sent`)}>
                        <a href={waLink(order, message)} target="_blank" rel="noreferrer">
                            <MessageCircle /> {pickup ? 'Maklumkan via WhatsApp' : 'Hantar tracking via WhatsApp'}
                        </a>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => post(`/orders/${order.id}/tracking-sent`)}>
                        Tanda dah hantar
                    </Button>
                    {!pickup && (
                        <span className="text-muted-foreground w-full text-xs">Tampal no. tracking dalam mesej WhatsApp sebelum hantar.</span>
                    )}
                </div>
            );
        }

        default:
            return null;
    }
}

function JobsheetForm({ order }: { order: Order }) {
    const form = useForm({ supplier_ref: '' });

    return (
        <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
                event.preventDefault();
                form.post(`/orders/${order.id}/submit-jobsheet`, { preserveScroll: true });
            }}
        >
            <Button type="button" size="sm" variant="outline" asChild>
                <a href={`/orders/${order.id}/jobsheet`} target="_blank">
                    <Printer /> Print jobsheet
                </a>
            </Button>
            <Input
                className="h-9 w-48"
                placeholder="No. rujukan kilang (optional)"
                value={form.data.supplier_ref}
                onChange={(e) => form.setData('supplier_ref', e.target.value)}
            />
            <Button size="sm" disabled={form.processing}>
                <Upload /> Dah submit ke kilang
            </Button>
            <span className="text-muted-foreground w-full text-xs">Due date = 6 hari bekerja dari tarikh submit.</span>
        </form>
    );
}

function ShippedSummary({ order }: { order: Order }) {
    const [editing, setEditing] = useState(false);

    if (editing) return <ShipForm order={order} onDone={() => setEditing(false)} />;

    return (
        <span className="text-muted-foreground text-xs">
            {order.shipping_method === 'pickup' ? 'Diambil sendiri' : `Dipos · kos pos sebenar ${rm(order.postage_cost)}`} ·{' '}
            {dateTime(order.shipped_at)} ·{' '}
            <button type="button" className="underline-offset-2 hover:underline" onClick={() => setEditing(true)}>
                ubah
            </button>
        </span>
    );
}

/** Mark the order posted / picked up with the actual postage paid (also used to correct it later). */
function ShipForm({ order, onDone }: { order: Order; onDone?: () => void }) {
    const editing = order.shipped_at !== null;
    const form = useForm({
        shipping_method: order.shipping_method ?? 'courier',
        postage_cost: editing && !order.postage_estimated ? String(order.postage_cost) : '',
    });

    return (
        <form
            className="flex flex-wrap items-start gap-2"
            onSubmit={(event) => {
                event.preventDefault();
                form.post(`/orders/${order.id}/ship`, { preserveScroll: true, onSuccess: onDone });
            }}
        >
            <NativeSelect className="h-9 w-40" value={form.data.shipping_method} onChange={(e) => form.setData('shipping_method', e.target.value)}>
                <option value="courier">Pos / Kurier</option>
                <option value="pickup">Self pickup</option>
            </NativeSelect>
            {form.data.shipping_method === 'courier' ? (
                <div className="relative w-44">
                    <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">RM</span>
                    <Input
                        className="h-9 pl-10"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Kos pos sebenar"
                        value={form.data.postage_cost}
                        onChange={(e) => form.setData('postage_cost', e.target.value)}
                        required
                        autoFocus={editing}
                    />
                </div>
            ) : (
                <span className="text-muted-foreground self-center text-xs">Customer ambil sendiri, kos pos RM0.</span>
            )}
            <Button size="sm" className="h-9" disabled={form.processing}>
                {editing ? 'Simpan' : 'Baju dah dipos'}
            </Button>
            {onDone && (
                <Button type="button" size="sm" variant="ghost" className="h-9" onClick={onDone}>
                    Batal
                </Button>
            )}
            <span className="text-muted-foreground w-full text-xs">
                Isi jumlah sebenar yang dibayar kepada kurier
                {order.shipping_fee > 0 && ` (caj pos kepada customer: ${rm(order.shipping_fee)})`}. Direkod sebagai cash out automatik.
            </span>
            <InputError className="w-full" message={form.errors.postage_cost} />
        </form>
    );
}

function Feedback({ order, company }: { order: Order; company: { name: string } }) {
    const form = useForm({ feedback_rating: order.feedback_rating ?? 0, feedback_comment: order.feedback_comment ?? '' });
    const message = `Salam ${order.customer.name}, harap baju "${order.title}" sampai dengan selamat! 🙌\n\nBoleh kongsi feedback ringkas tentang servis ${company.name}? Rating 1-5 dan komen anda sangat membantu kami. Terima kasih!`;

    return (
        <Card className="border-emerald-300">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <CheckCircle2 className="size-5 text-emerald-600" /> Order complete
                </CardTitle>
                <p className="text-muted-foreground text-sm">Dapatkan feedback customer dan rekod di sini.</p>
            </CardHeader>
            <CardContent>
                <form
                    className="space-y-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.post(`/orders/${order.id}/feedback`, { preserveScroll: true });
                    }}
                >
                    <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((value) => (
                            <button key={value} type="button" onClick={() => form.setData('feedback_rating', value)} aria-label={`${value} bintang`}>
                                <Star
                                    className={cn(
                                        'size-7',
                                        value <= form.data.feedback_rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground',
                                    )}
                                />
                            </button>
                        ))}
                    </div>
                    <Textarea
                        rows={3}
                        placeholder="Komen customer"
                        value={form.data.feedback_comment}
                        onChange={(e) => form.setData('feedback_comment', e.target.value)}
                    />
                    <InputError message={form.errors.feedback_rating} />
                    <div className="flex flex-wrap justify-between gap-2">
                        <Button type="button" variant="outline" size="sm" asChild>
                            <a href={waLink(order, message)} target="_blank" rel="noreferrer">
                                <MessageCircle /> Minta feedback via WhatsApp
                            </a>
                        </Button>
                        <Button size="sm" disabled={form.processing || form.data.feedback_rating === 0}>
                            Simpan feedback
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

function PaymentForm({
    order,
    methods,
    type,
    amount,
    types,
    compact = false,
}: {
    order: Order;
    methods: Record<string, string>;
    type: string;
    amount: number;
    types?: Record<string, string>;
    compact?: boolean;
}) {
    const form = useForm<{ type: string; amount: string; method: string; reference: string; paid_on: string; proof: File | null }>({
        type,
        amount: amount > 0 ? amount.toFixed(2) : '',
        method: 'transfer',
        reference: '',
        paid_on: today(),
        proof: null,
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(`/orders/${order.id}/payments`, { preserveScroll: true, onSuccess: () => form.reset('reference', 'proof') });
    };

    return (
        <form onSubmit={submit} className={cn('grid gap-2', compact ? 'sm:grid-cols-[8rem_9rem_1fr_9.5rem]' : '')}>
            {types && (
                <NativeSelect className="h-9" value={form.data.type} onChange={(e) => form.setData('type', e.target.value)}>
                    {Object.entries(types).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </NativeSelect>
            )}
            <Input
                className="h-9"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="RM"
                value={form.data.amount}
                onChange={(e) => form.setData('amount', e.target.value)}
                required
            />
            <NativeSelect className="h-9" value={form.data.method} onChange={(e) => form.setData('method', e.target.value)}>
                {Object.entries(methods).map(([value, label]) => (
                    <option key={value} value={value}>
                        {label}
                    </option>
                ))}
            </NativeSelect>
            <Input
                className="h-9"
                placeholder="No. rujukan"
                value={form.data.reference}
                onChange={(e) => form.setData('reference', e.target.value)}
            />
            <Input className="h-9" type="date" value={form.data.paid_on} onChange={(e) => form.setData('paid_on', e.target.value)} required />
            <Input
                className={cn('h-9 text-xs', compact && 'sm:col-span-3')}
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => form.setData('proof', e.target.files?.[0] ?? null)}
            />
            <Button size="sm" className="h-9" disabled={form.processing}>
                Rekod bayaran
            </Button>
            <InputError className={compact ? 'sm:col-span-4' : ''} message={form.errors.amount || form.errors.proof} />
        </form>
    );
}

function UploadForm({ order, kind, kinds, compact = false }: { order: Order; kind: string; kinds?: Record<string, string>; compact?: boolean }) {
    const [key, setKey] = useState(0);
    const form = useForm<{ kind: string; files: File[] }>({ kind, files: [] });
    const errors = form.errors as Record<string, string>;

    return (
        <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
                event.preventDefault();
                form.post(`/orders/${order.id}/attachments`, {
                    preserveScroll: true,
                    onSuccess: () => {
                        form.reset('files');
                        setKey((k) => k + 1);
                    },
                });
            }}
        >
            {kinds && (
                <NativeSelect className="h-9 w-44" value={form.data.kind} onChange={(e) => form.setData('kind', e.target.value)}>
                    {Object.entries(kinds).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </NativeSelect>
            )}
            <Input
                key={key}
                className="h-9 max-w-xs text-xs"
                type="file"
                multiple
                onChange={(e) => form.setData('files', Array.from(e.target.files ?? []))}
            />
            <Button size="sm" className="h-9" disabled={form.processing || form.data.files.length === 0}>
                <Upload /> {compact ? 'Upload design final' : 'Upload'}
            </Button>
            {form.progress && <span className="text-muted-foreground text-xs">{form.progress.percentage}%</span>}
            <InputError className="w-full" message={errors.files || errors['files.0']} />
        </form>
    );
}

function Items({ order }: { order: Order }) {
    return (
        <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 pb-3">
                <CardTitle className="text-base">Item & size</CardTitle>
                <Button size="sm" variant="ghost" asChild>
                    <Link href={`/orders/${order.id}/names`}>
                        <ListOrdered /> Senarai nama & saiz
                    </Link>
                </Button>
            </CardHeader>
            <CardContent className="space-y-3">
                {order.items.map((item) => (
                    <div key={item.id} className="rounded-lg border p-3 text-sm">
                        <div className="flex flex-wrap justify-between gap-2">
                            <div>
                                <div className="font-medium">{item.description}</div>
                                <div className="text-muted-foreground text-xs">
                                    {item.is_service ? 'Caj tambahan' : (item.fabric ?? '-')}
                                    {item.pricelist_code && ` · ${item.pricelist_code}`}
                                    {item.notes && ` · ${item.notes}`}
                                </div>
                                {item.spec && <div className="text-xs">{item.spec}</div>}
                            </div>
                            <div className="text-right tabular-nums">
                                <div>
                                    {item.quantity} × {rm(item.unit_price)}
                                </div>
                                <div className="font-medium">{rm(item.line_total)}</div>
                            </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {item.addons.map((addOn) => (
                                <span key={addOn} className="bg-primary/10 text-primary rounded px-2 py-0.5 text-xs font-medium">
                                    + {addOn}
                                </span>
                            ))}
                            {!item.is_service && Object.entries(item.sizes).length === 0 && (
                                <span className="text-muted-foreground text-xs">Senarai nama / saiz diisi semasa jobsheet</span>
                            )}
                            {Object.entries(item.sizes).map(([size, qty]) => (
                                <span key={size} className="bg-muted rounded px-2 py-0.5 text-xs tabular-nums">
                                    {size}: <strong>{qty}</strong>
                                </span>
                            ))}
                            {item.sizes_total > 0 && item.sizes_total !== item.quantity && (
                                <span className="text-xs text-amber-600">
                                    ({item.sizes_total}/{item.quantity} — belum sama)
                                </span>
                            )}
                        </div>
                        {item.names.length > 0 && (
                            <details className="mt-2">
                                <summary className="text-muted-foreground cursor-pointer text-xs">Senarai nama ({item.names.length})</summary>
                                <table className="mt-1 w-full text-xs">
                                    <tbody>
                                        {item.names.map((row, index) => (
                                            <tr key={index} className="border-b last:border-0">
                                                <td className="text-muted-foreground w-8 py-0.5 tabular-nums">{index + 1}</td>
                                                <td className="py-0.5">{row.name ?? '-'}</td>
                                                <td className="w-16 py-0.5 tabular-nums">{row.number ?? '-'}</td>
                                                <td className="w-16 py-0.5 font-medium">{row.size ?? '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </details>
                        )}
                    </div>
                ))}
                {order.jobsheet_notes && (
                    <div>
                        <Label className="text-muted-foreground text-xs">Nota jobsheet</Label>
                        <pre className="bg-muted mt-1 max-h-48 overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap">
                            {order.jobsheet_notes}
                        </pre>
                    </div>
                )}
                {order.notes && (
                    <div>
                        <Label className="text-muted-foreground text-xs">Nota dalaman</Label>
                        <p className="mt-1 text-sm whitespace-pre-line">{order.notes}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function Files({ order, kinds }: { order: Order; kinds: Record<string, string> }) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Design & fail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {order.attachments.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {order.attachments.map((file) => (
                            <div key={file.id} className="group relative overflow-hidden rounded-lg border">
                                <a href={file.url} target="_blank" rel="noreferrer" className="block">
                                    {file.is_image ? (
                                        <img src={file.url} alt={file.name} className="bg-muted aspect-square w-full object-cover" />
                                    ) : (
                                        <div className="bg-muted text-muted-foreground flex aspect-square items-center justify-center">
                                            <FileText className="size-10" />
                                        </div>
                                    )}
                                </a>
                                <div className="p-2 text-xs">
                                    <span
                                        className={cn(
                                            'rounded px-1.5 py-0.5 font-medium',
                                            file.kind === 'design_final' ? 'bg-emerald-100 text-emerald-800' : 'bg-muted',
                                        )}
                                    >
                                        {file.kind_label}
                                    </span>
                                    <div className="mt-1 truncate" title={file.name}>
                                        {file.name}
                                    </div>
                                    <div className="text-muted-foreground">{fileSize(file.size)}</div>
                                </div>
                                <button
                                    className="bg-background/90 absolute top-1.5 right-1.5 hidden rounded p-1 group-hover:block"
                                    onClick={async () => {
                                        const ok = await confirmDialog({ title: `Padam ${file.name}?`, confirmLabel: 'Padam', destructive: true });
                                        if (ok !== false) router.delete(`/orders/${order.id}/attachments/${file.id}`, { preserveScroll: true });
                                    }}
                                    aria-label="Padam fail"
                                >
                                    <Trash2 className="size-4 text-red-600" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                <UploadForm order={order} kind="mockup" kinds={kinds} />
            </CardContent>
        </Card>
    );
}

function CustomerCard({ order }: { order: Order }) {
    const { customer } = order;

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
                <div className="font-medium">{customer.name}</div>
                {customer.organization && <div className="text-muted-foreground">{customer.organization}</div>}
                <div>{customer.phone}</div>
                {customer.email && <div>{customer.email}</div>}
                {customer.state && <div>Pos ke: {customer.state}</div>}
                {customer.address && <div className="text-muted-foreground whitespace-pre-line">{customer.address}</div>}
                <div className="flex flex-wrap gap-2 pt-2">
                    <Button size="sm" variant="outline" asChild>
                        <a href={`https://wa.me/${customer.whatsapp}`} target="_blank" rel="noreferrer">
                            <MessageCircle /> WhatsApp
                        </a>
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                        <a href={order.track_url} target="_blank" rel="noreferrer">
                            <ExternalLink /> Link tracking
                        </a>
                    </Button>
                </div>
                {order.sales && <div className="text-muted-foreground pt-2 text-xs">Sales PIC: {order.sales}</div>}
                {order.agent && <div className="text-muted-foreground text-xs">Ejen: {order.agent}</div>}
            </CardContent>
        </Card>
    );
}

function Payments({ order, types, methods }: { order: Order; types: Record<string, string>; methods: Record<string, string> }) {
    const { auth } = usePage<SharedData>().props;
    const [open, setOpen] = useState(false);
    const percent = order.total > 0 ? Math.min(100, (order.paid / order.total) * 100) : 0;

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Bayaran</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
                <div className="space-y-1 tabular-nums">
                    <Line label="Subtotal">{rm(order.subtotal)}</Line>
                    {order.discount > 0 && <Line label="Diskaun">- {rm(order.discount)}</Line>}
                    {order.shipping_fee > 0 && <Line label="Caj pos">{rm(order.shipping_fee)}</Line>}
                    <Line label={<strong>Jumlah</strong>}>
                        <strong>{rm(order.total)}</strong>
                    </Line>
                    {auth.is_admin && (
                        <>
                            <div className="my-1 border-t" />
                            <Line label="Kos baju (pricelist)">- {rm(order.cost)}</Line>
                            {order.commission_amount > 0 && <Line label={`Komisen ejen (${order.agent})`}>- {rm(order.commission_amount)}</Line>}
                            <Line label={order.postage_estimated ? 'Kos pos (anggaran = caj pos)' : 'Kos pos sebenar'}>
                                - {rm(order.postage_cost)}
                            </Line>
                            <Line label={<strong>Untung bersih order</strong>}>
                                <strong className={order.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{rm(order.profit)}</strong>
                            </Line>
                            {order.profit_per_piece !== null && (
                                <Line label="Untung sehelai">
                                    <span className={order.profit_per_piece >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                                        {rm(order.profit_per_piece)} × {order.quantity}
                                    </span>
                                </Line>
                            )}
                            {order.postage_estimated && order.shipping_fee > 0 && (
                                <p className="text-muted-foreground text-xs">Kos pos sebenar diisi masa peringkat Postage.</p>
                            )}
                            <div className="my-1 border-t" />
                        </>
                    )}
                    <Line label="Deposit diperlukan">{rm(order.deposit_required)}</Line>
                    <Line label="Dibayar">{rm(order.paid)}</Line>
                    <Line label={<strong>Baki</strong>}>
                        <strong className={order.balance > 0 ? 'text-amber-600' : 'text-emerald-600'}>{rm(Math.max(0, order.balance))}</strong>
                    </Line>
                </div>
                <div className="bg-muted h-2 rounded">
                    <div className="h-2 rounded bg-emerald-600" style={{ width: `${percent}%` }} />
                </div>

                {order.payments.length > 0 && (
                    <ul className="divide-y rounded-md border">
                        {order.payments.map((payment) => (
                            <li key={payment.id} className="flex items-center justify-between gap-2 p-2 text-xs">
                                <div>
                                    <div className="font-medium">
                                        {payment.type} · {rm(payment.amount)}
                                    </div>
                                    <div className="text-muted-foreground">
                                        {shortDate(payment.paid_on)} · {payment.method} {payment.reference && `· ${payment.reference}`}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    {payment.proof_url && (
                                        <a href={payment.proof_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                                            Bukti
                                        </a>
                                    )}
                                    {auth.is_admin && (
                                        <button
                                            onClick={async () => {
                                                const ok = await confirmDialog({
                                                    title: 'Padam rekod bayaran ini?',
                                                    confirmLabel: 'Padam',
                                                    destructive: true,
                                                });
                                                if (ok !== false)
                                                    router.delete(`/orders/${order.id}/payments/${payment.id}`, { preserveScroll: true });
                                            }}
                                            aria-label="Padam bayaran"
                                        >
                                            <Trash2 className="size-3.5 text-red-600" />
                                        </button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                {open ? (
                    <PaymentForm
                        order={order}
                        methods={methods}
                        types={types}
                        type={order.paid > 0 ? 'balance' : 'deposit'}
                        amount={Math.max(0, order.balance)}
                    />
                ) : (
                    <Button size="sm" variant="outline" className="w-full" onClick={() => setOpen(true)}>
                        Rekod bayaran
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

function KeyDates({ order }: { order: Order }) {
    const rows: [string, string | null][] = [
        ['Order dicipta', order.created_at],
        ['Invoice dihantar', order.invoice_sent_at],
        ['Deposit / confirm', order.confirmed_at],
        ['Design approved', order.design_approved_at],
        ['Jobsheet ke kilang', order.jobsheet_submitted_at],
        ['Due kilang', order.due_date],
        ['Baju siap', order.production_received_at],
        ['Dipos', order.shipped_at],
        ['Complete', order.completed_at],
    ];

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Tarikh penting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
                <Line label="Customer perlukan">
                    <strong>{shortDate(order.required_by)}</strong>
                </Line>
                <Line label="Jangkaan pos">{shortDate(order.projected_ship_date)}</Line>
                <div className="my-2 border-t" />
                {rows.map(([label, value]) => (
                    <Line key={label} label={label}>
                        <span className={value ? '' : 'text-muted-foreground'}>{value ? shortDate(value) : '—'}</span>
                    </Line>
                ))}
            </CardContent>
        </Card>
    );
}

function Activity({ order }: { order: Order }) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Log aktiviti</CardTitle>
            </CardHeader>
            <CardContent>
                <ol className="relative space-y-3 border-l pl-4">
                    {order.activities.map((activity) => (
                        <li key={activity.id} className="text-sm">
                            <span
                                className={cn(
                                    'absolute -left-[5px] mt-1.5 size-2.5 rounded-full',
                                    activity.type === 'stage' ? 'bg-primary' : 'bg-border',
                                )}
                            />
                            <div className={activity.type === 'stage' ? 'font-medium' : ''}>{activity.message}</div>
                            <div className="text-muted-foreground text-xs">
                                {dateTime(activity.created_at)} {activity.user && `· ${activity.user}`}
                            </div>
                        </li>
                    ))}
                </ol>
            </CardContent>
        </Card>
    );
}

function Line({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right">{children}</span>
        </div>
    );
}
