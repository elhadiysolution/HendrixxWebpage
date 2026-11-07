import { HTMLAttributes } from 'react';

// The official HX logo (public/images/logo-hx.png) used as a mask, so it takes the
// current text colour: white on navy sections, navy on cream ones. Size it with h-*.
export function HendrixxMark({ className = '', style, ...props }: HTMLAttributes<HTMLSpanElement>) {
    const mask = 'url(/images/logo-hx.png) center / contain no-repeat';

    return (
        <span
            role="img"
            aria-label="Hendrixx Exclusive"
            className={'inline-block aspect-[170/172] shrink-0 bg-current ' + className}
            style={{ mask, WebkitMask: mask, ...style }}
            {...props}
        />
    );
}

export function HendrixxLogo({ light = false }: { light?: boolean }) {
    return (
        <span className="flex items-center gap-2.5">
            <HendrixxMark className={'h-9 ' + (light ? 'text-white' : 'text-[#030164]')} />
            <span className="leading-none">
                <span className="block font-display text-xl font-extrabold tracking-wide italic">HENDRIXX</span>
                <span className={'block text-[9px] font-semibold tracking-[0.42em] ' + (light ? 'text-white/70' : 'text-slate-500')}>
                    EXCLUSIVE
                </span>
            </span>
        </span>
    );
}
