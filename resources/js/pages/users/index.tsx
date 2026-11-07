import { confirmDialog } from '@/components/confirm-dialog';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import { FormEvent } from 'react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Staf', href: '/users' }];

interface Props {
    users: { id: number; name: string; email: string; role: string }[];
    roles: Record<string, string>;
}

export default function UsersIndex({ users, roles }: Props) {
    const { auth } = usePage<SharedData>().props;
    const form = useForm({ name: '', email: '', role: 'sales', password: '' });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post('/users', { preserveScroll: true, onSuccess: () => form.reset() });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Staf" />
            <div className="grid flex-1 gap-4 p-4 md:p-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Akaun staf</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-muted-foreground border-b text-left text-xs">
                                    <th className="py-2 font-medium">Nama</th>
                                    <th className="py-2 font-medium">Email</th>
                                    <th className="py-2 font-medium">Role</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <tr key={user.id} className="border-b last:border-0">
                                        <td className="py-2">{user.name}</td>
                                        <td className="py-2">{user.email}</td>
                                        <td className="py-2">
                                            <NativeSelect
                                                className="h-8 w-36"
                                                value={user.role}
                                                onChange={(e) =>
                                                    router.patch(`/users/${user.id}`, { role: e.target.value }, { preserveScroll: true })
                                                }
                                            >
                                                {Object.entries(roles).map(([value, label]) => (
                                                    <option key={value} value={value}>
                                                        {label}
                                                    </option>
                                                ))}
                                            </NativeSelect>
                                        </td>
                                        <td className="py-2 text-right">
                                            {user.id !== auth.user.id && (
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={async () => {
                                                        const ok = await confirmDialog({
                                                            title: `Padam akaun ${user.name}?`,
                                                            confirmLabel: 'Padam',
                                                            destructive: true,
                                                        });
                                                        if (ok !== false) router.delete(`/users/${user.id}`, { preserveScroll: true });
                                                    }}
                                                    aria-label="Padam"
                                                >
                                                    <Trash2 className="text-red-600" />
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>

                <Card className="self-start">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Tambah staf</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={submit} className="grid gap-3">
                            <div className="grid gap-1.5">
                                <Label>Nama</Label>
                                <Input value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} required />
                                <InputError message={form.errors.name} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label>Email</Label>
                                <Input type="email" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} required />
                                <InputError message={form.errors.email} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label>Role</Label>
                                <NativeSelect value={form.data.role} onChange={(e) => form.setData('role', e.target.value)}>
                                    {Object.entries(roles).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </NativeSelect>
                            </div>
                            <div className="grid gap-1.5">
                                <Label>Kata laluan sementara</Label>
                                <Input type="text" value={form.data.password} onChange={(e) => form.setData('password', e.target.value)} required />
                                <InputError message={form.errors.password} />
                            </div>
                            <Button disabled={form.processing}>Tambah</Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
