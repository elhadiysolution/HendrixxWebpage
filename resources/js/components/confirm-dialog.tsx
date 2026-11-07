import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormEvent, useState, useSyncExternalStore } from 'react';

/**
 * In-app replacement for window.confirm / window.prompt, which some browsers (e.g. the
 * VS Code built-in browser) block. Mount <ConfirmHost /> once; call confirmDialog() anywhere.
 */
interface Request {
    title: string;
    message?: string;
    confirmLabel?: string;
    destructive?: boolean;
    /** Show a text field; the promise then resolves with its value. */
    input?: { label: string; placeholder?: string };
    resolve: (value: string | false) => void;
}

let current: Request | null = null;
const listeners = new Set<() => void>();

const setCurrent = (request: Request | null) => {
    current = request;
    listeners.forEach((listener) => listener());
};

/** Resolves to false when cancelled, otherwise to the typed text ('' when there is no input). */
export function confirmDialog(options: Omit<Request, 'resolve'>): Promise<string | false> {
    current?.resolve(false);
    return new Promise((resolve) => setCurrent({ ...options, resolve }));
}

export function ConfirmHost() {
    const request = useSyncExternalStore(
        (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        () => current,
    );
    const [text, setText] = useState('');

    const close = (value: string | false) => {
        request?.resolve(value);
        setText('');
        setCurrent(null);
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        close(text.trim());
    };

    return (
        <Dialog open={request !== null} onOpenChange={(open) => !open && close(false)}>
            <DialogContent>
                <form onSubmit={submit} className="grid gap-4">
                    <DialogHeader>
                        <DialogTitle>{request?.title}</DialogTitle>
                        {request?.message && <DialogDescription>{request.message}</DialogDescription>}
                    </DialogHeader>
                    {request?.input && (
                        <div className="grid gap-1.5">
                            <Label htmlFor="confirm-input">{request.input.label}</Label>
                            <Input
                                id="confirm-input"
                                autoFocus
                                placeholder={request.input.placeholder}
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                            />
                        </div>
                    )}
                    <DialogFooter className="gap-2">
                        <Button type="button" variant="outline" onClick={() => close(false)}>
                            Batal
                        </Button>
                        <Button type="submit" variant={request?.destructive ? 'destructive' : 'default'} autoFocus={!request?.input}>
                            {request?.confirmLabel ?? 'Ya, teruskan'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
