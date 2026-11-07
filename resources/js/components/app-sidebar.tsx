import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavItem, type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import {
    ArchiveRestore,
    ArrowLeftRight,
    Banknote,
    ChartColumn,
    ClipboardList,
    Globe,
    Handshake,
    Inbox,
    Layers,
    LayoutGrid,
    Package,
    PackagePlus,
    PlusCircle,
    Settings,
    SlidersHorizontal,
    Tags,
    Target,
    Users,
} from 'lucide-react';
import AppLogo from './app-logo';

const footerNavItems: NavItem[] = [
    {
        title: 'Sales Page',
        url: '/',
        icon: Globe,
    },
];

export function AppSidebar() {
    const { auth } = usePage<SharedData>().props;

    const mainNavItems: NavItem[] = [
        { title: 'Dashboard', url: '/dashboard', icon: LayoutGrid },
        { title: 'Order Board', url: '/orders', icon: ClipboardList },
        { title: 'Order Baru', url: '/orders/create', icon: PlusCircle },
        { title: 'Inquiry', url: '/inquiries', icon: Inbox },
        { title: 'Order dibatalkan', url: '/orders?view=list&status=cancelled', icon: ArchiveRestore },
    ];

    const financeNavItems: NavItem[] = [
        { title: 'Laporan', url: '/finance', icon: ChartColumn },
        { title: 'Cash In / Out', url: '/finance/cash', icon: ArrowLeftRight },
        { title: 'Gaji', url: '/finance/payroll', icon: Banknote },
        { title: 'Target & Forecast', url: '/finance/targets', icon: Target },
    ];

    const adminNavItems: NavItem[] = [
        {
            title: 'Product Setting',
            url: '/admin/catalog/materials',
            icon: Package,
            items: [
                { title: 'Material', url: '/admin/catalog/materials', icon: Layers },
                { title: 'Pricelist', url: '/admin/catalog/pricelist', icon: Tags },
                { title: 'Add-on', url: '/admin/catalog/addons', icon: PackagePlus },
                { title: 'Spesifikasi', url: '/admin/catalog/options', icon: SlidersHorizontal },
            ],
        },
        { title: 'Ejen', url: '/admin/catalog/agents', icon: Handshake },
        { title: 'Staf', url: '/users', icon: Users },
        { title: 'Tetapan & Google Sheet', url: '/admin/settings', icon: Settings },
    ];

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/dashboard" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
                {auth.is_admin && <NavMain items={financeNavItems} label="Kewangan" />}
                {auth.is_admin && <NavMain items={adminNavItems} label="Tetapan Admin" />}
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
