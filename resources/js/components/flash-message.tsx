import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

export function FlashMessage() {
    const { flash, errors } = usePage<SharedData & { errors: Record<string, string> }>().props;
    const [visible, setVisible] = useState(false);
    const errorList = Object.values(errors ?? {});
    const message = flash?.success ?? null;

    useEffect(() => {
        if (!message && errorList.length === 0) return;
        setVisible(true);
        const timer = setTimeout(() => setVisible(false), 5000);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [message, errors]);

    if (!visible) return null;

    const isError = errorList.length > 0;

    return (
        <div className="fixed right-4 bottom-4 z-50 max-w-sm" role="status">
            <div
                className={
                    'flex items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg ' +
                    (isError ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800')
                }
            >
                {isError ? <XCircle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
                <div className="space-y-1">{isError ? errorList.slice(0, 3).map((error) => <p key={error}>{error}</p>) : <p>{message}</p>}</div>
                <button className="ml-2 opacity-60 hover:opacity-100" onClick={() => setVisible(false)} aria-label="Tutup">
                    ×
                </button>
            </div>
        </div>
    );
}
