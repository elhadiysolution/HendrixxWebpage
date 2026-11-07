import { HendrixxLogo } from '@/components/hendrixx-logo';
import { type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';

const sections = [
    { href: '/#produk', label: 'Produk' },
    { href: '/#tawaran', label: 'Tawaran' },
    { href: '/#cara-order', label: 'Cara order' },
    { href: '/#portfolio', label: 'Portfolio' },
    { href: '/#about', label: 'About us' },
];

export function PublicHeader({ dark = false }: { dark?: boolean }) {
    const { auth } = usePage<SharedData>().props;

    return (
        <header
            className={dark ? 'absolute inset-x-0 top-0 z-20 text-white' : 'border-b border-[#030164]/10 bg-white/80 text-[#030164] backdrop-blur'}
        >
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
                <Link href="/" aria-label="Hendrixx Exclusive">
                    <HendrixxLogo light={dark} />
                </Link>
                <nav className="flex items-center gap-1 text-sm sm:gap-2">
                    {sections.map(({ href, label }) => (
                        <a key={href} href={href} className="hidden rounded-md px-3 py-2 hover:opacity-80 xl:block">
                            {label}
                        </a>
                    ))}
                    <Link href="/track" className="rounded-md px-3 py-2 hover:opacity-80">
                        Track order
                    </Link>
                    <Link
                        href={auth.user ? '/dashboard' : '/login'}
                        className={
                            'hidden rounded-md border px-3 py-2 sm:block ' +
                            (dark ? 'border-white/30 hover:bg-white/10' : 'border-[#030164]/25 hover:bg-[#FCF9EA]')
                        }
                    >
                        {auth.user ? 'Dashboard' : 'Staf login'}
                    </Link>
                    <a
                        href="/#quote"
                        className={
                            'rounded-md px-3 py-2 font-semibold ' +
                            (dark ? 'bg-[#E11D2E] text-white hover:bg-[#c81726]' : 'bg-[#030164] text-white hover:bg-[#02014a]')
                        }
                    >
                        Dapatkan quote
                    </a>
                </nav>
            </div>
        </header>
    );
}
