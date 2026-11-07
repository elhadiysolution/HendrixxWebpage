import InputError from '@/components/input-error';
import { type NameRow, sizeRatesText } from '@/components/name-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { rm } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { LoaderCircle, Plus, Trash2, X } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';

type Item = {
    line: string; // UI only: '' = not chosen, MANUAL = not in pricelist, otherwise a pricelist line key
    pricelist_code: string;
    addons: string[];
    description: string;
    garment_type: string;
    print_method: string;
    fabric: string;
    neck_type: string;
    neck_finish: string;
    test_print: boolean;
    quantity: number | string;
    unit_price: number | string;
    // Filled on the jobsheet page; carried through untouched so editing the invoice keeps them.
    sizes: Record<string, number | string>;
    names: NameRow[];
    notes: string;
};

type SpecGroup = 'garment_type' | 'print_method' | 'neck_type' | 'neck_finish';

type SpecOption = { name: string; price: number };

const SPEC_GROUPS: SpecGroup[] = ['garment_type', 'print_method', 'neck_type', 'neck_finish'];

/** Per-order add-on charged once for every item that asks for a test print. */
const TEST_PRINT_CODE = 'ADD-TESTPRINT';

const MANUAL = '__manual';

type OrderForm = {
    customer: { name: string; phone: string; organization: string; state: string };
    title: string;
    required_by: string;
    sales_user_id: number | string;
    agent_id: number | string;
    campaign_id: number | string;
    inquiry_id: number | null;
    discount: number | string;
    shipping_fee: number | string;
    deposit_required: number | string;
    notes: string;
    items: Item[];
};

interface ExistingOrder extends Omit<OrderForm, 'customer' | 'inquiry_id' | 'items' | 'agent_id' | 'campaign_id'> {
    id: number;
    order_no: string;
    agent_id: number | null;
    campaign_id: number | null;
    customer: Partial<OrderForm['customer']>;
    items: Partial<Omit<Item, 'line' | 'names'> & { names: Partial<Record<keyof NameRow, string | null>>[] }>[];
}

interface Inquiry {
    id: number;
    name: string;
    phone: string;
    email: string | null;
    organization: string | null;
    product: string | null;
    quantity: number | null;
    message: string | null;
    required_by: string | null;
}

interface PriceTier {
    code: string;
    product: string;
    material_code: string | null;
    material: string | null;
    sleeve: string | null;
    collar: string | null;
    min_qty: number;
    max_qty: number | null;
    price: number;
}

interface AddOnOption {
    code: string;
    name: string;
    charge_type: 'per helai' | 'per order';
    price: number;
}

interface AgentOption {
    id: number;
    name: string;
    area: string | null;
    commission_type: 'percent' | 'per helai';
    commission_value: number;
}

interface Props {
    order: ExistingOrder | null;
    inquiry: Inquiry | null;
    fabrics: string[];
    specOptions: Record<SpecGroup, SpecOption[]>;
    states: Record<string, string[]>;
    postageRates: Record<string, number>;
    depositPercent: number;
    salesUsers: { id: number; name: string }[];
    pricelist: PriceTier[];
    addOns: AddOnOption[];
    agents: AgentOption[];
    campaigns: { id: number; name: string; type: string }[];
    sizeRates: Record<string, number>;
    sizeSurcharges: { description: string; quantity: number; unit_price: number }[];
}

const lineKey = (tier: Pick<PriceTier, 'product' | 'material_code' | 'sleeve' | 'collar'>) =>
    [tier.product, tier.material_code ?? '', tier.sleeve ?? '', tier.collar ?? ''].join('|');

const emptyItem = (fabric = ''): Item => ({
    line: '',
    pricelist_code: '',
    addons: [],
    description: '',
    garment_type: '',
    print_method: '',
    fabric,
    neck_type: '',
    neck_finish: '',
    test_print: false,
    quantity: '',
    unit_price: '',
    sizes: {},
    names: [],
    notes: '',
});

export default function OrderFormPage({
    order,
    inquiry,
    fabrics,
    specOptions,
    states,
    postageRates,
    depositPercent,
    salesUsers,
    pricelist,
    addOns,
    agents,
    campaigns,
    sizeRates,
    sizeSurcharges,
}: Props) {
    const editing = order !== null;
    const [showNotes, setShowNotes] = useState(Boolean(order?.notes || inquiry?.message));

    const lines = useMemo(() => {
        const map = new Map<string, { key: string; label: string; tiers: PriceTier[] }>();
        pricelist.forEach((tier) => {
            const key = lineKey(tier);
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    label: [tier.product, tier.material ?? tier.material_code, tier.sleeve ? `Lengan ${tier.sleeve}` : null, tier.collar]
                        .filter(Boolean)
                        .join(' · '),
                    tiers: [],
                });
            }
            map.get(key)!.tiers.push(tier);
        });
        map.forEach((line) => line.tiers.sort((a, b) => a.min_qty - b.min_qty));
        return map;
    }, [pricelist]);

    const addOnMap = useMemo(() => new Map(addOns.map((addOn) => [addOn.code, addOn])), [addOns]);
    const perHelai = addOns.filter((addOn) => addOn.charge_type === 'per helai');
    const perOrder = addOns.filter((addOn) => addOn.charge_type === 'per order' && addOn.code !== TEST_PRINT_CODE);
    const fabricOptions = useMemo(() => fabrics.map((name) => ({ name, price: 0 })), [fabrics]);

    const tierFor = (key: string, quantity: number): PriceTier | undefined => {
        const tiers = lines.get(key)?.tiers ?? [];
        const qty = Math.max(1, quantity);
        return [...tiers].reverse().find((tier) => tier.min_qty <= qty && (tier.max_qty === null || tier.max_qty >= qty)) ?? tiers[0];
    };

    const addOnPerPiece = (codes: string[]) =>
        codes.reduce((sum, code) => sum + (addOnMap.get(code)?.charge_type === 'per helai' ? addOnMap.get(code)!.price : 0), 0);

    const specPrice = (group: SpecGroup, name: string) => specOptions[group].find((option) => option.name === name)?.price ?? 0;
    const specPerPiece = (item: Item) => SPEC_GROUPS.reduce((sum, group) => sum + specPrice(group, item[group]), 0);

    const isServiceLine = (item: Item) => item.line === '' && item.addons.some((code) => addOnMap.get(code)?.charge_type === 'per order');

    /** Keep one "Test print" line whose quantity = number of items asking for a test print. */
    const syncTestPrint = (items: Item[]): Item[] => {
        const addOn = addOnMap.get(TEST_PRINT_CODE);
        if (!addOn) return items;
        const count = items.filter((item) => !isServiceLine(item) && item.test_print).length;
        const index = items.findIndex((item) => isServiceLine(item) && item.addons.includes(TEST_PRINT_CODE));
        if (count === 0) return index < 0 ? items : items.filter((_, i) => i !== index);
        if (index >= 0) return items.map((item, i) => (i === index ? { ...item, quantity: count } : item));
        return [...items, { ...emptyItem(), description: addOn.name, quantity: count, unit_price: addOn.price.toFixed(2), addons: [addOn.code] }];
    };

    const { data, setData, post, put, processing, errors } = useForm<OrderForm>({
        customer: {
            name: order?.customer.name ?? inquiry?.name ?? '',
            phone: order?.customer.phone ?? inquiry?.phone ?? '',
            organization: order?.customer.organization ?? inquiry?.organization ?? '',
            state: order?.customer.state ?? '',
        },
        title: order?.title ?? (inquiry ? [inquiry.product, inquiry.organization].filter(Boolean).join(' - ') : ''),
        required_by: order?.required_by ?? inquiry?.required_by ?? '',
        sales_user_id: order?.sales_user_id ?? '',
        agent_id: order?.agent_id ?? '',
        campaign_id: order?.campaign_id ?? '',
        inquiry_id: inquiry?.id ?? null,
        discount: order?.discount ?? 0,
        shipping_fee: order?.shipping_fee ?? 0,
        deposit_required: order?.deposit_required ?? '',
        notes: order?.notes ?? inquiry?.message ?? '',
        items: order?.items.length
            ? order.items.map((item) => {
                  const tier = pricelist.find((t) => t.code === item.pricelist_code);
                  const service = !item.pricelist_code && (item.addons ?? []).some((code) => addOnMap.get(code)?.charge_type === 'per order');
                  return {
                      ...emptyItem(),
                      ...item,
                      line: tier ? lineKey(tier) : service ? '' : MANUAL,
                      pricelist_code: item.pricelist_code ?? '',
                      addons: item.addons ?? [],
                      description: item.description ?? '',
                      garment_type: item.garment_type ?? '',
                      print_method: item.print_method ?? '',
                      fabric: item.fabric ?? '',
                      neck_type: item.neck_type ?? '',
                      neck_finish: item.neck_finish ?? '',
                      test_print: Boolean(item.test_print),
                      notes: item.notes ?? '',
                      sizes: { ...(item.sizes ?? {}) },
                      names: (item.names ?? []).map((row) => ({ name: row.name ?? '', number: row.number ?? '', size: row.size ?? '' })),
                  };
              })
            : [{ ...emptyItem(fabrics[0]), quantity: inquiry?.quantity ?? '' }],
    });

    const err = errors as Record<string, string>;
    const surchargeTotal = sizeSurcharges.reduce((sum, line) => sum + line.quantity * line.unit_price, 0);
    const subtotal = data.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0) + surchargeTotal;
    const total = Math.max(0, subtotal - Number(data.discount || 0) + Number(data.shipping_fee || 0));
    const pieces = data.items.filter((item) => !isServiceLine(item)).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const suggestedDeposit = Math.round(((total * depositPercent) / 100) * 100) / 100;
    const agent = agents.find((a) => String(a.id) === String(data.agent_id));
    const commission = agent ? (agent.commission_type === 'per helai' ? pieces * agent.commission_value : (total * agent.commission_value) / 100) : 0;
    const garmentCount = data.items.filter((item) => !isServiceLine(item)).length;
    const missingProduct = data.items.some((item) => !isServiceLine(item) && item.line === '');
    const zone = Object.keys(states).find((key) => states[key].includes(data.customer.state));

    const setCustomer = (field: keyof OrderForm['customer'], value: string) => setData('customer', { ...data.customer, [field]: value });

    /** Picking a state fills the postage fee from its zone rate (Tetapan), when one is set. */
    const setState = (state: string) => {
        const stateZone = Object.keys(states).find((key) => states[key].includes(state));
        const rate = stateZone ? postageRates[stateZone] : 0;
        setData({ ...data, customer: { ...data.customer, state }, shipping_fee: rate > 0 ? rate : data.shipping_fee });
    };

    const setItem = (index: number, patch: Partial<Item>) =>
        setData(
            'items',
            data.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
        );

    /** Re-price an item from its pricelist line (tier by quantity) plus per-piece add-ons and spec surcharges. */
    const priced = (item: Item): Partial<Item> => {
        if (!lines.has(item.line)) return {};
        const tier = tierFor(item.line, Number(item.quantity || 0));
        if (!tier) return {};
        return { pricelist_code: tier.code, unit_price: (tier.price + addOnPerPiece(item.addons) + specPerPiece(item)).toFixed(2) };
    };

    const setSpec = (index: number, group: SpecGroup, value: string) => {
        const current = data.items[index];
        const next = { ...current, [group]: value };
        if (lines.has(current.line)) return setItem(index, { [group]: value, ...priced(next) });

        // Manual price: swap the old surcharge for the new one.
        const delta = specPrice(group, value) - specPrice(group, current[group]);
        setItem(index, { [group]: value, unit_price: (Number(current.unit_price || 0) + delta).toFixed(2) });
    };

    const setTestPrint = (index: number, test_print: boolean) =>
        setData('items', syncTestPrint(data.items.map((item, i) => (i === index ? { ...item, test_print } : item))));

    const chooseLine = (index: number, key: string) => {
        const current = data.items[index];
        if (!lines.has(key)) return setItem(index, { line: key, pricelist_code: '' });
        const tier = tierFor(key, Number(current.quantity || 0))!;
        const next = {
            ...current,
            line: key,
            description: [tier.product, tier.collar, tier.sleeve ? `Lengan ${tier.sleeve}` : null].filter(Boolean).join(' · '),
            fabric: tier.material ?? current.fabric,
            neck_type: specOptions.neck_type.some((option) => option.name === tier.collar) ? tier.collar! : current.neck_type,
        };
        setItem(index, { ...next, ...priced(next) });
    };

    const changeQuantity = (index: number, quantity: string) => {
        const next = { ...data.items[index], quantity };
        setItem(index, { quantity, ...priced(next) });
    };

    const toggleAddOn = (index: number, code: string) => {
        const current = data.items[index];
        const has = current.addons.includes(code);
        const addons = has ? current.addons.filter((c) => c !== code) : [...current.addons, code];
        const next = { ...current, addons };

        if (lines.has(current.line)) return setItem(index, { addons, ...priced(next) });

        // Manual price: just add/remove the add-on price.
        const delta = (addOnMap.get(code)?.price ?? 0) * (has ? -1 : 1);
        setItem(index, { addons, unit_price: (Number(current.unit_price || 0) + delta).toFixed(2) });
    };

    const removeItem = (index: number) => setData('items', syncTestPrint(data.items.filter((_, i) => i !== index)));

    const addServiceLine = (addOn: AddOnOption) =>
        setData('items', [
            ...data.items,
            { ...emptyItem(), description: addOn.name, fabric: '', quantity: 1, unit_price: addOn.price.toFixed(2), addons: [addOn.code] },
        ]);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (missingProduct) return;
        if (editing) put(`/orders/${order.id}`);
        else post('/orders');
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Order Board', href: '/orders' },
        editing ? { title: order.order_no, href: `/orders/${order.id}` } : { title: 'Order Baru', href: '/orders/create' },
    ];

    let garmentNo = 0;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={editing ? `Edit ${order.order_no}` : 'Order Baru'} />
            <form onSubmit={submit} className="mx-auto grid w-full max-w-6xl flex-1 items-start gap-4 p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="lg:col-span-2">
                    <h1 className="text-primary text-xl font-semibold">{editing ? `Edit invoice ${order.order_no}` : 'Order baru'}</h1>
                    <p className="text-muted-foreground text-sm">
                        Isi maklumat untuk invoice customer. Senarai nama, nombor & saiz diisi kemudian semasa peringkat jobsheet.
                    </p>
                </div>

                <div className="flex min-w-0 flex-col gap-4">
                    {/* 1. Customer */}
                    <Card>
                        <SectionHeader step={1} title="Customer" description="Customer sedia ada dikenal pasti melalui no. telefon." />
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                            <Field label="Nama PIC *" error={err['customer.name']}>
                                <Input
                                    value={data.customer.name}
                                    onChange={(e) => setCustomer('name', e.target.value)}
                                    required
                                    autoFocus={!editing}
                                />
                            </Field>
                            <Field label="No. telefon (WhatsApp) *" error={err['customer.phone']}>
                                <Input
                                    value={data.customer.phone}
                                    onChange={(e) => setCustomer('phone', e.target.value)}
                                    placeholder="0123456789"
                                    inputMode="tel"
                                    required
                                />
                            </Field>
                            <Field label="Organisasi / Team / Sekolah" error={err['customer.organization']}>
                                <Input value={data.customer.organization} onChange={(e) => setCustomer('organization', e.target.value)} />
                            </Field>
                            <Field label="Negeri penghantaran" error={err['customer.state']}>
                                <NativeSelect value={data.customer.state} onChange={(e) => setState(e.target.value)}>
                                    <option value="">— Pilih negeri —</option>
                                    {Object.entries(states).map(([group, list]) => (
                                        <optgroup key={group} label={group}>
                                            {list.map((state) => (
                                                <option key={state} value={state}>
                                                    {state}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </NativeSelect>
                            </Field>
                        </CardContent>
                    </Card>

                    {/* 2. Projek */}
                    <Card>
                        <SectionHeader step={2} title="Projek" />
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                            <Field label="Nama projek *" error={err.title} className="sm:col-span-2">
                                <Input
                                    value={data.title}
                                    onChange={(e) => setData('title', e.target.value)}
                                    placeholder="cth: Jersey Esports UM 2026"
                                    required
                                />
                            </Field>
                            <Field label="Tarikh customer perlukan" error={err.required_by}>
                                <Input type="date" value={data.required_by} onChange={(e) => setData('required_by', e.target.value)} />
                            </Field>
                            <Field label="Ejen" error={err.agent_id}>
                                <NativeSelect value={data.agent_id} onChange={(e) => setData('agent_id', e.target.value)}>
                                    <option value="">Tiada (jualan terus)</option>
                                    {agents.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.name}
                                            {a.area ? ` — ${a.area}` : ''}
                                        </option>
                                    ))}
                                </NativeSelect>
                            </Field>
                            {campaigns.length > 0 && (
                                <Field label="Projek / kempen (target)" error={err.campaign_id}>
                                    <NativeSelect value={data.campaign_id} onChange={(e) => setData('campaign_id', e.target.value)}>
                                        <option value="">Tiada</option>
                                        {campaigns.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                </Field>
                            )}
                            <Field label="Sales PIC" error={err.sales_user_id}>
                                <NativeSelect value={data.sales_user_id} onChange={(e) => setData('sales_user_id', e.target.value)}>
                                    <option value="">(Saya)</option>
                                    {salesUsers.map((user) => (
                                        <option key={user.id} value={user.id}>
                                            {user.name}
                                        </option>
                                    ))}
                                </NativeSelect>
                            </Field>
                            <div className="flex items-end">
                                {!showNotes && (
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowNotes(true)}>
                                        <Plus /> Nota dalaman
                                    </Button>
                                )}
                            </div>
                            {showNotes && (
                                <Field label="Nota dalaman (tidak dicetak pada invoice)" className="sm:col-span-2">
                                    <Textarea rows={3} value={data.notes} onChange={(e) => setData('notes', e.target.value)} />
                                </Field>
                            )}
                        </CardContent>
                    </Card>

                    {/* 3. Item */}
                    <Card>
                        <SectionHeader step={3} title="Item baju" description={`${pieces} helai keseluruhan`} />
                        <CardContent className="space-y-4">
                            {err.items && <InputError message={err.items} />}
                            {data.items.map((item, index) => {
                                if (isServiceLine(item)) return null;
                                garmentNo += 1;

                                const tier = lines.has(item.line) ? pricelist.find((t) => t.code === item.pricelist_code) : undefined;
                                const manual = item.line === MANUAL;
                                const chosen = item.line !== '';
                                const addOnPrice = addOnPerPiece(item.addons);
                                const specExtra = specPerPiece(item);
                                const lineTotal = Number(item.quantity || 0) * Number(item.unit_price || 0);

                                return (
                                    <div key={index} className="rounded-lg border bg-white">
                                        <div className="bg-muted/40 flex items-center justify-between gap-2 border-b px-4 py-2">
                                            <span className="text-sm font-semibold">Item {garmentNo}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold tabular-nums">{rm(lineTotal)}</span>
                                                {garmentCount > 1 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-8"
                                                        onClick={() => removeItem(index)}
                                                        aria-label="Buang item"
                                                    >
                                                        <Trash2 />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-4 p-4">
                                            <div className="grid gap-3 sm:grid-cols-12">
                                                <Field label="Produk *" className="sm:col-span-8">
                                                    <NativeSelect
                                                        value={item.line}
                                                        onChange={(e) => chooseLine(index, e.target.value)}
                                                        className={cn(!chosen && 'border-primary/50 bg-primary/5')}
                                                    >
                                                        <option value="">— Pilih produk —</option>
                                                        {[...lines.values()].map((line) => (
                                                            <option key={line.key} value={line.key}>
                                                                {line.label}
                                                            </option>
                                                        ))}
                                                        <option value={MANUAL}>Lain-lain (tiada dalam pricelist — harga manual)</option>
                                                    </NativeSelect>
                                                </Field>
                                                <Field label="Bilangan helai *" error={err[`items.${index}.quantity`]} className="sm:col-span-4">
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        inputMode="numeric"
                                                        placeholder="cth: 30"
                                                        value={item.quantity}
                                                        onChange={(e) => changeQuantity(index, e.target.value)}
                                                        required
                                                    />
                                                </Field>
                                            </div>

                                            {!chosen ? (
                                                <p className="text-muted-foreground text-sm">
                                                    Pilih produk dahulu — harga akan dikira automatik dari pricelist.
                                                </p>
                                            ) : (
                                                <>
                                                    <div className="grid gap-3 sm:grid-cols-12">
                                                        <Field
                                                            label="Nama item pada invoice *"
                                                            error={err[`items.${index}.description`]}
                                                            className={manual ? 'sm:col-span-8' : 'sm:col-span-12'}
                                                        >
                                                            <Input
                                                                value={item.description}
                                                                placeholder="cth: Jersey Sublimation Round Neck"
                                                                onChange={(e) => setItem(index, { description: e.target.value })}
                                                                required
                                                            />
                                                        </Field>
                                                        {manual && (
                                                            <Field
                                                                label="Harga / helai (RM) *"
                                                                error={err[`items.${index}.unit_price`]}
                                                                className="sm:col-span-4"
                                                            >
                                                                <Input
                                                                    type="number"
                                                                    min={0}
                                                                    step="0.01"
                                                                    value={item.unit_price}
                                                                    onChange={(e) => setItem(index, { unit_price: e.target.value })}
                                                                    required
                                                                />
                                                            </Field>
                                                        )}
                                                    </div>

                                                    <div>
                                                        <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                                                            Spesifikasi
                                                        </div>
                                                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                                            <SpecSelect
                                                                label="Jenis baju"
                                                                value={item.garment_type}
                                                                options={specOptions.garment_type}
                                                                onChange={(value) => setSpec(index, 'garment_type', value)}
                                                            />
                                                            <SpecSelect
                                                                label="Proses printing"
                                                                value={item.print_method}
                                                                options={specOptions.print_method}
                                                                onChange={(value) => setSpec(index, 'print_method', value)}
                                                            />
                                                            <SpecSelect
                                                                label="Material"
                                                                value={item.fabric}
                                                                options={fabricOptions}
                                                                onChange={(value) => setItem(index, { fabric: value })}
                                                            />
                                                            <SpecSelect
                                                                label="Jenis neck"
                                                                value={item.neck_type}
                                                                options={specOptions.neck_type}
                                                                onChange={(value) => setSpec(index, 'neck_type', value)}
                                                            />
                                                            <SpecSelect
                                                                label="Neck sublimation / readymade"
                                                                value={item.neck_finish}
                                                                options={specOptions.neck_finish}
                                                                onChange={(value) => setSpec(index, 'neck_finish', value)}
                                                            />
                                                            <Field label="Nak test print?">
                                                                <Toggle value={item.test_print} onChange={(value) => setTestPrint(index, value)} />
                                                            </Field>
                                                        </div>
                                                    </div>

                                                    {perHelai.length > 0 && (
                                                        <div>
                                                            <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                                                                Add-on
                                                            </div>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {perHelai.map((addOn) => {
                                                                    const active = item.addons.includes(addOn.code);
                                                                    return (
                                                                        <button
                                                                            key={addOn.code}
                                                                            type="button"
                                                                            onClick={() => toggleAddOn(index, addOn.code)}
                                                                            className={cn(
                                                                                'rounded-full border px-3 py-1.5 text-sm',
                                                                                active
                                                                                    ? 'bg-primary text-primary-foreground border-primary'
                                                                                    : 'hover:bg-accent bg-white',
                                                                            )}
                                                                        >
                                                                            {active && '✓ '}
                                                                            {addOn.name}
                                                                            {addOn.price > 0 && (
                                                                                <span className="opacity-70"> +{rm(addOn.price)}</span>
                                                                            )}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <Field label="Nota item (optional)">
                                                        <Input
                                                            value={item.notes}
                                                            placeholder="cth: logo sponsor di dada kanan"
                                                            onChange={(e) => setItem(index, { notes: e.target.value })}
                                                        />
                                                    </Field>

                                                    <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-sm">
                                                        <span className="text-muted-foreground">
                                                            {tier ? (
                                                                <>
                                                                    Tier {tier.min_qty}
                                                                    {tier.max_qty ? `–${tier.max_qty}` : '+'} helai {rm(tier.price)}
                                                                    {addOnPrice > 0 && ` + add-on ${rm(addOnPrice)}`}
                                                                    {specExtra > 0 && ` + spesifikasi ${rm(specExtra)}`}
                                                                </>
                                                            ) : (
                                                                'Harga manual'
                                                            )}
                                                        </span>
                                                        <span className="tabular-nums">
                                                            {Number(item.quantity || 0)} × {rm(Number(item.unit_price || 0))} ={' '}
                                                            <strong>{rm(lineTotal)}</strong>
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            <button
                                type="button"
                                onClick={() => setData('items', [...data.items, emptyItem(fabrics[0])])}
                                className="text-primary hover:bg-primary/5 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed py-3 text-sm font-medium"
                            >
                                <Plus className="size-4" /> Tambah item lain (design / produk berbeza)
                            </button>
                        </CardContent>
                    </Card>
                </div>

                {/* Invoice summary */}
                <div className="lg:sticky lg:top-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Ringkasan invoice</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="space-y-2">
                                {data.items.map((item, index) => {
                                    const service = isServiceLine(item);
                                    const auto = service && item.addons.includes(TEST_PRINT_CODE);
                                    return (
                                        <div key={index} className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className={cn('truncate', !item.description && 'text-muted-foreground italic')}>
                                                    {item.description || 'Item belum dipilih'}
                                                </div>
                                                <div className="text-muted-foreground text-xs tabular-nums">
                                                    {Number(item.quantity || 0)} × {rm(Number(item.unit_price || 0))}
                                                    {auto && ' · auto'}
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1">
                                                <span className="tabular-nums">{rm(Number(item.quantity || 0) * Number(item.unit_price || 0))}</span>
                                                {service && !auto && (
                                                    <button
                                                        type="button"
                                                        className="text-muted-foreground hover:text-foreground"
                                                        onClick={() => removeItem(index)}
                                                        aria-label="Buang caj"
                                                    >
                                                        <X className="size-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {sizeSurcharges.map((line) => (
                                <div key={line.description} className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="truncate">{line.description}</div>
                                        <div className="text-muted-foreground text-xs tabular-nums">
                                            {line.quantity} × {rm(line.unit_price)} · auto dari senarai saiz
                                        </div>
                                    </div>
                                    <span className="tabular-nums">{rm(line.quantity * line.unit_price)}</span>
                                </div>
                            ))}
                            {sizeSurcharges.length === 0 && Object.keys(sizeRates).length > 0 && (
                                <p className="text-muted-foreground bg-muted/40 rounded-md px-2.5 py-2 text-xs">
                                    Caj saiz besar ditambah automatik bila senarai saiz diisi (peringkat jobsheet): {sizeRatesText(sizeRates)} /
                                    helai.
                                </p>
                            )}

                            {perOrder.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {perOrder
                                        .filter((addOn) => !data.items.some((item) => isServiceLine(item) && item.addons.includes(addOn.code)))
                                        .map((addOn) => (
                                            <button
                                                key={addOn.code}
                                                type="button"
                                                onClick={() => addServiceLine(addOn)}
                                                className="hover:bg-accent rounded-full border border-dashed px-2.5 py-1 text-xs"
                                            >
                                                + {addOn.name} ({rm(addOn.price, 0)})
                                            </button>
                                        ))}
                                </div>
                            )}

                            <div className="space-y-2 border-t pt-3">
                                <Row label="Subtotal">{rm(subtotal)}</Row>
                                <Row label="Diskaun">
                                    <MoneyInput value={data.discount} onChange={(value) => setData('discount', value)} />
                                </Row>
                                <Row label={zone ? `Caj pos (${zone})` : 'Caj pos'}>
                                    <MoneyInput value={data.shipping_fee} onChange={(value) => setData('shipping_fee', value)} />
                                </Row>
                            </div>

                            <div className="flex items-baseline justify-between border-t pt-3">
                                <span className="font-semibold">Jumlah</span>
                                <span className="text-primary text-2xl font-bold tabular-nums">{rm(total)}</span>
                            </div>

                            <Row label={`Deposit (${depositPercent}%)`}>
                                <MoneyInput
                                    value={data.deposit_required}
                                    placeholder={suggestedDeposit.toFixed(2)}
                                    onChange={(value) => setData('deposit_required', value)}
                                />
                            </Row>
                            <InputError message={err.deposit_required} />
                            {agent && (
                                <p className="text-muted-foreground text-xs">
                                    Komisen ejen {agent.name}: {rm(commission)} (dalaman, tidak dicetak)
                                </p>
                            )}

                            {missingProduct && <p className="text-xs text-amber-700">Pilih produk untuk semua item sebelum simpan.</p>}
                            {editing && sizeSurcharges.length > 0 && (
                                <p className="text-muted-foreground text-xs">Caj saiz besar dikira semula semasa simpan jika bilangan berubah.</p>
                            )}

                            <div className="grid gap-2">
                                <Button type="submit" size="lg" disabled={processing || missingProduct}>
                                    {processing && <LoaderCircle className="animate-spin" />}
                                    {editing ? 'Simpan perubahan' : 'Cipta order & invoice'}
                                </Button>
                                <Button variant="ghost" asChild>
                                    <Link href={editing ? `/orders/${order.id}` : '/orders'}>Batal</Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </form>
        </AppLayout>
    );
}

function SectionHeader({ step, title, description }: { step: number; title: string; description?: string }) {
    return (
        <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
                <span className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                    {step}
                </span>
                <div>
                    <CardTitle className="text-base">{title}</CardTitle>
                    {description && <CardDescription>{description}</CardDescription>}
                </div>
            </div>
        </CardHeader>
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

function Toggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
    return (
        <div className="flex h-10 gap-1.5">
            {[
                { value: true, label: 'Ya' },
                { value: false, label: 'Tidak' },
            ].map((choice) => (
                <button
                    key={choice.label}
                    type="button"
                    onClick={() => onChange(choice.value)}
                    className={cn(
                        'flex-1 rounded-md border text-sm',
                        value === choice.value ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent bg-white',
                    )}
                >
                    {choice.label}
                </button>
            ))}
        </div>
    );
}

function MoneyInput({ value, placeholder, onChange }: { value: number | string; placeholder?: string; onChange: (value: string) => void }) {
    return (
        <Input
            type="number"
            min={0}
            step="0.01"
            className="h-8 w-28 text-right"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

function SpecSelect({ label, value, options, onChange }: { label: string; value: string; options: SpecOption[]; onChange: (value: string) => void }) {
    // Keep a value that has since been removed from the catalog selectable.
    const choices = value && !options.some((option) => option.name === value) ? [{ name: value, price: 0 }, ...options] : options;

    return (
        <Field label={label}>
            <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}>
                <option value="">— Pilih —</option>
                {choices.map((option) => (
                    <option key={option.name} value={option.name}>
                        {option.name}
                        {option.price > 0 && ` (+${rm(option.price)}/helai)`}
                    </option>
                ))}
            </NativeSelect>
        </Field>
    );
}

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{label}</span>
            <span className="tabular-nums">{children}</span>
        </div>
    );
}
