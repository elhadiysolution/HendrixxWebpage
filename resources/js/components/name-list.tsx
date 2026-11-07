import { confirmDialog } from '@/components/confirm-dialog';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { rm } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ArrowDownWideNarrow, Plus, Trash2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';

export type NameRow = { name: string; number: string; size: string };

const SIZE_ALIASES: Record<string, string> = { XXS: '2XS', XXL: '2XL', XXXL: '3XL', XXXXL: '4XL', XXXXXL: '5XL' };

const normalizeSize = (value: string, sizes: string[]) => {
    const upper = value.toUpperCase().replace(/\s+/g, '');
    const size = SIZE_ALIASES[upper] ?? upper;
    return sizes.includes(size) ? size : null;
};

/**
 * Parse pasted / uploaded rows. Columns may come in any order: a known size is the size,
 * a 1–3 digit value is the number, everything else is the name. Accepts Excel copy-paste
 * (tabs), CSV (comma / semicolon) and "10 - AMIR - L".
 */
export const parseNames = (text: string, sizes: string[]): NameRow[] =>
    text
        .split(/\r?\n/)
        .map((line) => line.trim())
        // Skip blank lines and a header row such as "Nama, Nombor, Saiz".
        .filter((line) => line && !(/\b(nama|name)\b/i.test(line) && /\b(saiz|size)\b/i.test(line)))
        .map((line) => {
            let cells = (line.includes('\t') ? line.split('\t') : /[;,]/.test(line) ? line.split(/[;,]/) : line.split(/\s+-\s+/))
                .map((cell) => cell.trim().replace(/^"|"$/g, ''))
                .filter(Boolean);
            // "AMIR 10 L": no separator, so split on spaces (name words are joined back below).
            if (cells.length === 1) cells = cells[0].split(/\s+/);
            const row: NameRow = { name: '', number: '', size: '' };
            const rest: string[] = [];
            cells.forEach((cell) => {
                const size = normalizeSize(cell, sizes);
                if (size && !row.size) row.size = size;
                else if (/^#?\d{1,3}$/.test(cell) && !row.number) row.number = cell.replace('#', '');
                else rest.push(cell);
            });
            row.name = rest.join(' ').toUpperCase();
            return row;
        })
        .filter((row) => row.name || row.number || row.size);

/** Same order as the server: size (config order, unknown last), then number, then name. */
export const sortNames = (names: NameRow[], sizes: string[]) => {
    const rank = (size: string) => (sizes.includes(size) ? sizes.indexOf(size) : sizes.length);
    return [...names].sort(
        (a, b) =>
            rank(a.size) - rank(b.size) ||
            (a.number === '' ? 1 : 0) - (b.number === '' ? 1 : 0) ||
            Number(a.number || 0) - Number(b.number || 0) ||
            a.name.localeCompare(b.name),
    );
};

/** "+RM 4.00: 3XL, 4XL, 5XL · +RM 6.00: 6XL, 7XL, 8XL" */
export const sizeRatesText = (rates: Record<string, number>) => {
    const groups = new Map<number, string[]>();
    Object.entries(rates).forEach(([size, rate]) => groups.set(rate, [...(groups.get(rate) ?? []), size]));
    return [...groups.entries()]
        .sort(([a], [b]) => a - b)
        .map(([rate, list]) => `+${rm(rate)}: ${list.join(', ')}`)
        .join(' · ');
};

export const countSizes = (names: NameRow[]) =>
    names.reduce<Record<string, number>>((counts, row) => (row.size ? { ...counts, [row.size]: (counts[row.size] ?? 0) + 1 } : counts), {});

export function NameList({
    names,
    sizes,
    errors,
    onChange,
}: {
    names: NameRow[];
    sizes: string[];
    errors?: boolean;
    onChange: (names: NameRow[]) => void;
}) {
    const [importing, setImporting] = useState(names.length === 0);
    const [text, setText] = useState('');
    const parsed = useMemo(() => parseNames(text, sizes), [text, sizes]);
    const unknownSizes = names.filter((row) => !row.size || !sizes.includes(row.size)).length;

    const setRow = (index: number, patch: Partial<NameRow>) => onChange(names.map((row, i) => (i === index ? { ...row, ...patch } : row)));

    const apply = (mode: 'replace' | 'append') => {
        onChange(sortNames(mode === 'replace' ? parsed : [...names, ...parsed], sizes));
        setText('');
        setImporting(false);
    };

    const readFile = async (file: File | undefined) => {
        if (file) setText(await file.text());
    };

    const downloadTemplate = () => {
        const blob = new Blob(['Nama,Nombor,Saiz\nAMIR,10,L\nFARHAN,7,M\n'], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'template-senarai-nama.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
                <Button type="button" variant={importing ? 'secondary' : 'outline'} size="sm" onClick={() => setImporting(!importing)}>
                    <Upload /> Upload / tampal senarai
                </Button>
                {names.length > 0 && (
                    <>
                        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(sortNames(names, sizes))}>
                            <ArrowDownWideNarrow /> Susun ikut saiz
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                                const ok = await confirmDialog({ title: 'Kosongkan senarai nama?', confirmLabel: 'Kosongkan', destructive: true });
                                if (ok !== false) onChange([]);
                            }}
                        >
                            Kosongkan
                        </Button>
                    </>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...names, { name: '', number: '', size: '' }])}>
                    <Plus /> Tambah baris
                </Button>
            </div>

            {importing && (
                <div className="bg-muted/30 space-y-2 rounded-md border p-3">
                    <p className="text-muted-foreground text-xs">
                        Upload fail CSV, atau copy terus dari Excel / Google Sheet dan tampal di bawah. Satu baris satu helai — lajur nama, nombor dan
                        saiz boleh dalam apa-apa susunan.{' '}
                        <button type="button" className="text-primary underline" onClick={downloadTemplate}>
                            Muat turun template
                        </button>
                    </p>
                    <Input type="file" accept=".csv,.txt,.tsv" className="h-9 text-xs" onChange={(e) => readFile(e.target.files?.[0])} />
                    <Textarea
                        rows={5}
                        className="font-mono text-xs"
                        placeholder={'AMIR\t10\tL\nFARHAN, 7, M\n23 - HAZIQ - XL'}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-muted-foreground text-xs">{parsed.length} baris dikesan</span>
                        <div className="flex gap-1.5">
                            {names.length > 0 && (
                                <Button type="button" variant="outline" size="sm" disabled={!parsed.length} onClick={() => apply('append')}>
                                    Tambah ke senarai
                                </Button>
                            )}
                            <Button type="button" size="sm" disabled={!parsed.length} onClick={() => apply('replace')}>
                                {names.length > 0 ? 'Ganti senarai' : 'Import & susun'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {names.length > 0 && (
                <div className="max-h-[28rem] overflow-auto rounded-md border">
                    <table className="w-full text-sm">
                        <thead className="text-muted-foreground sticky top-0 bg-white text-left text-xs">
                            <tr>
                                <th className="w-10 px-2 py-1.5 font-medium">#</th>
                                <th className="py-1.5 font-medium">Nama</th>
                                <th className="w-24 py-1.5 font-medium">Nombor</th>
                                <th className="w-24 py-1.5 font-medium">Saiz</th>
                                <th className="w-10" />
                            </tr>
                        </thead>
                        <tbody>
                            {names.map((row, index) => (
                                <tr key={index} className="border-t">
                                    <td className="text-muted-foreground px-2 py-1 text-xs tabular-nums">{index + 1}</td>
                                    <td className="py-1 pr-1.5">
                                        <Input
                                            className="h-8"
                                            value={row.name}
                                            onChange={(e) => setRow(index, { name: e.target.value.toUpperCase() })}
                                        />
                                    </td>
                                    <td className="py-1 pr-1.5">
                                        <Input className="h-8" value={row.number} onChange={(e) => setRow(index, { number: e.target.value })} />
                                    </td>
                                    <td className="py-1 pr-1.5">
                                        <NativeSelect
                                            className={cn('h-8 px-2 py-0', !sizes.includes(row.size) && 'border-amber-500')}
                                            value={row.size}
                                            onChange={(e) => setRow(index, { size: e.target.value })}
                                        >
                                            <option value="">—</option>
                                            {sizes.map((size) => (
                                                <option key={size} value={size}>
                                                    {size}
                                                </option>
                                            ))}
                                        </NativeSelect>
                                    </td>
                                    <td className="py-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="size-8"
                                            onClick={() => onChange(names.filter((_, i) => i !== index))}
                                            aria-label="Buang baris"
                                        >
                                            <Trash2 />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {unknownSizes > 0 && <p className="text-xs text-amber-600">{unknownSizes} baris belum ada saiz yang sah.</p>}
            {errors && <InputError message="Semak semula senarai nama (nama maks 100 aksara, nombor maks 10)." />}
        </div>
    );
}
