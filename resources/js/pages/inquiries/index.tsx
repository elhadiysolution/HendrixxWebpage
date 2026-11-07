import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import AppLayout from '@/layouts/app-layout';
import { dateTime, shortDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem, type Paginated } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowRight, MessageCircle } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Inquiry', href: '/inquiries' }];

interface Inquiry {
    id: number;
    name: string;
    phone: string;
    email: string | null;
    organization: string | null;
    product: string | null;
    quantity: number | null;
    message: string | null;
    status: string;
    required_by: string | null;
    created_at: string;
    order: { id: number; order_no: string } | null;
}

interface Props {
    inquiries: Paginated<Inquiry>;
    statuses: Record<string, string>;
    filters: { status: string };
}

const statusStyles: Record<string, string> = {
    new: 'bg-sky-100 text-sky-800',
    contacted: 'bg-amber-100 text-amber-800',
    converted: 'bg-emerald-100 text-emerald-800',
    lost: 'bg-neutral-200 text-neutral-700',
};

function whatsapp(phone: string) {
    const digits = phone.replace(/\D/g, '');
    return digits.startsWith('0') ? '6' + digits : digits;
}

export default function InquiriesIndex({ inquiries, statuses, filters }: Props) {
    const tabs = { open: 'Belum selesai', ...statuses, all: 'Semua' };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Inquiry" />
            <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
                <div>
                    <h1 className="text-primary text-xl font-semibold">Inquiry dari sales page</h1>
                    <p className="text-muted-foreground text-sm">Hubungi customer secepat mungkin, kemudian tukar jadi order.</p>
                </div>

                <div className="flex flex-wrap gap-1">
                    {Object.entries(tabs).map(([value, label]) => (
                        <Link
                            key={value}
                            href={`/inquiries?status=${value}`}
                            className={cn(
                                'rounded-md px-3 py-1.5 text-sm',
                                filters.status === value ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                            )}
                        >
                            {label}
                        </Link>
                    ))}
                </div>

                <div className="grid gap-3">
                    {inquiries.data.length === 0 && <p className="text-muted-foreground py-10 text-center text-sm">Tiada inquiry.</p>}
                    {inquiries.data.map((inquiry) => (
                        <div key={inquiry.id} className="bg-card flex flex-wrap items-start justify-between gap-4 rounded-lg border p-4">
                            <div className="min-w-0 flex-1 space-y-1 text-sm">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium">{inquiry.name}</span>
                                    {inquiry.organization && <span className="text-muted-foreground">· {inquiry.organization}</span>}
                                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusStyles[inquiry.status])}>
                                        {statuses[inquiry.status]}
                                    </span>
                                </div>
                                <div className="text-muted-foreground">
                                    {inquiry.product ?? 'Produk tidak dinyatakan'}
                                    {inquiry.quantity && ` · ${inquiry.quantity} helai`}
                                    {inquiry.required_by && ` · perlu ${shortDate(inquiry.required_by)}`}
                                </div>
                                {inquiry.message && <p className="whitespace-pre-line">{inquiry.message}</p>}
                                <div className="text-muted-foreground text-xs">
                                    {inquiry.phone} {inquiry.email && `· ${inquiry.email}`} · diterima {dateTime(inquiry.created_at)}
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button size="sm" variant="outline" asChild>
                                    <a
                                        href={`https://wa.me/${whatsapp(inquiry.phone)}?text=${encodeURIComponent(`Salam ${inquiry.name}, terima kasih atas inquiry di Hendrixx Exclusive!`)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={() =>
                                            inquiry.status === 'new' &&
                                            router.patch(`/inquiries/${inquiry.id}`, { status: 'contacted' }, { preserveScroll: true })
                                        }
                                    >
                                        <MessageCircle /> WhatsApp
                                    </a>
                                </Button>
                                <NativeSelect
                                    className="h-9 w-36"
                                    value={inquiry.status}
                                    onChange={(e) => router.patch(`/inquiries/${inquiry.id}`, { status: e.target.value }, { preserveScroll: true })}
                                >
                                    {Object.entries(statuses).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </NativeSelect>
                                {inquiry.order ? (
                                    <Button size="sm" variant="ghost" asChild>
                                        <Link href={`/orders/${inquiry.order.id}`}>{inquiry.order.order_no}</Link>
                                    </Button>
                                ) : (
                                    <Button size="sm" asChild>
                                        <Link href={`/orders/create?inquiry=${inquiry.id}`}>
                                            Jadikan order <ArrowRight />
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </AppLayout>
    );
}
