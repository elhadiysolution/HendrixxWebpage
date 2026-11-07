import { confirmDialog } from '@/components/confirm-dialog';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { rm } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { AlertTriangle, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';

type FieldType = 'text' | 'textarea' | 'int' | 'number' | 'money' | 'select' | 'combo' | 'bool';

interface Field {
    key: string;
    label: string;
    type: FieldType;
    required?: boolean;
    options?: { value: string; label: string }[];
    placeholder?: string;
    hint?: string;
    table?: boolean;
}

type Row = Record<string, string | number | boolean | null> & { id: number; _warning: string | null };

interface Props {
    resource: string;
    definition: { title: string; description: string; fields: Field[]; extra_columns: { key: string; label: string }[] };
    rows: Row[];
    resources: Record<string, string>;
}

export default function Catalog({ resource, definition, rows, resources }: Props) {
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<Row | 'new' | null>(null);
    const tableFields = definition.fields.filter((field) => field.table !== false);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return rows;
        return rows.filter((row) =>
            Object.values(row).some((value) =>
                String(value ?? '')
                    .toLowerCase()
                    .includes(term),
            ),
        );
    }, [rows, search]);

    return (
        <AppLayout breadcrumbs={[{ title: definition.title, href: `/admin/catalog/${resource}` }]}>
            <Head title={definition.title} />
            <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
                <div className="flex flex-wrap gap-1">
                    {Object.entries(resources).map(([key, title]) => (
                        <Link
                            key={key}
                            href={`/admin/catalog/${key}`}
                            className={cn(
                                'rounded-md px-3 py-1.5 text-sm',
                                key === resource ? 'bg-primary text-primary-foreground' : 'hover:bg-accent bg-white/70',
                            )}
                        >
                            {title}
                        </Link>
                    ))}
                </div>

                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-primary text-xl font-semibold">{definition.title}</h1>
                        <p className="text-muted-foreground text-sm">{definition.description}</p>
                    </div>
                    <div className="flex gap-2">
                        <div className="relative">
                            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari..." className="w-56 pl-9" />
                        </div>
                        <Button onClick={() => setEditing('new')}>
                            <Plus /> Tambah
                        </Button>
                    </div>
                </div>

                <div className="bg-card overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-muted-foreground border-b text-left text-xs">
                                {tableFields.map((field) => (
                                    <th key={field.key} className={cn('px-3 py-3 font-medium whitespace-nowrap', isNumeric(field) && 'text-right')}>
                                        {field.label}
                                    </th>
                                ))}
                                {definition.extra_columns.map((column) => (
                                    <th key={column.key} className="px-3 py-3 text-right font-medium whitespace-nowrap">
                                        {column.label}
                                    </th>
                                ))}
                                <th className="w-24" />
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={tableFields.length + definition.extra_columns.length + 1}
                                        className="text-muted-foreground px-3 py-10 text-center"
                                    >
                                        Tiada rekod.
                                    </td>
                                </tr>
                            )}
                            {filtered.map((row) => (
                                <tr key={row.id} className={cn('hover:bg-accent/50 border-b last:border-0', row.active === false && 'opacity-55')}>
                                    {tableFields.map((field) => (
                                        <td key={field.key} className={cn('px-3 py-2.5', isNumeric(field) && 'text-right tabular-nums')}>
                                            <CellValue field={field} value={row[field.key]} />
                                            {field.key === tableFields[0].key && row._warning && (
                                                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                                    <AlertTriangle className="size-3" /> {row._warning}
                                                </span>
                                            )}
                                        </td>
                                    ))}
                                    {definition.extra_columns.map((column) => (
                                        <td key={column.key} className="px-3 py-2.5 text-right tabular-nums">
                                            {String(row[column.key] ?? '-')}
                                        </td>
                                    ))}
                                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                        <Button size="icon" variant="ghost" onClick={() => setEditing(row)} aria-label="Edit">
                                            <Pencil />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            aria-label="Padam"
                                            onClick={async () => {
                                                const ok = await confirmDialog({
                                                    title: 'Padam rekod ini?',
                                                    confirmLabel: 'Padam',
                                                    destructive: true,
                                                });
                                                if (ok !== false) router.delete(`/admin/catalog/${resource}/${row.id}`, { preserveScroll: true });
                                            }}
                                        >
                                            <Trash2 className="text-red-600" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="text-muted-foreground text-xs">
                    {rows.length} rekod · setiap perubahan disalin automatik ke Google Sheet (jika disambung).
                </p>
            </div>

            {editing && (
                <EditDialog
                    key={editing === 'new' ? 'new' : editing.id}
                    resource={resource}
                    title={definition.title}
                    fields={definition.fields}
                    row={editing === 'new' ? null : editing}
                    onClose={() => setEditing(null)}
                />
            )}
        </AppLayout>
    );
}

function isNumeric(field: Field) {
    return ['int', 'number', 'money'].includes(field.type);
}

function CellValue({ field, value }: { field: Field; value: Row[string] }) {
    if (value === null || value === undefined || value === '') return <span className="text-muted-foreground">-</span>;
    if (field.type === 'bool') return <span>{value ? 'Ya' : 'Tidak'}</span>;
    if (field.type === 'money') return <span>{rm(Number(value))}</span>;
    if (field.type === 'select') return <span>{field.options?.find((option) => option.value === value)?.label ?? String(value)}</span>;
    return <span>{String(value)}</span>;
}

function EditDialog({
    resource,
    title,
    fields,
    row,
    onClose,
}: {
    resource: string;
    title: string;
    fields: Field[];
    row: Row | null;
    onClose: () => void;
}) {
    const initial = Object.fromEntries(
        fields.map((field) => {
            const value = row?.[field.key];
            if (field.type === 'bool') return [field.key, row ? Boolean(value) : true];
            if (field.type === 'select' && !row && field.required) return [field.key, field.options?.[0]?.value ?? ''];
            return [field.key, value ?? ''];
        }),
    ) as Record<string, string | number | boolean>;

    const form = useForm(initial);
    const errors = form.errors as Record<string, string>;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: onClose };
        form.transform((data) => Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value === '' ? null : value])));
        if (row) form.put(`/admin/catalog/${resource}/${row.id}`, options);
        else form.post(`/admin/catalog/${resource}`, options);
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{row ? `Edit ${title}` : `Tambah ${title}`}</DialogTitle>
                    <DialogDescription>Ruangan bertanda * wajib diisi.</DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
                    {fields.map((field) => (
                        <div key={field.key} className={cn('grid gap-1.5', field.type === 'textarea' && 'sm:col-span-2')}>
                            {field.type === 'bool' ? (
                                <label className="mt-6 flex items-center gap-2 text-sm font-medium">
                                    <input
                                        type="checkbox"
                                        className="accent-primary size-4"
                                        checked={Boolean(form.data[field.key])}
                                        onChange={(e) => form.setData(field.key, e.target.checked)}
                                    />
                                    {field.label}
                                </label>
                            ) : (
                                <>
                                    <Label>
                                        {field.label}
                                        {field.required && ' *'}
                                    </Label>
                                    <FieldInput field={field} value={form.data[field.key]} onChange={(value) => form.setData(field.key, value)} />
                                    {field.hint && <span className="text-muted-foreground text-xs">{field.hint}</span>}
                                </>
                            )}
                            <InputError message={errors[field.key]} />
                        </div>
                    ))}
                    <DialogFooter className="sm:col-span-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Batal
                        </Button>
                        <Button disabled={form.processing}>Simpan</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function FieldInput({ field, value, onChange }: { field: Field; value: string | number | boolean; onChange: (value: string) => void }) {
    const stringValue = value === null || value === undefined ? '' : String(value);

    switch (field.type) {
        case 'textarea':
            return <Textarea rows={3} value={stringValue} onChange={(e) => onChange(e.target.value)} />;
        case 'select':
            return (
                <NativeSelect value={stringValue} onChange={(e) => onChange(e.target.value)} required={field.required}>
                    {!field.required && <option value="">-</option>}
                    {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </NativeSelect>
            );
        case 'combo':
            return (
                <>
                    <Input list={`options-${field.key}`} value={stringValue} onChange={(e) => onChange(e.target.value)} required={field.required} />
                    <datalist id={`options-${field.key}`}>
                        {field.options?.map((option) => <option key={option.value} value={option.value} />)}
                    </datalist>
                </>
            );
        case 'int':
        case 'number':
        case 'money':
            return (
                <Input
                    type="number"
                    min={0}
                    step={field.type === 'int' ? 1 : 0.01}
                    value={stringValue}
                    onChange={(e) => onChange(e.target.value)}
                    required={field.required}
                />
            );
        default:
            return <Input value={stringValue} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} required={field.required} />;
    }
}
