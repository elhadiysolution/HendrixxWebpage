import { confirmDialog } from '@/components/confirm-dialog';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import AppLayout from '@/layouts/app-layout';
import { rm, shortDate, today } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, FileText, Pencil, Plus, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { FormEvent, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Kewangan', href: '/finance' },
    { title: 'Gaji', href: '/finance/payroll' },
];

interface Member {
    id: number;
    name: string;
    position: string | null;
    user_id: number | null;
    user: string | null;
    bank_account: string | null;
    active: boolean;
    basic_salary: number;
    allowance: number;
    profit_share_percent: number;
    epf_employee_percent: number;
    epf_employer_percent: number;
}

interface PayRow {
    member: { id: number; name: string; position: string | null };
    payslip_id: number | null;
    saved: boolean;
    paid_on: string | null;
    notes: string | null;
    basic: number;
    allowance: number;
    sales_base: number;
    linked: boolean;
    performance: { orders: number; pieces: number; sales: number };
    commission: number;
    profit_pool: number;
    profit_share: number;
    epf_employee: number;
    epf_employer: number;
    other_deduction: number;
    net_pay: number;
    gross: number;
    employer_cost: number;
}

interface Props {
    month: { ref: string; label: string; previous: string; next: string };
    pool: { net_profit: number; salary_paid: number; pool: number };
    rows: PayRow[];
    members: Member[];
    users: { id: number; name: string }[];
    methods: Record<string, string>;
}

export default function Payroll({ month, pool, rows, members, users, methods }: Props) {
    const [editing, setEditing] = useState<Member | 'new' | null>(null);
    const [paying, setPaying] = useState<{ row: PayRow; commission: string; other_deduction: string; notes: string } | null>(null);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Gaji" />
            <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-primary text-xl font-semibold">Gaji Team</h1>
                        <p className="text-muted-foreground text-sm">Kira gaji pokok, komisen, bahagian untung dan KWSP setiap bulan.</p>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" asChild aria-label="Bulan sebelum">
                            <Link href={`/finance/payroll?month=${month.previous}`} preserveScroll>
                                <ChevronLeft />
                            </Link>
                        </Button>
                        <span className="min-w-36 text-center text-sm font-medium">{month.label}</span>
                        <Button variant="outline" size="icon" asChild aria-label="Bulan seterusnya">
                            <Link href={`/finance/payroll?month=${month.next}`} preserveScroll>
                                <ChevronRight />
                            </Link>
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardContent className="flex flex-wrap gap-x-8 gap-y-2 p-5 text-sm">
                        <div>
                            <div className="text-muted-foreground">Untung bersih bulan ini (sebelum gaji)</div>
                            <div className={cn('text-xl font-semibold tabular-nums', pool.pool < 0 && 'text-red-700')}>{rm(pool.pool)}</div>
                        </div>
                        <p className="text-muted-foreground max-w-2xl self-center text-xs">
                            Komisen diisi sendiri ikut prestasi. Bawah setiap nama ada pcs, order dan jualan (tanpa caj pos) bulan ini di mana dia
                            jadi Sales PIC, sebagai rujukan. Untuk ini, akaun login perlu dipautkan dalam tetapan team. Bahagian untung = % × untung
                            bersih sebelum gaji (kosong jika rugi).
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="overflow-x-auto p-0">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-muted-foreground border-b text-left text-xs">
                                    <th className="px-4 py-2.5 font-medium">Nama</th>
                                    <th className="py-2.5 pr-3 text-right font-medium">Pokok + elaun</th>
                                    <th className="w-32 py-2.5 pr-3 font-medium">Komisen</th>
                                    <th className="py-2.5 pr-3 text-right font-medium">Bhg. untung</th>
                                    <th className="py-2.5 pr-3 text-right font-medium">KWSP</th>
                                    <th className="w-28 py-2.5 pr-3 font-medium">Potongan lain</th>
                                    <th className="py-2.5 pr-3 text-right font-medium">Gaji bersih</th>
                                    <th className="px-4 py-2.5 text-right font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="text-muted-foreground py-10 text-center">
                                            Tiada ahli team aktif. Tambah di bawah.
                                        </td>
                                    </tr>
                                )}
                                {rows.map((row) => (
                                    <PayslipRow
                                        key={row.member.id}
                                        row={row}
                                        month={month.ref}
                                        member={members.find((m) => m.id === row.member.id)}
                                        onPay={(values) => setPaying({ row, ...values })}
                                    />
                                ))}
                            </tbody>
                            {rows.length > 0 && (
                                <tfoot className="tabular-nums">
                                    <tr className="border-t-2 font-semibold">
                                        <td className="px-4 py-2.5" colSpan={6}>
                                            Jumlah gaji bersih
                                            <span className="text-muted-foreground ml-2 text-xs font-normal">
                                                Kos syarikat (termasuk KWSP majikan): {rm(rows.reduce((sum, row) => sum + row.employer_cost, 0))}
                                            </span>
                                        </td>
                                        <td className="py-2.5 pr-3 text-right">{rm(rows.reduce((sum, row) => sum + row.net_pay, 0))}</td>
                                        <td />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
                        <div>
                            <CardTitle className="text-base">Tetapan gaji team</CardTitle>
                            <CardDescription>Kadar ini dipakai untuk slip gaji yang belum disimpan atau dibayar.</CardDescription>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setEditing('new')}>
                            <Plus /> Tambah ahli
                        </Button>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-muted-foreground border-b text-left text-xs">
                                    <th className="py-2 pr-3 font-medium">Nama</th>
                                    <th className="py-2 pr-3 font-medium">Akaun login</th>
                                    <th className="py-2 pr-3 text-right font-medium">Gaji pokok</th>
                                    <th className="py-2 pr-3 text-right font-medium">Elaun</th>
                                    <th className="py-2 pr-3 text-right font-medium">Bhg. untung</th>
                                    <th className="py-2 pr-3 text-right font-medium">KWSP (pekerja / majikan)</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody className="tabular-nums">
                                {members.map((member) => (
                                    <tr key={member.id} className={cn('border-b last:border-0', !member.active && 'text-muted-foreground')}>
                                        <td className="py-2 pr-3">
                                            <div className="font-medium">{member.name}</div>
                                            <div className="text-muted-foreground text-xs">
                                                {member.position ?? '-'}
                                                {!member.active && ' · tidak aktif'}
                                            </div>
                                        </td>
                                        <td className="py-2 pr-3">{member.user ?? <span className="text-muted-foreground">-</span>}</td>
                                        <td className="py-2 pr-3 text-right">{rm(member.basic_salary)}</td>
                                        <td className="py-2 pr-3 text-right">{rm(member.allowance)}</td>
                                        <td className="py-2 pr-3 text-right">{member.profit_share_percent}%</td>
                                        <td className="py-2 pr-3 text-right">
                                            {member.epf_employee_percent}% / {member.epf_employer_percent}%
                                        </td>
                                        <td className="py-2 text-right">
                                            <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEditing(member)}>
                                                <Pencil />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            </div>

            {editing && <MemberDialog member={editing === 'new' ? null : editing} users={users} onClose={() => setEditing(null)} />}
            {paying && <PayDialog {...paying} month={month} methods={methods} onClose={() => setPaying(null)} />}
        </AppLayout>
    );
}

function PayslipRow({
    row,
    month,
    member,
    onPay,
}: {
    row: PayRow;
    month: string;
    member?: Member;
    onPay: (values: { commission: string; other_deduction: string; notes: string }) => void;
}) {
    const [commission, setCommission] = useState(row.commission ? String(row.commission) : '');
    const [deduction, setDeduction] = useState(row.other_deduction ? String(row.other_deduction) : '');
    const paid = row.paid_on !== null;

    // Preview while typing; the server recalculates the same way when saving.
    const commissionValue = paid ? row.commission : Number(commission) || 0;
    const deductionValue = paid ? row.other_deduction : Number(deduction) || 0;
    const epfEmployee =
        paid || !member ? row.epf_employee : Math.ceil(((row.basic + commissionValue + row.profit_share) * member.epf_employee_percent) / 100);
    const net = paid ? row.net_pay : row.basic + row.allowance + commissionValue + row.profit_share - epfEmployee - deductionValue;
    const changed = !paid && (commissionValue !== row.commission || deductionValue !== row.other_deduction);
    const values = { commission, other_deduction: deduction, notes: row.notes ?? '' };

    return (
        <tr className="border-b align-top last:border-0">
            <td className="px-4 py-2.5">
                <div className="font-medium">{row.member.name}</div>
                <div className="text-muted-foreground text-xs">{row.member.position ?? ''}</div>
                {row.linked ? (
                    <div className="mt-1 text-xs whitespace-nowrap" title="Order bulan ini yang dia jadi sales PIC (tanpa caj pos)">
                        <span className="font-semibold tabular-nums">{row.performance.pieces} pcs</span>
                        <span className="text-muted-foreground">
                            {' '}
                            · {row.performance.orders} order · {rm(row.performance.sales, 0)}
                        </span>
                    </div>
                ) : (
                    <div className="text-muted-foreground mt-1 text-xs italic">Tiada akaun login dipautkan</div>
                )}
            </td>
            <td className="py-2.5 pr-3 text-right tabular-nums">
                {rm(row.basic + row.allowance)}
                {row.allowance > 0 && <div className="text-muted-foreground text-xs">elaun {rm(row.allowance)}</div>}
            </td>
            <td className="py-2 pr-3">
                {paid ? (
                    <div className="pt-0.5 text-right tabular-nums">{rm(row.commission)}</div>
                ) : (
                    <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="h-8 text-right"
                        value={commission}
                        onChange={(e) => setCommission(e.target.value)}
                        placeholder="0.00"
                        aria-label={`Komisen ${row.member.name}`}
                    />
                )}
            </td>
            <td className="py-2.5 pr-3 text-right tabular-nums">{rm(row.profit_share)}</td>
            <td className="py-2.5 pr-3 text-right tabular-nums">
                {rm(epfEmployee)}
                <div className="text-muted-foreground text-xs">majikan {rm(row.epf_employer)}</div>
            </td>
            <td className="py-2 pr-3">
                {paid ? (
                    <div className="pt-0.5 text-right tabular-nums">{rm(row.other_deduction)}</div>
                ) : (
                    <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="h-8 text-right"
                        value={deduction}
                        onChange={(e) => setDeduction(e.target.value)}
                        placeholder="0.00"
                    />
                )}
            </td>
            <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{rm(net)}</td>
            <td className="px-4 py-2">
                <div className="flex flex-wrap items-center justify-end gap-1">
                    {paid ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            Dibayar {shortDate(row.paid_on)}
                        </span>
                    ) : row.saved ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Draf</span>
                    ) : null}
                    {row.payslip_id && (
                        <Button size="icon" variant="ghost" asChild aria-label="Slip gaji">
                            <a href={`/finance/payslips/${row.payslip_id}`} target="_blank" rel="noreferrer" title="Slip gaji">
                                <FileText />
                            </a>
                        </Button>
                    )}
                    {paid ? (
                        <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Batal bayar"
                            title="Batal status dibayar"
                            onClick={async () => {
                                const ok = await confirmDialog({
                                    title: `Batal status dibayar untuk ${row.member.name}?`,
                                    message: 'Rekod cash out gaji ini akan dipadam.',
                                    confirmLabel: 'Batal bayar',
                                    destructive: true,
                                });
                                if (ok !== false) router.post(`/finance/payslips/${row.payslip_id}/unpay`, {}, { preserveScroll: true });
                            }}
                        >
                            <Undo2 />
                        </Button>
                    ) : (
                        <>
                            {row.saved && !changed && (
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    aria-label="Padam draf"
                                    title="Padam draf, kira semula ikut kadar terkini"
                                    onClick={() => router.delete(`/finance/payslips/${row.payslip_id}`, { preserveScroll: true })}
                                >
                                    <RotateCcw />
                                </Button>
                            )}
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => router.post(`/finance/payroll/${row.member.id}/${month}`, values, { preserveScroll: true })}
                            >
                                Simpan
                            </Button>
                            <Button size="sm" onClick={() => onPay(values)}>
                                Bayar
                            </Button>
                        </>
                    )}
                </div>
            </td>
        </tr>
    );
}

function PayDialog({
    row,
    commission,
    other_deduction,
    notes,
    month,
    methods,
    onClose,
}: {
    row: PayRow;
    commission: string;
    other_deduction: string;
    notes: string;
    month: Props['month'];
    methods: Record<string, string>;
    onClose: () => void;
}) {
    const form = useForm({ commission, other_deduction, notes, paid_on: today(), method: 'transfer', reference: '' });
    const err = form.errors as Record<string, string | undefined>;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(`/finance/payroll/${row.member.id}/${month.ref}/pay`, { preserveScroll: true, onSuccess: onClose });
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        Bayar gaji {row.member.name} · {month.label}
                    </DialogTitle>
                    <DialogDescription>Slip gaji dikunci dan jumlah kos syarikat direkod sebagai cash out kategori Gaji.</DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="grid gap-3">
                    <div className="grid gap-1.5">
                        <Label>Tarikh bayar</Label>
                        <Input type="date" value={form.data.paid_on} onChange={(e) => form.setData('paid_on', e.target.value)} required />
                        <InputError message={err.paid_on} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                            <Label>Kaedah</Label>
                            <NativeSelect value={form.data.method} onChange={(e) => form.setData('method', e.target.value)}>
                                {Object.entries(methods).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </NativeSelect>
                        </div>
                        <div className="grid gap-1.5">
                            <Label>No. rujukan</Label>
                            <Input value={form.data.reference} onChange={(e) => form.setData('reference', e.target.value)} />
                        </div>
                    </div>
                    <div className="grid gap-1.5">
                        <Label>Catatan pada slip</Label>
                        <Input
                            value={form.data.notes}
                            onChange={(e) => form.setData('notes', e.target.value)}
                            placeholder="cth: Komisen capai target Oktober"
                        />
                    </div>
                    <InputError message={err.payslip} />
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={onClose}>
                            Batal
                        </Button>
                        <Button disabled={form.processing}>Tanda dibayar</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function MemberDialog({ member, users, onClose }: { member: Member | null; users: { id: number; name: string }[]; onClose: () => void }) {
    const form = useForm({
        name: member?.name ?? '',
        position: member?.position ?? '',
        user_id: member?.user_id ? String(member.user_id) : '',
        bank_account: member?.bank_account ?? '',
        basic_salary: String(member?.basic_salary ?? 0),
        allowance: String(member?.allowance ?? 0),
        profit_share_percent: String(member?.profit_share_percent ?? 0),
        epf_employee_percent: String(member?.epf_employee_percent ?? 0),
        epf_employer_percent: String(member?.epf_employer_percent ?? 0),
        active: member?.active ?? true,
    });
    const err = form.errors as Record<string, string | undefined>;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: onClose };
        if (member) form.put(`/finance/team/${member.id}`, options);
        else form.post('/finance/team', options);
    };

    const number = (key: keyof typeof form.data, label: string, hint?: string) => (
        <div className="grid gap-1.5">
            <Label>{label}</Label>
            <Input type="number" min="0" step="0.01" value={String(form.data[key])} onChange={(e) => form.setData(key, e.target.value as never)} />
            {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
            <InputError message={err[key]} />
        </div>
    );

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{member ? `Tetapan gaji ${member.name}` : 'Tambah ahli team'}</DialogTitle>
                    <DialogDescription>Biarkan 0 untuk komponen yang tidak dipakai.</DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                        <Label>Nama *</Label>
                        <Input value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} required />
                        <InputError message={err.name} />
                    </div>
                    <div className="grid gap-1.5">
                        <Label>Jawatan</Label>
                        <Input value={form.data.position} onChange={(e) => form.setData('position', e.target.value)} placeholder="cth: Designer" />
                    </div>
                    <div className="grid gap-1.5">
                        <Label>Akaun login (tunjuk jualan dia)</Label>
                        <NativeSelect value={form.data.user_id} onChange={(e) => form.setData('user_id', e.target.value)}>
                            <option value="">Tiada</option>
                            {users.map((user) => (
                                <option key={user.id} value={user.id}>
                                    {user.name}
                                </option>
                            ))}
                        </NativeSelect>
                    </div>
                    <div className="grid gap-1.5">
                        <Label>No. akaun bank</Label>
                        <Input value={form.data.bank_account} onChange={(e) => form.setData('bank_account', e.target.value)} />
                    </div>
                    {number('basic_salary', 'Gaji pokok (RM)')}
                    {number('allowance', 'Elaun tetap (RM)', 'Tidak dikenakan KWSP.')}
                    {number('profit_share_percent', 'Bahagian untung (%)', 'Atas untung bersih bulan sebelum gaji.')}
                    {number('epf_employee_percent', 'KWSP pekerja (%)', 'Biasanya 11. Isi 0 jika tidak caruman.')}
                    {number('epf_employer_percent', 'KWSP majikan (%)', 'Biasanya 13 (gaji ≤ RM5,000) atau 12.')}
                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                        <Checkbox checked={form.data.active} onCheckedChange={(checked) => form.setData('active', checked === true)} />
                        Aktif (masuk dalam senarai gaji bulanan)
                    </label>
                    <InputError message={err.member} className="sm:col-span-2" />
                    <DialogFooter className="sm:col-span-2 sm:justify-between">
                        {member ? (
                            <Button
                                type="button"
                                variant="ghost"
                                className="text-red-600"
                                onClick={async () => {
                                    const ok = await confirmDialog({ title: `Padam ${member.name}?`, confirmLabel: 'Padam', destructive: true });
                                    if (ok !== false) router.delete(`/finance/team/${member.id}`, { preserveScroll: true, onSuccess: onClose });
                                }}
                            >
                                <Trash2 /> Padam
                            </Button>
                        ) : (
                            <span />
                        )}
                        <div className="flex gap-2">
                            <Button type="button" variant="ghost" onClick={onClose}>
                                Batal
                            </Button>
                            <Button disabled={form.processing}>Simpan</Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
