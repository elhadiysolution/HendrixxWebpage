import { confirmDialog } from '@/components/confirm-dialog';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { dateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Head, router, useForm } from '@inertiajs/react';
import { CheckCircle2, CloudDownload, CloudUpload, Plug, XCircle } from 'lucide-react';
import { FormEvent, useState } from 'react';

type StageKey = 'order' | 'design' | 'jobsheet' | 'production' | 'postage';

type SettingsForm = {
    company: {
        name: string;
        registration_no: string;
        address: string;
        phone: string;
        email: string;
        bank_name: string;
        bank_account: string;
        bank_holder: string;
    };
    production_days: number;
    deposit_percent: number;
    working_days: number[];
    holidays: string;
    stage_targets: Record<StageKey, number>;
    sizes: string;
    couriers: string;
    postage_rates: Record<string, number | string>;
    size_surcharges: Record<string, number | string>;
    sheets: { url: string; token: string; auto_sync: boolean };
};

interface Props {
    settings: Omit<SettingsForm, 'sheets'> & { sheets: { url: string | null; auto_sync: boolean; has_token: boolean } };
    sheetStatus: { connected: boolean; last_sync_at: string | null; last_error: string | null };
}

const days = ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu', 'Ahad'];
const stageLabels: Record<StageKey, string> = {
    order: 'Order + Deposit',
    design: 'Design',
    jobsheet: 'Jobsheet',
    production: 'Produksi kilang',
    postage: 'Postage',
};

export default function SettingsPage({ settings, sheetStatus }: Props) {
    const form = useForm<SettingsForm>({
        ...settings,
        company: Object.fromEntries(Object.entries(settings.company).map(([key, value]) => [key, value ?? ''])) as SettingsForm['company'],
        sheets: { url: settings.sheets.url ?? '', token: '', auto_sync: settings.sheets.auto_sync },
    });
    const errors = form.errors as Record<string, string>;
    const [busy, setBusy] = useState<string | null>(null);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.put('/admin/settings', { preserveScroll: true, onSuccess: () => form.setData('sheets', { ...form.data.sheets, token: '' }) });
    };

    const sheetAction = async (action: 'test' | 'push' | 'pull') => {
        if (action === 'pull') {
            const ok = await confirmDialog({
                title: 'Import katalog dari Google Sheet?',
                message: 'Material, Pricelist, Add-on, Spesifikasi & Ejen di website akan diganti dengan data sheet.',
                confirmLabel: 'Import',
            });
            if (ok === false) return;
        }
        if (action === 'push') {
            const ok = await confirmDialog({
                title: 'Hantar SEMUA data ke Google Sheet?',
                message: 'Data dalam sheet akan ditulis semula dengan data website.',
                confirmLabel: 'Hantar',
            });
            if (ok === false) return;
        }
        setBusy(action);
        router.post(`/admin/settings/sheets/${action}`, {}, { preserveScroll: true, onFinish: () => setBusy(null) });
    };

    const setCompany = (key: keyof SettingsForm['company'], value: string) => form.setData('company', { ...form.data.company, [key]: value });

    return (
        <AppLayout breadcrumbs={[{ title: 'Tetapan', href: '/admin/settings' }]}>
            <Head title="Tetapan" />
            <form onSubmit={submit} className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4 md:p-6">
                <div>
                    <h1 className="text-primary text-xl font-semibold">Tetapan sistem</h1>
                    <p className="text-muted-foreground text-sm">Maklumat syarikat (untuk invoice), peraturan operasi dan sambungan Google Sheet.</p>
                </div>

                {/* Google Sheets */}
                <Card>
                    <CardHeader className="pb-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <CardTitle className="text-base">Database Google Sheet</CardTitle>
                            {sheetStatus.connected ? (
                                sheetStatus.last_error ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                                        <XCircle className="size-3.5" /> Ralat sync
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                                        <CheckCircle2 className="size-3.5" /> Disambung
                                    </span>
                                )
                            ) : (
                                <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs font-medium">Belum disambung</span>
                            )}
                        </div>
                        <CardDescription>
                            Setiap perubahan di website disalin automatik ke Google Sheet anda. Website kekal sebagai database utama supaya sistem
                            laju.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="URL Web App" error={errors['sheets.url']} className="sm:col-span-2">
                                <Input
                                    value={form.data.sheets.url}
                                    onChange={(e) => form.setData('sheets', { ...form.data.sheets, url: e.target.value })}
                                    placeholder="https://script.google.com/macros/s/.../exec"
                                />
                            </Field>
                            <Field label="API token" error={errors['sheets.token']}>
                                <Input
                                    type="password"
                                    autoComplete="off"
                                    value={form.data.sheets.token}
                                    onChange={(e) => form.setData('sheets', { ...form.data.sheets, token: e.target.value })}
                                    placeholder={
                                        settings.sheets.has_token
                                            ? '•••••••• (tersimpan — kosongkan untuk kekal)'
                                            : 'Dari menu Hendrixx DB → Tunjuk API token'
                                    }
                                />
                            </Field>
                            <label className="flex items-center gap-2 self-end pb-2 text-sm">
                                <input
                                    type="checkbox"
                                    className="accent-primary size-4"
                                    checked={form.data.sheets.auto_sync}
                                    onChange={(e) => form.setData('sheets', { ...form.data.sheets, auto_sync: e.target.checked })}
                                />
                                Sync automatik setiap perubahan
                            </label>
                        </div>

                        <div className="bg-muted/60 flex flex-wrap items-center gap-2 rounded-lg p-3">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!sheetStatus.connected || busy !== null}
                                onClick={() => sheetAction('test')}
                            >
                                <Plug /> {busy === 'test' ? 'Menguji...' : 'Uji sambungan'}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!sheetStatus.connected || busy !== null}
                                onClick={() => sheetAction('push')}
                            >
                                <CloudUpload /> {busy === 'push' ? 'Menghantar...' : 'Hantar semua data ke Sheet'}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!sheetStatus.connected || busy !== null}
                                onClick={() => sheetAction('pull')}
                            >
                                <CloudDownload /> {busy === 'pull' ? 'Mengimport...' : 'Import katalog dari Sheet'}
                            </Button>
                            {!sheetStatus.connected && <span className="text-muted-foreground text-xs">Simpan URL & token dahulu.</span>}
                        </div>
                        <InputError message={errors.sheets} />
                        <div className="text-muted-foreground text-xs">
                            Sync terakhir: {dateTime(sheetStatus.last_sync_at)}
                            {sheetStatus.last_error && <span className="mt-1 block text-red-600">Ralat terakhir: {sheetStatus.last_error}</span>}
                        </div>
                    </CardContent>
                </Card>

                {/* Company */}
                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base">Maklumat syarikat</CardTitle>
                        <CardDescription>Dipaparkan pada invoice, jobsheet dan sales page.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        <Field label="Nama syarikat *" error={errors['company.name']}>
                            <Input value={form.data.company.name} onChange={(e) => setCompany('name', e.target.value)} required />
                        </Field>
                        <Field label="No. pendaftaran (SSM)" error={errors['company.registration_no']}>
                            <Input value={form.data.company.registration_no} onChange={(e) => setCompany('registration_no', e.target.value)} />
                        </Field>
                        <Field label="No. WhatsApp syarikat *" error={errors['company.phone']}>
                            <Input
                                value={form.data.company.phone}
                                onChange={(e) => setCompany('phone', e.target.value)}
                                placeholder="60123456789"
                                required
                            />
                        </Field>
                        <Field label="Email" error={errors['company.email']}>
                            <Input type="email" value={form.data.company.email} onChange={(e) => setCompany('email', e.target.value)} />
                        </Field>
                        <Field label="Alamat" error={errors['company.address']} className="sm:col-span-2">
                            <Textarea rows={2} value={form.data.company.address} onChange={(e) => setCompany('address', e.target.value)} />
                        </Field>
                        <Field label="Bank" error={errors['company.bank_name']}>
                            <Input value={form.data.company.bank_name} onChange={(e) => setCompany('bank_name', e.target.value)} />
                        </Field>
                        <Field label="No. akaun" error={errors['company.bank_account']}>
                            <Input value={form.data.company.bank_account} onChange={(e) => setCompany('bank_account', e.target.value)} />
                        </Field>
                        <Field label="Nama pemegang akaun" error={errors['company.bank_holder']}>
                            <Input value={form.data.company.bank_holder} onChange={(e) => setCompany('bank_holder', e.target.value)} />
                        </Field>
                    </CardContent>
                </Card>

                {/* Operations */}
                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base">Operasi & lead time</CardTitle>
                        <CardDescription>Digunakan untuk kira due date kilang, amaran lewat dan deposit default.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-5 sm:grid-cols-2">
                        <Field label="Hari bekerja kilang (selepas jobsheet)" error={errors.production_days}>
                            <Input
                                type="number"
                                min={1}
                                value={form.data.production_days}
                                onChange={(e) => form.setData('production_days', Number(e.target.value))}
                            />
                        </Field>
                        <Field label="Deposit default (%)" error={errors.deposit_percent}>
                            <Input
                                type="number"
                                min={0}
                                max={100}
                                value={form.data.deposit_percent}
                                onChange={(e) => form.setData('deposit_percent', Number(e.target.value))}
                            />
                        </Field>

                        <Field label="Hari bekerja" error={errors.working_days} className="sm:col-span-2">
                            <div className="flex flex-wrap gap-1.5">
                                {days.map((day, index) => {
                                    const value = index + 1;
                                    const active = form.data.working_days.includes(value);
                                    return (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() =>
                                                form.setData(
                                                    'working_days',
                                                    active
                                                        ? form.data.working_days.filter((d) => d !== value)
                                                        : [...form.data.working_days, value].sort(),
                                                )
                                            }
                                            className={cn(
                                                'rounded-md border px-3 py-1.5 text-sm',
                                                active ? 'bg-primary text-primary-foreground border-primary' : 'bg-white',
                                            )}
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>
                        </Field>

                        <Field label="Target hari bekerja setiap peringkat" error={errors.stage_targets} className="sm:col-span-2">
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                                {(Object.keys(stageLabels) as StageKey[]).map((stage) => (
                                    <label key={stage} className="grid gap-1 text-xs">
                                        <span className="text-muted-foreground">{stageLabels[stage]}</span>
                                        <Input
                                            type="number"
                                            min={0}
                                            value={form.data.stage_targets[stage]}
                                            onChange={(e) =>
                                                form.setData('stage_targets', { ...form.data.stage_targets, [stage]: Number(e.target.value) })
                                            }
                                        />
                                    </label>
                                ))}
                            </div>
                        </Field>

                        <Field label="Cuti umum (satu tarikh sebaris, YYYY-MM-DD)" error={errors.holidays}>
                            <Textarea
                                rows={4}
                                className="font-mono"
                                placeholder={'2026-12-25\n2027-01-01'}
                                value={form.data.holidays}
                                onChange={(e) => form.setData('holidays', e.target.value)}
                            />
                        </Field>
                        <div className="grid gap-4">
                            <Field label="Senarai size (dipisah koma)" error={errors.sizes}>
                                <Input value={form.data.sizes} onChange={(e) => form.setData('sizes', e.target.value)} />
                            </Field>
                            <Field label="Senarai kurier (dipisah koma)" error={errors.couriers}>
                                <Input value={form.data.couriers} onChange={(e) => form.setData('couriers', e.target.value)} />
                            </Field>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base">Caj pos ikut zon</CardTitle>
                        <CardDescription>
                            Diisi automatik dalam borang order bila negeri penghantaran dipilih (masih boleh diubah untuk order tertentu).
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        {Object.keys(form.data.postage_rates).map((zone) => (
                            <Field key={zone} label={`${zone} (RM / order)`} error={errors[`postage_rates.${zone}`]}>
                                <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={form.data.postage_rates[zone]}
                                    onChange={(e) => form.setData('postage_rates', { ...form.data.postage_rates, [zone]: e.target.value })}
                                />
                            </Field>
                        ))}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base">Caj tambahan ikut saiz (RM / helai)</CardTitle>
                        <CardDescription>
                            Ditambah ke invoice secara automatik sebagai baris "Caj saiz besar" bila senarai nama / saiz diisi. Kosong atau 0 = tiada
                            caj. Saiz baru dalam senarai size di atas muncul di sini selepas disimpan.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
                        {Object.keys(form.data.size_surcharges).map((size) => (
                            <Field key={size} label={size} error={errors[`size_surcharges.${size}`]}>
                                <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    placeholder="0"
                                    value={form.data.size_surcharges[size] || ''}
                                    onChange={(e) => form.setData('size_surcharges', { ...form.data.size_surcharges, [size]: e.target.value })}
                                />
                            </Field>
                        ))}
                    </CardContent>
                </Card>

                <div className="bg-background/80 sticky bottom-0 -mx-4 flex justify-end border-t px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
                    <Button disabled={form.processing}>Simpan tetapan</Button>
                </div>
            </form>
        </AppLayout>
    );
}

function Field({ label, error, className, children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
    return (
        <div className={cn('grid gap-1.5', className)}>
            <Label>{label}</Label>
            {children}
            <InputError message={error} />
        </div>
    );
}
