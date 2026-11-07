import { HendrixxMark } from '@/components/hendrixx-logo';
import InputError from '@/components/input-error';
import { PublicHeader } from '@/components/public-header';
import { type SharedData } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    BadgeCheck,
    BadgePercent,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ClipboardCheck,
    Factory,
    Gift,
    Instagram,
    MessageCircle,
    MessageSquareHeart,
    Palette,
    PackageCheck,
    PenTool,
    Quote,
    Shirt,
    Sparkles,
    Star,
    Truck,
    Wallet,
    X,
    Zap,
} from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';

interface Props {
    fabrics: string[];
    productionDays: number;
    company: { name: string; phone: string; email: string; address: string };
}

const instagram = 'https://www.instagram.com/hendrixx.exclusive/';

// Types of baju we make (quote form dropdown)
const garments = [
    'Baju Korporat',
    'Baju Batik',
    'Baju E-Sport',
    'Baju Sukan Sekolah',
    'Baju Team Bola',
    'Baju Asrama / Kelas / Dorm',
    'T-Shirt Oversize Premium',
];

// Design catalog (public/images/designs). Add new designs here.
const designCategories = ['Jersey Sukan', 'Korporat', 'E-Sport', 'Universiti & Sekolah', 'Event & Organisasi'] as const;
type DesignCategory = (typeof designCategories)[number];

const designs: { code: string; title: string; file: string; category: DesignCategory }[] = [
    { code: '#HX-004', title: 'Sejaya', file: 'hx-004', category: 'Jersey Sukan' },
    { code: '#HX-022', title: 'Oracle SQL', file: 'hx-022', category: 'Korporat' },
    { code: '#HX-005', title: 'IIUM Mustang', file: 'hx-005', category: 'Universiti & Sekolah' },
    { code: '#HX-046', title: 'Evonik', file: 'hx-046', category: 'Korporat' },
    { code: 'E-Sport', title: 'Sentinels', file: 'sen', category: 'E-Sport' },
    { code: '#HX-038', title: 'Unifi TV', file: 'hx-038', category: 'Korporat' },
    { code: 'Polo', title: 'KMJ 24/25', file: 'kmj', category: 'Universiti & Sekolah' },
    { code: 'Jersey', title: 'Johor', file: 'johor', category: 'Jersey Sukan' },
    { code: 'Jaket', title: 'Jaket E-Sport', file: 'esports-jacket', category: 'E-Sport' },
    { code: '#HX-013', title: 'UPNM', file: 'hx-013', category: 'Universiti & Sekolah' },
    { code: 'Lengan panjang', title: 'CFS IIUM Virtual Run', file: 'cfs-iium-run', category: 'Event & Organisasi' },
    { code: '#HX-011', title: 'Android', file: 'hx-011', category: 'Korporat' },
    { code: 'Jersey', title: 'Invest Pahang', file: 'invest-pahang', category: 'Jersey Sukan' },
    { code: 'E-Sport', title: 'KRTKL', file: 'krtkl', category: 'E-Sport' },
    { code: '#HX-034', title: 'Diamond Pattern', file: 'hx-034', category: 'Jersey Sukan' },
    { code: 'T-Shirt', title: 'Food for Hunger', file: 'food-for-hunger', category: 'Event & Organisasi' },
    { code: 'Jersey', title: 'IIUM Black Gold', file: 'iium', category: 'Universiti & Sekolah' },
    { code: '#HX-059', title: 'Yoodo', file: 'hx-059', category: 'Korporat' },
    { code: 'Jersey', title: 'MotoGP', file: 'motogp', category: 'Jersey Sukan' },
    { code: 'Polo', title: 'Selangor', file: 'selangor', category: 'Event & Organisasi' },
    { code: '#HX-032', title: 'Rakuten', file: 'hx-032', category: 'Korporat' },
    { code: 'Jersey', title: 'Perlis', file: 'perlis', category: 'Jersey Sukan' },
    { code: 'T-Shirt', title: 'Phoenix', file: 'phoenix', category: 'Jersey Sukan' },
    { code: 'Jersey', title: 'Alpine', file: 'alpine', category: 'Jersey Sukan' },
    { code: 'Lengan panjang', title: 'Belia MFLS Perlis', file: 'belia-perlis', category: 'Event & Organisasi' },
    { code: 'Jersey', title: 'Bin Zayed Group', file: 'bin-zayed', category: 'Korporat' },
    { code: 'Jersey', title: 'Chevron Navy', file: 'chevron', category: 'Jersey Sukan' },
];

const products = [...garments, 'Lain-lain'];

// Customers featured in the @hendrixx.exclusive catalog
const clients = ['Baju Korporat', 'Baju Batik', 'Baju E-Sport', 'Baju Sukan Sekolah', 'Baju Team Bola', 'Baju Asrama / Kelas / Dorm', 'T-Shirt Oversize Premium'];

// Shown row by row in a 3-column grid
const portfolio = [
    { src: '/images/portfolio/upm-x-uitm.jpg', title: 'UPM x UiTM', tag: 'Universiti' },
    { src: '/images/portfolio/kitagrow.jpg', title: 'KitaGrow 2023', tag: 'Program / Event' },
    { src: '/images/portfolio/mrsm-mjsc.jpg', title: 'MRSM — MJSC', tag: 'Sekolah' },
    { src: '/images/portfolio/smap-kajang.jpg', title: 'SMAP Kajang Sports Jersey', tag: 'Hari Sukan' },
    { src: '/images/portfolio/thank-you-mosque.jpg', title: 'Jersey Program Surau', tag: 'Organisasi' },
    { src: '/images/portfolio/thank-you-school.jpg', title: 'Jersey Kelab Sekolah', tag: 'Sekolah' },
    { src: '/images/portfolio/politeknik-shah-alam.jpg', title: 'Politeknik Shah Alam Edition', tag: 'Politeknik' },
    { src: '/images/portfolio/uitm-di-hatiku.jpg', title: 'UiTM Di Hatiku', tag: 'Universiti' },
    { src: '/images/portfolio/yosh.jpg', title: 'Yosh — MyProspec 6.2', tag: 'Program / Event' },
];

// TODO: gantikan dengan feedback sebenar customer (screenshot WhatsApp / komen IG) sebelum go-live.
const testimonials = [
    {
        quote: 'Design cantik, kain sejuk dan selesa. Yang paling best, siap ikut tarikh yang dijanjikan — sempat untuk hari sukan!',
        name: 'Guru Penasihat',
        org: 'Kelab Sukan Sekolah',
    },
    {
        quote: 'Designer faham apa yang kami nak, design ikut tema program. Harga pun berpatutan untuk budget student.',
        name: 'Exco Program',
        org: 'Persatuan Universiti',
    },
    {
        quote: 'Nama dan nombor setiap helai tepat, tak ada yang tersalah. Senang urusan, update status pun jelas.',
        name: 'Pengurus Team',
        org: 'Team Esports',
    },
];

export default function Welcome({ fabrics, productionDays, company }: Props) {
    const { flash } = usePage<SharedData>().props;
    const whatsapp = `https://wa.me/${company.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Salam Hendrixx, saya nak tanya pasal jersey sublimation.')}`;

    const form = useForm({ name: '', phone: '', email: '', organization: '', product: products[0], quantity: '', required_by: '', message: '' });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post('/inquiries', { preserveScroll: true, onSuccess: () => form.reset() });
    };

    const promises = [
        {
            icon: Zap,
            big: `${productionDays} HARI`,
            title: 'Siap pantas',
            text: `Produksi siap dalam ${productionDays} hari bekerja selepas design & jobsheet disahkan. Tak perlu tunggu berminggu-minggu.`,
        },
        {
            icon: BadgeCheck,
            big: 'PREMIUM',
            title: 'Quality material',
            text: 'Kain jersey sublimation yang ringan, breathable & cepat kering. Warna terang, tak pudar, tak merekah.',
        },
        {
            icon: BadgePercent,
            big: 'MAMPU',
            title: 'Harga affordable',
            text: 'Harga berpatutan untuk sekolah, universiti, kelab & korporat. Lebih banyak helai, lebih jimat.',
        },
    ];

    const offers = [
        { icon: Palette, title: 'Design 100% custom', text: 'Designer in-house siapkan design ikut tema, logo & warna team anda.' },
        { icon: Sparkles, title: '3 kali perubahan design', text: 'Ubah warna, logo & susunan sehingga 3 kali sebelum anda approve.' },
        { icon: Shirt, title: 'Nama & nombor custom', text: 'Setiap helai boleh berbeza mengikut keperluan anda.' },
        { icon: Gift, title: 'Full sublimation tanpa had warna', text: 'Corak, gradient & logo sebanyak mana pun, harga sama.' },
        { icon: PackageCheck, title: 'QC setiap helai', text: 'Setiap jersey diperiksa sebelum dibungkus & dihantar.' },
        { icon: Truck, title: 'Pos seluruh Malaysia', text: 'Hantar terus ke sekolah / kampus anda, atau self pickup.' },
    ];

    // "Step to order" from the Hendrixx booking poster
    const steps = [
        { icon: Wallet, title: 'Deposit design', text: 'Bayar deposit dan beri keperluan design (logo, warna, tema) untuk mulakan proses.' },
        { icon: PenTool, title: 'Design phase', text: 'Team kami siapkan design custom anda dalam 3 hari bekerja — kreatif & trendy.' },
        { icon: ClipboardCheck, title: 'Finalize design', text: 'Semak & sahkan semula design (sehingga 3 kali perubahan) supaya tepat untuk event anda.' },
        { icon: Wallet, title: 'Submit order', text: 'Sahkan saiz, nama & nombor, dan jelaskan bayaran penuh sebelum produksi bermula.' },
        { icon: Factory, title: 'Production phase', text: `Produksi bermula — jersey custom anda siap dalam ${productionDays} hari bekerja.` },
        { icon: MessageSquareHeart, title: 'Feedback', text: 'Bila jersey sampai, kongsi pendapat anda supaya kami terus menambah baik.' },
    ];

    const faqs = [
        {
            q: `Betul ke boleh siap dalam ${productionDays} hari bekerja?`,
            a: `Ya. Tempoh ${productionDays} hari bekerja dikira selepas design diluluskan dan jobsheet (saiz, nama, nombor) lengkap. Kalau ada tarikh event, beritahu awal — kami rancang ikut tarikh anda.`,
        },
        {
            q: 'Saya tak ada design. Boleh bantu?',
            a: 'Boleh. Design 100% custom — cukup bagi logo, warna & idea, designer kami siapkan dalam 3 hari bekerja. Anda boleh minta sehingga 3 kali perubahan.',
        },
        { q: 'Boleh letak nama & nombor berbeza setiap helai?', a: 'Boleh, tanpa caj tambahan. Kami sediakan senarai untuk anda isi saiz, nama & nombor.' },
        {
            q: 'Macam mana nak bayar?',
            a: 'Bayar deposit untuk mulakan design. Selepas design disahkan, jelaskan bayaran penuh sebelum produksi bermula. Invoice dihantar terus ke WhatsApp.',
        },
        { q: 'Boleh tengok sampel kain dulu?', a: 'Boleh. WhatsApp kami untuk tanya pilihan kain dan cadangan yang sesuai dengan sukan / aktiviti anda.' },
    ];

    return (
        <>
            <Head title="Jersey Custom Siap 6 Hari">
                <meta
                    name="description"
                    content={`Hendrixx Exclusive — jersey full sublimation custom, siap dalam ${productionDays} hari bekerja. Quality material, harga affordable. Dipercayai UiTM, UPM, MRSM & sekolah seluruh Malaysia.`}
                />
            </Head>
            <div className="bg-pattern min-h-screen overflow-x-hidden text-[#12113a]">
                {/* Promo bar */}
                <div className="bg-[#E11D2E] px-4 py-2 text-center text-xs font-semibold tracking-wide text-white sm:text-sm">
                    🔥 Design custom + 3 kali perubahan · Nama & nombor tanpa caj · Siap {productionDays} hari bekerja ·{' '}
                    <a href="#quote" className="underline underline-offset-2">
                        Tempah slot sekarang
                    </a>
                </div>

                {/* Hero */}
                <section className="relative isolate overflow-hidden bg-[#030164] text-white">
                    <PublicHeader dark />
                    <Watermark />
                    <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#030164] via-[#030164]/95 to-[#1a1890]" />

                    <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-28 pb-20 sm:pt-36 lg:grid-cols-[1.1fr_1fr] lg:pb-28">
                        <div>
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/20 backdrop-blur">
                                <span className="flex gap-0.5 text-amber-300">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} className="size-3 fill-current" />
                                    ))}
                                </span>
                                Dipercayai sekolah, universiti & kelab sukan
                            </span>
                            <h1 className="mt-5 font-display text-5xl leading-[0.95] font-black tracking-tight uppercase italic sm:text-7xl">
                                Jersey custom
                                <br />
                                siap dalam{' '}
                                <span className="relative inline-block text-[#030164]">
                                    <span className="absolute inset-0 -skew-x-12 rounded bg-[#FCF9EA]" />
                                    <span className="relative px-2">{productionDays} hari</span>
                                </span>
                                <br />
                                <span className="text-[#FF4757]">bekerja.</span>
                            </h1>
                            <p className="mt-6 max-w-xl text-lg text-white/80">
                                Full sublimation, <strong className="text-white">quality material</strong>, harga{' '}
                                <strong className="text-white">affordable</strong>. Design 100% custom dengan 3 kali perubahan — anda bagi
                                idea, kami siapkan jersey team anda.
                            </p>
                            <div className="mt-8 flex flex-wrap gap-3">
                                <a
                                    href="#quote"
                                    className="rounded-md bg-[#E11D2E] px-7 py-3.5 font-bold tracking-wide text-white uppercase shadow-lg shadow-black/30 transition hover:-translate-y-0.5 hover:bg-[#c81726]"
                                >
                                    Dapatkan quote sekarang
                                </a>
                                <a
                                    href={whatsapp}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 rounded-md bg-white/10 px-6 py-3.5 font-semibold ring-1 ring-white/30 hover:bg-white/20"
                                >
                                    <MessageCircle className="size-5" /> WhatsApp kami
                                </a>
                            </div>
                            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
                                {['Kualiti tinggi', 'Damage free', 'Pos seluruh Malaysia'].map((item) => (
                                    <li key={item} className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-4 text-emerald-400" /> {item}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Tilted photo stack, like the catalog posts */}
                        <div className="relative mx-auto h-[360px] w-full max-w-md sm:h-[440px]">
                            <img
                                src="/images/portfolio/smap-kajang.jpg"
                                alt="Baju sukan Sekolah SMAP Kajang X Hendrixx"
                                className="absolute top-0 left-0 w-[62%] -rotate-6 rounded-lg border-4 border-white shadow-2xl"
                            />
                            <img
                                src="/images/portfolio/mrsm-mjsc.jpg"
                                alt="Jersey MRSM oleh Hendrixx"
                                className="absolute top-6 right-0 w-[58%] rotate-6 rounded-lg border-4 border-white shadow-2xl"
                            />
                            <img
                                src="/images/portfolio/uitm-di-hatiku.jpg"
                                alt="Jersey UiTM Di Hatiku oleh Hendrixx"
                                className="absolute bottom-0 left-1/2 w-[62%] -translate-x-1/2 -rotate-1 rounded-lg border-4 border-white shadow-2xl"
                            />
                            <div className="absolute -bottom-4 -left-2 rotate-[-8deg] rounded-md bg-[#E11D2E] px-4 py-2 font-display text-lg font-black uppercase italic shadow-xl sm:-left-6">
                                Quality material ✓
                            </div>
                            <div className="absolute top-1/2 -right-2 rotate-[8deg] rounded-md bg-[#FCF9EA] px-4 py-2 font-display text-lg font-black text-[#030164] uppercase italic shadow-xl sm:-right-6">
                                Affordable ✓
                            </div>
                        </div>
                    </div>
                </section>

                {/* Client marquee */}
                <section className="overflow-hidden border-y border-[#030164]/10 bg-white py-4">
                    <div className="flex w-max animate-marquee gap-10 pr-10 motion-reduce:animate-none">
                        {[...clients, ...clients].map((client, i) => (
                            <span
                                key={i}
                                className="flex items-center gap-10 font-display text-xl font-extrabold whitespace-nowrap text-[#030164]/70 uppercase italic"
                            >
                                {client} <HendrixxMark className="h-4 w-auto text-[#E11D2E]" />
                            </span>
                        ))}
                    </div>
                </section>

                {/* Core promises */}
                <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
                    <SectionTitle eyebrow="Kenapa Hendrixx" title="3 janji kami kepada team anda" />
                    <div className="mt-12 grid gap-6 md:grid-cols-3">
                        {promises.map(({ icon: Icon, big, title, text }, index) => (
                            <div
                                key={title}
                                className={
                                    'group relative overflow-hidden rounded-2xl p-7 shadow-sm ring-1 transition hover:-translate-y-1 hover:shadow-xl ' +
                                    (index === 0 ? 'bg-[#030164] text-white ring-[#030164]' : 'bg-white ring-[#030164]/10')
                                }
                            >
                                <span
                                    className={
                                        'absolute -top-3 -right-2 font-display text-7xl font-black italic opacity-10 ' +
                                        (index === 0 ? 'text-white' : 'text-[#030164]')
                                    }
                                >
                                    {big}
                                </span>
                                <span
                                    className={
                                        'flex size-12 items-center justify-center rounded-xl ' +
                                        (index === 0 ? 'bg-[#E11D2E] text-white' : 'bg-[#030164]/10 text-[#030164]')
                                    }
                                >
                                    <Icon className="size-6" />
                                </span>
                                <h3 className="mt-5 font-display text-2xl font-extrabold uppercase italic">{title}</h3>
                                <p className={'mt-2 ' + (index === 0 ? 'text-white/75' : 'text-slate-600')}>{text}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Design catalog */}
                <section id="produk" className="mx-auto max-w-6xl scroll-mt-8 px-4 pb-16 sm:pb-24">
                    <DesignCarousel onPickDesign={(label) => form.setData('message', `Saya berminat dengan design ${label}. `)} />
                </section>

                {/* Offer stack */}
                <section id="tawaran" className="relative isolate scroll-mt-8 overflow-hidden bg-[#030164] text-white">
                    <Watermark />
                    <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
                        <SectionTitle eyebrow="Tawaran setiap order" title="Semua ini anda dapat — tanpa caj tersembunyi" light />
                        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {offers.map(({ icon: Icon, title, text }) => (
                                <div key={title} className="rounded-xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur transition hover:bg-white/10">
                                    <Icon className="size-7 text-[#FF4757]" />
                                    <h3 className="mt-3 font-semibold">{title}</h3>
                                    <p className="mt-1 text-sm text-white/65">{text}</p>
                                </div>
                            ))}
                        </div>
                        <div className="mt-12 flex flex-col items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-[#E11D2E] to-[#ff5a3c] p-8 text-center shadow-2xl md:flex-row md:text-left">
                            <div>
                                <p className="font-display text-3xl font-black uppercase italic sm:text-4xl">Ada event tak lama lagi?</p>
                                <p className="mt-1 text-white/90">
                                    Slot produksi terhad setiap minggu. Tempah awal supaya jersey sampai sebelum tarikh event anda.
                                </p>
                            </div>
                            <a
                                href="#quote"
                                className="shrink-0 rounded-md bg-white px-7 py-3.5 font-bold tracking-wide text-[#E11D2E] uppercase shadow-lg transition hover:-translate-y-0.5"
                            >
                                Tempah slot saya
                            </a>
                        </div>
                    </div>
                </section>

                {/* Portfolio */}
                <section id="portfolio" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-16 sm:py-24">
                    <SectionTitle eyebrow="Thank you for choosing us" title="Jersey yang kami dah siapkan" />
                    <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
                        {portfolio.map(({ src, title, tag }, index) => (
                            <figure key={index} className="group relative aspect-square overflow-hidden rounded-xl shadow-md ring-1 ring-[#030164]/10">
                                <img
                                    src={src}
                                    alt={title}
                                    loading="lazy"
                                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                />
                                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#030164]/95 to-transparent p-4 pt-12 text-white opacity-0 transition group-hover:opacity-100">
                                    <span className="text-[10px] font-semibold tracking-widest text-[#FF4757] uppercase">{tag}</span>
                                    <span className="block font-display text-lg font-extrabold uppercase italic">{title}</span>
                                </figcaption>
                            </figure>
                        ))}
                    </div>
                    <div className="mt-6 text-center">
                        <a
                            href={instagram}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 font-semibold text-[#030164] hover:underline"
                        >
                            <Instagram className="size-5" /> Lagi hasil kerja di @hendrixx.exclusive
                        </a>
                    </div>
                </section>

                {/* Testimonials */}
                <section className="border-y border-[#030164]/10 bg-white/70">
                    <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
                        <SectionTitle eyebrow="Feedback customer" title="Apa kata mereka" />
                        <div className="mt-12 grid gap-6 md:grid-cols-3">
                            {testimonials.map(({ quote, name, org }) => (
                                <figure key={quote} className="relative rounded-2xl bg-white p-7 shadow-sm ring-1 ring-[#030164]/10">
                                    <Quote className="absolute top-5 right-5 size-10 text-[#030164]/10" />
                                    <div className="flex gap-0.5 text-amber-400">
                                        {[...Array(5)].map((_, i) => (
                                            <Star key={i} className="size-4 fill-current" />
                                        ))}
                                    </div>
                                    <blockquote className="mt-4 text-slate-700">“{quote}”</blockquote>
                                    <figcaption className="mt-5 flex items-center gap-3">
                                        <span className="flex size-10 items-center justify-center rounded-full bg-[#030164] font-display font-black text-white italic">
                                            {org.charAt(0)}
                                        </span>
                                        <span>
                                            <span className="block font-semibold">{name}</span>
                                            <span className="block text-sm text-slate-500">{org}</span>
                                        </span>
                                    </figcaption>
                                </figure>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Step to order (snake layout like the booking poster: 1→2→3, then 4←5←6 underneath) */}
                <section id="cara-order" className="relative isolate scroll-mt-8 overflow-hidden bg-[#030164] text-white">
                    {/* Customer photos crossfading behind a navy overlay */}
                    <div aria-hidden className="absolute inset-0 -z-10">
                        {['/images/portfolio/um-team.jpg', '/images/portfolio/hendrixx-team.jpg'].map((src, i) => (
                            <img
                                key={src}
                                src={src}
                                alt=""
                                loading="lazy"
                                className="absolute inset-0 h-full w-full animate-crossfade object-cover motion-reduce:animate-none"
                                style={{ animationDelay: `${i * -7}s`, opacity: i === 0 ? 1 : 0 }}
                            />
                        ))}
                        <div className="absolute inset-0 bg-gradient-to-br from-[#030164]/90 via-[#030164]/75 to-[#4a1a8c]/85" />
                        <div
                            className="absolute inset-0"
                            style={{ backgroundImage: 'radial-gradient(rgb(255 255 255 / 0.08) 1.2px, transparent 1.6px)', backgroundSize: '14px 14px' }}
                        />
                    </div>
                    <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
                        <div className="flex flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
                            <div className="flex items-center gap-4">
                                <HendrixxMark className="h-14 text-white" />
                                <div>
                                    <p className="font-display text-4xl leading-none font-black uppercase italic sm:text-5xl">
                                        Book your <span className="text-[#FFD60A]">order now!</span>
                                    </p>
                                    <p className="mt-1 text-sm text-white/70">6 langkah mudah dari idea sampai jersey di tangan anda.</p>
                                </div>
                            </div>
                            <span className="-rotate-3 rounded-md bg-[#E11D2E] px-4 py-2 font-display text-2xl font-black uppercase italic shadow-[4px_4px_0_#FFD60A]">
                                Step to order
                            </span>
                        </div>

                        <ol className="mt-14 grid gap-10 md:grid-cols-2 lg:grid-cols-3 lg:gap-x-14 lg:gap-y-16">
                            {steps.map(({ icon: Icon, title, text }, index) => (
                                <li key={title} className={'relative ' + stepOrder[index]}>
                                    <div className="relative h-full rounded-2xl border-4 border-[#030164] bg-[#FFD60A] p-6 pt-9 text-[#030164] shadow-[8px_8px_0_#E11D2E] transition hover:-translate-y-1 hover:shadow-[10px_12px_0_#E11D2E]">
                                        <span className="absolute -top-6 left-5 flex size-12 items-center justify-center rounded-full border-4 border-[#FFD60A] bg-[#030164] font-display text-2xl font-black text-white italic">
                                            {index + 1}
                                        </span>
                                        <span className="absolute -top-4 right-5 rounded-md bg-[#030164] px-3 py-1.5 font-display text-sm font-extrabold tracking-wide text-white uppercase italic">
                                            {title}
                                        </span>
                                        <Icon className="size-8" />
                                        <p className="mt-3 font-medium">{text}</p>
                                    </div>
                                    <StepArrow index={index} />
                                </li>
                            ))}
                        </ol>

                        <div className="mt-16 flex flex-col items-center gap-5 text-center">
                            <p className="font-display text-2xl font-black tracking-wide uppercase italic sm:text-3xl">
                                Great designs don't need complicated steps
                            </p>
                            <a
                                href="#quote"
                                className="inline-flex items-center gap-2 rounded-md bg-[#FFD60A] px-7 py-3.5 font-bold tracking-wide text-[#030164] uppercase shadow-[5px_5px_0_#E11D2E] transition hover:-translate-y-0.5"
                            >
                                Mula langkah 1 sekarang <ArrowRight className="size-5" />
                            </a>
                        </div>
                    </div>
                </section>

                {/* Fabrics + About */}
                <section id="about" className="scroll-mt-8 bg-[#030164] text-white">
                    <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:py-24 lg:grid-cols-2">
                        <div className="relative">
                            <img src="/images/portfolio/upm-x-uitm.jpg" alt="Jersey UPM dan UiTM oleh Hendrixx" className="w-4/5 rounded-xl shadow-2xl" />
                            <img
                                src="/images/portfolio/kitagrow.jpg"
                                alt="Jersey KitaGrow oleh Hendrixx"
                                className="absolute -bottom-8 right-0 w-1/2 rotate-3 rounded-xl border-4 border-[#030164] shadow-2xl"
                            />
                        </div>
                        <div>
                            <p className="text-sm font-semibold tracking-widest text-[#FF4757] uppercase">About us</p>
                            <h2 className="mt-2 flex items-center gap-3 font-display text-4xl font-black uppercase italic sm:text-5xl">
                                <HendrixxMark className="h-9 w-auto" /> Hendrixx Exclusive
                            </h2>
                            <p className="mt-5 text-white/80">
                                Hendrixx Exclusive (@hendrixx.exclusive) ialah jenama jersey full sublimation custom dari Malaysia. Kami bantu
                                sekolah, universiti, kelab sukan, team esports dan organisasi menghasilkan jersey yang mewakili identiti mereka —
                                dari MRSM dan SMAP Kajang, ke UiTM, UPM dan program seperti KitaGrow.
                            </p>
                            <p className="mt-4 text-white/80">
                                Prinsip kami mudah: <strong className="text-white">quality material</strong>, harga{' '}
                                <strong className="text-white">affordable</strong>, dan siap{' '}
                                <strong className="text-white">dalam {productionDays} hari bekerja</strong>.
                            </p>
                            {fabrics.length > 0 && (
                                <>
                                    <h3 className="mt-8 font-semibold">Pilihan kain kami</h3>
                                    <ul className="mt-3 flex flex-wrap gap-2">
                                        {fabrics.map((fabric) => (
                                            <li key={fabric} className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm ring-1 ring-white/15">
                                                <CheckCircle2 className="size-4 text-emerald-400" /> {fabric}
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>
                    </div>
                </section>

                {/* FAQ */}
                <section className="mx-auto max-w-3xl px-4 py-16 sm:py-24">
                    <SectionTitle eyebrow="Soalan lazim" title="Ada soalan?" />
                    <div className="mt-10 grid gap-3">
                        {faqs.map(({ q, a }) => (
                            <details key={q} className="group rounded-xl bg-white p-5 shadow-sm ring-1 ring-[#030164]/10">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                                    {q}
                                    <ChevronDown className="size-5 shrink-0 text-[#030164] transition group-open:rotate-180" />
                                </summary>
                                <p className="mt-3 text-slate-600">{a}</p>
                            </details>
                        ))}
                    </div>
                </section>

                {/* Quote form */}
                <section id="quote" className="scroll-mt-8 px-4 pb-20">
                    <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-[#030164]/10">
                        <div className="relative isolate overflow-hidden bg-[#030164] px-6 py-10 text-center text-white sm:px-10">
                            <Watermark />
                            <p className="font-display text-4xl font-black uppercase italic sm:text-5xl">
                                Jom mula jersey team anda
                            </p>
                            <p className="mx-auto mt-3 max-w-xl text-white/80">
                                Isi borang ringkas ini — team sales kami akan WhatsApp anda dengan harga & cadangan. Tiada
                                komitmen.
                            </p>
                        </div>

                        <div className="p-6 sm:p-10">
                            {flash.success ? (
                                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
                                    <CheckCircle2 className="mt-0.5 size-6 shrink-0" />
                                    <div>
                                        <p className="font-semibold">{flash.success}</p>
                                        <p className="text-sm">Nak cepat? Terus WhatsApp kami.</p>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
                                    <PublicField label="Nama *" error={form.errors.name}>
                                        <input
                                            className={inputClass}
                                            value={form.data.name}
                                            onChange={(e) => form.setData('name', e.target.value)}
                                            required
                                        />
                                    </PublicField>
                                    <PublicField label="No. WhatsApp *" error={form.errors.phone}>
                                        <input
                                            className={inputClass}
                                            value={form.data.phone}
                                            onChange={(e) => form.setData('phone', e.target.value)}
                                            placeholder="012-3456789"
                                            required
                                        />
                                    </PublicField>
                                    <PublicField label="Team / organisasi" error={form.errors.organization}>
                                        <input
                                            className={inputClass}
                                            value={form.data.organization}
                                            onChange={(e) => form.setData('organization', e.target.value)}
                                        />
                                    </PublicField>
                                    <PublicField label="Email" error={form.errors.email}>
                                        <input
                                            type="email"
                                            className={inputClass}
                                            value={form.data.email}
                                            onChange={(e) => form.setData('email', e.target.value)}
                                        />
                                    </PublicField>
                                    <PublicField label="Produk" error={form.errors.product}>
                                        <select
                                            className={inputClass}
                                            value={form.data.product}
                                            onChange={(e) => form.setData('product', e.target.value)}
                                        >
                                            {products.map((product) => (
                                                <option key={product}>{product}</option>
                                            ))}
                                        </select>
                                    </PublicField>
                                    <div className="grid grid-cols-2 gap-4">
                                        <PublicField label="Anggaran helai" error={form.errors.quantity}>
                                            <input
                                                type="number"
                                                min={1}
                                                className={inputClass}
                                                value={form.data.quantity}
                                                onChange={(e) => form.setData('quantity', e.target.value)}
                                            />
                                        </PublicField>
                                        <PublicField label="Tarikh perlu" error={form.errors.required_by}>
                                            <input
                                                type="date"
                                                className={inputClass}
                                                value={form.data.required_by}
                                                onChange={(e) => form.setData('required_by', e.target.value)}
                                            />
                                        </PublicField>
                                    </div>
                                    <PublicField label="Idea design / nota" error={form.errors.message} className="sm:col-span-2">
                                        <textarea
                                            rows={4}
                                            className={inputClass}
                                            value={form.data.message}
                                            onChange={(e) => form.setData('message', e.target.value)}
                                        />
                                    </PublicField>
                                    <button
                                        disabled={form.processing}
                                        className="rounded-md bg-[#E11D2E] px-6 py-4 font-bold tracking-wide text-white uppercase shadow-lg transition hover:bg-[#c81726] disabled:opacity-60 sm:col-span-2"
                                    >
                                        Hantar & dapatkan quote
                                    </button>
                                    <p className="text-center text-xs text-slate-500 sm:col-span-2">
                                        Atau terus{' '}
                                        <a href={whatsapp} target="_blank" rel="noreferrer" className="font-semibold text-[#030164] underline">
                                            WhatsApp kami
                                        </a>{' '}
                                        untuk respon lebih pantas.
                                    </p>
                                </form>
                            )}
                        </div>
                    </div>
                </section>

                <footer className="bg-[#030164] text-white/70">
                    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 py-10 text-sm">
                        <div className="flex items-center gap-3">
                            <HendrixxMark className="h-8 w-auto text-white" />
                            <div>
                                <div className="font-semibold text-white">{company.name}</div>
                                <div>{company.address}</div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1 sm:items-end">
                            <a href={instagram} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white">
                                <Instagram className="size-4" /> @hendrixx.exclusive
                            </a>
                            <div>{company.phone}</div>
                            <div>{company.email}</div>
                        </div>
                    </div>
                </footer>

                <a
                    href={whatsapp}
                    target="_blank"
                    rel="noreferrer"
                    className="fixed right-5 bottom-5 z-30 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl ring-4 ring-[#25D366]/30 transition hover:scale-105"
                    aria-label="WhatsApp"
                >
                    <MessageCircle className="size-7" />
                </a>
            </div>
        </>
    );
}

// lg grid positions for the snake layout: second row runs right-to-left
const stepOrder = ['lg:order-1', 'lg:order-2', 'lg:order-3', 'lg:order-6', 'lg:order-5', 'lg:order-4'];

function StepArrow({ index }: { index: number }) {
    const chip = 'absolute z-10 flex size-9 items-center justify-center rounded-full bg-[#E11D2E] text-white shadow-lg';

    return (
        <>
            {/* Mobile / tablet: always points down to the next card */}
            {index < 5 && (
                <span className={chip + ' -bottom-9 left-1/2 -translate-x-1/2 lg:hidden'}>
                    <ChevronDown className="size-5" />
                </span>
            )}
            {/* Desktop snake */}
            {index < 2 && (
                <span className={chip + ' top-1/2 -right-12 hidden -translate-y-1/2 lg:flex'}>
                    <ChevronRight className="size-5" />
                </span>
            )}
            {index === 2 && (
                <span className={chip + ' -bottom-13 left-1/2 hidden -translate-x-1/2 lg:flex'}>
                    <ChevronDown className="size-5" />
                </span>
            )}
            {(index === 3 || index === 4) && (
                <span className={chip + ' top-1/2 -left-12 hidden -translate-y-1/2 lg:flex'}>
                    <ChevronLeft className="size-5" />
                </span>
            )}
        </>
    );
}

function DesignCarousel({ onPickDesign }: { onPickDesign: (label: string) => void }) {
    const track = useRef<HTMLDivElement>(null);
    const paused = useRef(false);
    const [category, setCategory] = useState<DesignCategory | null>(null);
    const [open, setOpen] = useState<number | null>(null);

    const shown = category ? designs.filter((design) => design.category === category) : designs;
    const active = open === null ? null : shown[open];
    const label = (design: (typeof designs)[number]) => (design.code.startsWith('#') ? `${design.code} (${design.title})` : design.title);

    const scroll = (direction: number) => {
        const el = track.current;
        if (!el) return;
        const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
        if (direction > 0 && atEnd) el.scrollTo({ left: 0, behavior: 'smooth' });
        else el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
    };

    // Gentle auto-play; pauses on hover/touch, while the lightbox is open, and for reduced motion.
    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const timer = window.setInterval(() => {
            if (!paused.current && open === null) scroll(1);
        }, 3500);
        return () => window.clearInterval(timer);
    }, [open]);

    useEffect(() => {
        track.current?.scrollTo({ left: 0 });
    }, [category]);

    useEffect(() => {
        if (open === null) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(null);
            if (event.key === 'ArrowRight') setOpen((i) => (i === null ? i : (i + 1) % shown.length));
            if (event.key === 'ArrowLeft') setOpen((i) => (i === null ? i : (i - 1 + shown.length) % shown.length));
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, shown.length]);

    const pickDesign = (design: (typeof designs)[number]) => {
        onPickDesign(label(design));
        setOpen(null);
        document.getElementById('quote')?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="text-center sm:text-left">
                    <p className="text-sm font-semibold tracking-widest text-[#E11D2E] uppercase">Katalog design Hendrixx</p>
                    <h2 className="mt-2 font-display text-4xl leading-none font-black text-[#030164] uppercase italic sm:text-5xl">
                        Contoh design kami
                    </h2>
                    <p className="mt-2 text-slate-600">Pilih design yang anda suka — kami custom ikut logo, warna & nama team anda.</p>
                </div>
                <div className="flex gap-2">
                    {[
                        { icon: ChevronLeft, dir: -1, text: 'Sebelum' },
                        { icon: ChevronRight, dir: 1, text: 'Seterusnya' },
                    ].map(({ icon: Icon, dir, text }) => (
                        <button
                            key={text}
                            type="button"
                            onClick={() => scroll(dir)}
                            aria-label={text}
                            className="flex size-11 items-center justify-center rounded-full bg-[#030164] text-white shadow-md transition hover:bg-[#E11D2E]"
                        >
                            <Icon className="size-5" />
                        </button>
                    ))}
                </div>
            </div>

            <div className="-mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {[null, ...designCategories].map((item) => (
                    <button
                        key={item ?? 'all'}
                        type="button"
                        onClick={() => setCategory(item)}
                        className={
                            'shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ' +
                            (category === item ? 'bg-[#E11D2E] text-white shadow-md' : 'bg-white text-[#030164] ring-1 ring-[#030164]/15 hover:ring-[#030164]/40')
                        }
                    >
                        {item ?? `Semua (${designs.length})`}
                    </button>
                ))}
            </div>

            <div
                ref={track}
                onMouseEnter={() => (paused.current = true)}
                onMouseLeave={() => (paused.current = false)}
                onTouchStart={() => (paused.current = true)}
                className="-mx-4 mt-6 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
                {shown.map((design, index) => (
                    <button
                        key={design.file}
                        type="button"
                        onClick={() => setOpen(index)}
                        className="group relative aspect-square w-[78%] shrink-0 snap-start overflow-hidden rounded-2xl bg-[#030164] text-left shadow-lg ring-1 ring-[#030164]/10 sm:w-[320px]"
                    >
                        <img
                            src={`/images/designs/${design.file}.jpg`}
                            alt={`Design ${design.title} oleh Hendrixx`}
                            loading="lazy"
                            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                        <span className="absolute top-3 left-3 rounded-md bg-[#030164]/90 px-2.5 py-1 font-display text-sm font-extrabold text-white italic backdrop-blur">
                            {design.code}
                        </span>
                        <div className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-[#030164] via-[#030164]/80 to-transparent p-4 pt-14 text-white opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
                            <span className="text-[10px] font-semibold tracking-widest text-[#FFD60A] uppercase">{design.category}</span>
                            <span className="block font-display text-xl font-black uppercase italic">{design.title}</span>
                            <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold">
                                Lihat besar <ArrowRight className="size-4" />
                            </span>
                        </div>
                    </button>
                ))}
            </div>
            <p className="text-center text-xs text-slate-500">
                Gambar untuk ilustrasi sahaja — produk sebenar mungkin sedikit berbeza. Logo & nama ditukar ikut team anda.
            </p>

            {active && open !== null && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={active.title}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-[#030164]/90 p-4 backdrop-blur-sm"
                    onClick={() => setOpen(null)}
                >
                    <div className="relative w-full max-w-2xl" onClick={(event) => event.stopPropagation()}>
                        <button
                            type="button"
                            onClick={() => setOpen(null)}
                            aria-label="Tutup"
                            className="absolute -top-12 right-0 flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                        >
                            <X className="size-5" />
                        </button>
                        <img src={`/images/designs/${active.file}.jpg`} alt={`Design ${active.title}`} className="w-full rounded-2xl shadow-2xl" />
                        {[
                            { icon: ChevronLeft, dir: -1, cls: 'left-2 sm:-left-14', text: 'Sebelum' },
                            { icon: ChevronRight, dir: 1, cls: 'right-2 sm:-right-14', text: 'Seterusnya' },
                        ].map(({ icon: Icon, dir, cls, text }) => (
                            <button
                                key={text}
                                type="button"
                                aria-label={text}
                                onClick={() => setOpen((open + dir + shown.length) % shown.length)}
                                className={'absolute top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#030164] shadow-lg hover:bg-white ' + cls}
                            >
                                <Icon className="size-5" />
                            </button>
                        ))}
                        <div className="mt-4 flex flex-col items-center justify-between gap-3 text-white sm:flex-row">
                            <div>
                                <span className="text-xs font-semibold tracking-widest text-[#FFD60A] uppercase">
                                    {active.code} · {active.category}
                                </span>
                                <p className="font-display text-2xl font-black uppercase italic">{active.title}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => pickDesign(active)}
                                className="inline-flex items-center gap-2 rounded-md bg-[#E11D2E] px-5 py-3 font-bold tracking-wide uppercase shadow-lg hover:bg-[#c81726]"
                            >
                                Nak design macam ni <ArrowRight className="size-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// Faint slanted "HENDRIXX" lettering behind dark sections, as on the catalog posts
function Watermark() {
    return (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-[5] -rotate-12 overflow-hidden opacity-[0.05] select-none">
            {[...Array(8)].map((_, row) => (
                <div
                    key={row}
                    className="font-display text-7xl leading-tight font-black whitespace-nowrap text-white italic"
                    style={{ marginLeft: `${(row % 2) * -120 - 200}px` }}
                >
                    {'HENDRIXX '.repeat(14)}
                </div>
            ))}
        </div>
    );
}

function SectionTitle({ eyebrow, title, light = false }: { eyebrow: string; title: string; light?: boolean }) {
    return (
        <div className="text-center">
            <p className="text-sm font-semibold tracking-widest text-[#E11D2E] uppercase">{eyebrow}</p>
            <h2
                className={
                    'mx-auto mt-2 max-w-3xl font-display text-4xl leading-none font-black uppercase italic sm:text-5xl ' +
                    (light ? 'text-white' : 'text-[#030164]')
                }
            >
                {title}
            </h2>
        </div>
    );
}

const inputClass =
    'w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#030164] focus:ring-2 focus:ring-[#030164]/20';

function PublicField({ label, error, className, children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
    return (
        <label className={'grid gap-1.5 ' + (className ?? '')}>
            <span className="text-sm font-medium">{label}</span>
            {children}
            <InputError message={error} />
        </label>
    );
}
