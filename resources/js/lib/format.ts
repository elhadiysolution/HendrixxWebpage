export function rm(value: number | null | undefined, decimals = 2): string {
    return 'RM ' + Number(value ?? 0).toLocaleString('en-MY', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function shortDate(value: string | null | undefined): string {
    if (!value) return '-';
    const date = new Date(value.length === 10 ? value + 'T00:00:00' : value.replace(' ', 'T'));
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function dateTime(value: string | null | undefined): string {
    if (!value) return '-';
    const date = new Date(value.replace(' ', 'T'));
    return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function today(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function fileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
