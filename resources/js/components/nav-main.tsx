import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';

/**
 * A link with a query string (e.g. "/orders?status=cancelled") is active when the page has
 * those params; a plain link is active on its path unless a more specific query link matches.
 */
function useActive(items: NavItem[]) {
    const page = usePage();
    const [path, query = ''] = page.url.split('?');
    const params = new URLSearchParams(query);
    const flat = items.flatMap((item) => [item, ...(item.items ?? [])]);

    const matchesQuery = (url: string) => {
        const [itemPath, itemQuery] = url.split('?');
        return itemPath === path && [...new URLSearchParams(itemQuery).entries()].every(([key, value]) => params.get(key) === value);
    };
    const queryMatch = flat.some((item) => item.url.includes('?') && matchesQuery(item.url));

    return (url: string) => (url.includes('?') ? matchesQuery(url) : url === path && !queryMatch);
}

export function NavMain({ items = [], label = 'Operasi' }: { items: NavItem[]; label?: string }) {
    const isActive = useActive(items);
    const { state, isMobile } = useSidebar();

    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel>{label}</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => {
                    if (!item.items?.length) {
                        return (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                                    <Link href={item.url} prefetch>
                                        {item.icon && <item.icon />}
                                        <span>{item.title}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        );
                    }

                    const childActive = item.items.some((child) => isActive(child.url));

                    // Icon-only sidebar has no room for a sub-menu: the group jumps to its first page.
                    if (state === 'collapsed' && !isMobile) {
                        return (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton asChild isActive={childActive} tooltip={item.title}>
                                    <Link href={item.items[0].url} prefetch>
                                        {item.icon && <item.icon />}
                                        <span>{item.title}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        );
                    }

                    return (
                        <Collapsible key={item.title} asChild defaultOpen={childActive} className="group/collapsible">
                            <SidebarMenuItem>
                                <CollapsibleTrigger asChild>
                                    <SidebarMenuButton tooltip={item.title}>
                                        {item.icon && <item.icon />}
                                        <span>{item.title}</span>
                                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                    </SidebarMenuButton>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <SidebarMenuSub>
                                        {item.items.map((child) => (
                                            <SidebarMenuSubItem key={child.title}>
                                                <SidebarMenuSubButton asChild isActive={isActive(child.url)}>
                                                    <Link href={child.url} prefetch>
                                                        {child.icon && <child.icon />}
                                                        <span>{child.title}</span>
                                                    </Link>
                                                </SidebarMenuSubButton>
                                            </SidebarMenuSubItem>
                                        ))}
                                    </SidebarMenuSub>
                                </CollapsibleContent>
                            </SidebarMenuItem>
                        </Collapsible>
                    );
                })}
            </SidebarMenu>
        </SidebarGroup>
    );
}
