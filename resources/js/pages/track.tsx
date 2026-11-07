import { PublicHeader } from '@/components/public-header';
import { shortDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type StageOption, type StageValue } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Check, FileText, Search } from 'lucide-react';
import { FormEvent, useState } from 'react';

interface Result {
    order_no: string;
    title: string;
    quantity: number;
    stage: StageValue;
    cancelled: boolean;
    due_date: string | null;
    estimated_ship_date: string | null;
    shipping_method: string | null;
    courier: string | null;
    tracking_no: string | null;
    shipped_at: string | null;
    invoice_url: string;
}

interface Props {
    query: { order_no: string; phone: string };
    result: Result | null;
    notFound: boolean;
    stages: StageOption[];
}

const customerLabels: Record<StageValue, string> = {
    order: 'Order & deposit',
    design: 'Proses design',
    jobsheet: 'Persediaan produksi',
    production: 'Dalam produksi',
    postage: 'Sedia untuk pos',
    completed: 'Selesai',
};

export default function Track({ query, result, notFound, stages }: Props) {
    const [orderNo, setOrderNo] = useState(query.order_no);
    const [phone, setPhone] = useState(query.phone);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        router.get('/track', { order_no: orderNo, phone }, { preserveState: true });
    };

    const position = result ? stages.findIndex((stage) => stage.value === result.stage) : -1;

    return (
        <>
            <Head title="Track order" />
            <div className="bg-pattern min-h-screen text-[#12113a]">
                <PublicHeader />
                <main className="mx-auto max-w-2xl px-4 py-12">
                    <h1 className="text-3xl font-bold tracking-tight text-[#030164]">Track order anda</h1>
                    <p className="mt-2 text-slate-600">Masukkan no. order (cth: HX2610-001) dan no. telefon yang didaftarkan.</p>

                    <form onSubmit={submit} className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                        <input className={inputClass} placeholder="No. order" value={orderNo} onChange={(e) => setOrderNo(e.target.value)} required />
                        <input className={inputClass} placeholder="No. telefon" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                        <button className="inline-flex items-center justify-center gap-2 rounded-md bg-[#030164] px-5 py-2.5 font-semibold text-white hover:bg-[#02014a]">
                            <Search className="size-4" /> Semak
                        </button>
                    </form>

                    {notFound && (
                        <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                            Order tidak dijumpai. Sila semak no. order dan no. telefon.
                        </p>
                    )}

                    {result && (
                        <div className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="font-mono text-sm text-slate-500">{result.order_no}</div>
                                    <h2 className="text-xl font-semibold">{result.title}</h2>
                                    <div className="text-sm text-slate-600">{result.quantity} helai</div>
                                </div>
                                <a
                                    href={result.invoice_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"
                                >
                                    <FileText className="size-4" /> Invoice
                                </a>
                            </div>

                            {result.cancelled ? (
                                <p className="mt-6 text-sm text-slate-600">Order ini telah dibatalkan. Sila hubungi kami untuk maklumat lanjut.</p>
                            ) : (
                                <>
                                    <ol className="mt-6 space-y-0">
                                        {stages.map((stage, index) => {
                                            const done = index < position || result.stage === 'completed';
                                            const current = index === position && result.stage !== 'completed';

                                            return (
                                                <li key={stage.value} className="flex gap-3">
                                                    <div className="flex flex-col items-center">
                                                        <span
                                                            className={cn(
                                                                'flex size-7 items-center justify-center rounded-full border-2 text-xs font-semibold',
                                                                done && 'border-emerald-600 bg-emerald-600 text-white',
                                                                current && 'border-[#030164] bg-[#030164]/10 text-[#030164]',
                                                                !done && !current && 'border-slate-200 text-slate-400',
                                                            )}
                                                        >
                                                            {done ? <Check className="size-4" /> : index + 1}
                                                        </span>
                                                        {index < stages.length - 1 && (
                                                            <span
                                                                className={cn('w-0.5 flex-1', done ? 'bg-emerald-600' : 'bg-slate-200')}
                                                                style={{ minHeight: 20 }}
                                                            />
                                                        )}
                                                    </div>
                                                    <div className={cn('pb-5 text-sm', current ? 'font-semibold' : done ? '' : 'text-slate-400')}>
                                                        {customerLabels[stage.value]}
                                                        {current && (
                                                            <span className="ml-2 rounded-full bg-[#030164]/10 px-2 py-0.5 text-xs text-[#030164]">
                                                                Sekarang
                                                            </span>
                                                        )}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ol>

                                    <div className="mt-2 grid gap-2 rounded-lg bg-[#FCF9EA] p-4 text-sm">
                                        {result.shipped_at ? (
                                            <div>
                                                {result.shipping_method === 'pickup' ? (
                                                    <>Diambil pada {shortDate(result.shipped_at)}</>
                                                ) : (
                                                    <>
                                                        Dipos pada {shortDate(result.shipped_at)}
                                                        {result.tracking_no ? (
                                                            <>
                                                                {result.courier && (
                                                                    <>
                                                                        {' '}
                                                                        melalui <strong>{result.courier}</strong>
                                                                    </>
                                                                )}{' '}
                                                                — tracking <strong className="font-mono">{result.tracking_no}</strong>
                                                            </>
                                                        ) : (
                                                            '. No. tracking telah dihantar melalui WhatsApp.'
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        ) : (
                                            result.estimated_ship_date && (
                                                <div>
                                                    Anggaran pos: <strong>{shortDate(result.estimated_ship_date)}</strong>
                                                </div>
                                            )
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </>
    );
}

const inputClass =
    'w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#030164] focus:ring-2 focus:ring-[#030164]/20';
