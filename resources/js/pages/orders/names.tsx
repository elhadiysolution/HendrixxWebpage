import InputError from '@/components/input-error';
import { countSizes, NameList, type NameRow, sizeRatesText } from '@/components/name-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { dateTime, rm } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Head, Link, useForm } from '@inertiajs/react';
import { CheckCircle2, LoaderCircle, Printer } from 'lucide-react';
import { FormEvent } from 'react';

type Mode = 'names' | 'sizes';

interface ItemData {
    id: number;
    description: string;
    fabric: string | null;
    quantity: number;
    spec: string | null;
    sizes: Record<string, number>;
    names: { name: string | null; number: string | null; size: string | null }[];
}

interface Props {
    order: {
        id: number;
        order_no: string;
        title: string;
        stage_label: string;
        jobsheet_notes: string | null;
        jobsheet_submitted_at: string | null;
        items: ItemData[];
    };
    sizes: string[];
    sizeRates: Record<string, number>;
}

type FormItem = { id: number; mode: Mode; names: NameRow[]; sizes: Record<string, number | string> };

type NamesForm = { jobsheet_notes: string; items: FormItem[] };

const total = (sizes: Record<string, number | string>) => Object.values(sizes).reduce<number>((sum, value) => sum + Number(value || 0), 0);

export default function OrderNames({ order, sizes, sizeRates }: Props) {
    const { data, setData, transform, put, processing, errors } = useForm<NamesForm>({
        jobsheet_notes: order.jobsheet_notes ?? '',
        items: order.items.map((item) => ({
            id: item.id,
            // Plain shirts without names only need a size count.
            mode: item.names.length === 0 && total(item.sizes) > 0 ? 'sizes' : 'names',
            names: item.names.map((row) => ({ name: row.name ?? '', number: row.number ?? '', size: row.size ?? '' })),
            sizes: { ...item.sizes },
        })),
    });

    const err = errors as Record<string, string>;
    const setItem = (index: number, patch: Partial<FormItem>) =>
        setData(
            'items',
            data.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
        );

    const counted = (item: FormItem) => (item.mode === 'names' ? countSizes(item.names) : item.sizes);
    const complete = data.items.every((item, i) => total(counted(item)) === order.items[i].quantity);
    const surcharge = data.items.reduce(
        (sum, item) => sum + Object.entries(counted(item)).reduce((s, [size, qty]) => s + Number(qty || 0) * (sizeRates[size] ?? 0), 0),
        0,
    );

    transform((form) => ({
        jobsheet_notes: form.jobsheet_notes,
        items: form.items.map((item) =>
            item.mode === 'names' ? { id: item.id, names: item.names, sizes: {} } : { id: item.id, names: [], sizes: item.sizes },
        ),
    }));

    const submit = (event: FormEvent) => {
        event.preventDefault();
        put(`/orders/${order.id}/names`);
    };

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Order Board', href: '/orders' },
                { title: order.order_no, href: `/orders/${order.id}` },
                { title: 'Senarai nama & saiz', href: `/orders/${order.id}/names` },
            ]}
        >
            <Head title={`Senarai nama · ${order.order_no}`} />
            <form onSubmit={submit} className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4 md:p-6">
                <div>
                    <div className="text-muted-foreground font-mono text-sm">{order.order_no}</div>
                    <h1 className="text-primary text-xl font-semibold">Senarai nama, nombor & saiz</h1>
                    <p className="text-muted-foreground text-sm">
                        {order.title} · Untuk jobsheet kilang. Bilangan helai ikut invoice — jumlah saiz mesti sama sebelum jobsheet boleh dihantar.
                    </p>
                    {Object.keys(sizeRates).length > 0 && (
                        <p className="bg-muted/50 mt-2 rounded-md px-3 py-2 text-sm">
                            Caj saiz besar ditambah ke invoice secara automatik selepas simpan: {sizeRatesText(sizeRates)} / helai.
                        </p>
                    )}
                    {order.jobsheet_submitted_at && (
                        <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            Jobsheet sudah dihantar ke kilang pada {dateTime(order.jobsheet_submitted_at)}. Maklumkan kilang jika ada perubahan.
                        </p>
                    )}
                </div>

                {data.items.map((item, index) => {
                    const source = order.items[index];
                    const sum = total(counted(item));
                    const match = sum === source.quantity;

                    return (
                        <Card key={item.id}>
                            <CardHeader className="pb-3">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                        <CardTitle className="text-base">
                                            {index + 1}. {source.description}
                                        </CardTitle>
                                        <CardDescription>{[source.fabric, source.spec].filter(Boolean).join(' · ') || '—'}</CardDescription>
                                    </div>
                                    <span
                                        className={cn(
                                            'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums',
                                            match ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800',
                                        )}
                                    >
                                        {match && <CheckCircle2 className="size-3.5" />}
                                        {sum} / {source.quantity} helai
                                    </span>
                                </div>
                                <div className="bg-muted mt-2 inline-flex w-fit rounded-md p-0.5 text-sm">
                                    {(
                                        [
                                            ['names', 'Ada nama & nombor'],
                                            ['sizes', 'Saiz sahaja'],
                                        ] as const
                                    ).map(([mode, label]) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => setItem(index, { mode })}
                                            className={cn(
                                                'rounded px-3 py-1',
                                                item.mode === mode ? 'text-primary bg-white font-medium shadow-sm' : 'text-muted-foreground',
                                            )}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {item.mode === 'names' ? (
                                    <>
                                        <NameList
                                            names={item.names}
                                            sizes={sizes}
                                            errors={Object.keys(err).some((key) => key.startsWith(`items.${index}.names`))}
                                            onChange={(names) => setItem(index, { names })}
                                        />
                                        {item.names.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {Object.entries(countSizes(item.names)).map(([size, qty]) => (
                                                    <span key={size} className="bg-muted rounded px-2 py-0.5 text-xs tabular-nums">
                                                        {size}: <strong>{qty}</strong>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                                        {sizes.map((size) => (
                                            <label key={size} className="text-center">
                                                <span className="text-muted-foreground block text-xs">{size}</span>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    className="h-10 px-1 text-center"
                                                    value={item.sizes[size] ?? ''}
                                                    onChange={(e) => setItem(index, { sizes: { ...item.sizes, [size]: e.target.value } })}
                                                />
                                            </label>
                                        ))}
                                    </div>
                                )}
                                {!match && sum > 0 && (
                                    <p className="text-xs text-amber-700">
                                        {sum < source.quantity
                                            ? `Kurang ${source.quantity - sum} helai lagi.`
                                            : `Lebih ${sum - source.quantity} helai dari invoice — edit order jika customer tambah helaian.`}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}

                {data.items.length === 0 && (
                    <Card>
                        <CardContent className="text-muted-foreground p-6 text-center text-sm">Order ini tiada item baju.</CardContent>
                    </Card>
                )}

                <Card>
                    <CardContent className="grid gap-1.5 pt-6">
                        <Label>Nota jobsheet / produksi</Label>
                        <Textarea
                            rows={4}
                            placeholder="Arahan tambahan untuk kilang, cth: logo sponsor di lengan kanan"
                            value={data.jobsheet_notes}
                            onChange={(e) => setData('jobsheet_notes', e.target.value)}
                        />
                        <InputError message={err.jobsheet_notes} />
                    </CardContent>
                </Card>

                <div className="bg-background/80 sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
                    <span className="mr-auto text-sm">
                        <span className={complete ? 'text-emerald-700' : 'text-muted-foreground'}>
                            {complete ? '✓ Semua item lengkap — sedia untuk jobsheet' : 'Belum lengkap — boleh simpan dan sambung kemudian'}
                        </span>
                        {surcharge > 0 && <span className="block text-xs">Caj saiz besar: {rm(surcharge)} (ditambah ke invoice)</span>}
                    </span>
                    <Button variant="outline" asChild>
                        <Link href={`/orders/${order.id}`}>Batal</Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <a href={`/orders/${order.id}/jobsheet`} target="_blank">
                            <Printer /> Preview jobsheet
                        </a>
                    </Button>
                    <Button type="submit" disabled={processing}>
                        {processing && <LoaderCircle className="animate-spin" />}
                        Simpan
                    </Button>
                </div>
            </form>
        </AppLayout>
    );
}
