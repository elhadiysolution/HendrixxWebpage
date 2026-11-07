import { LucideIcon } from 'lucide-react';

export interface Auth {
    user: User;
    is_admin: boolean;
}

export type StageValue = 'order' | 'design' | 'jobsheet' | 'production' | 'postage' | 'completed';

export interface StageOption {
    value: StageValue;
    label: string;
}

export interface OrderSummary {
    id: number;
    order_no: string;
    title: string;
    customer: string | null;
    organization: string | null;
    agent: string | null;
    stage: StageValue;
    stage_label: string;
    quantity: number;
    total: number;
    paid: number;
    days_in_stage: number;
    target_days: number;
    is_late: boolean;
    is_at_risk: boolean;
    due_date: string | null;
    required_by: string | null;
    projected_ship_date: string | null;
    cancelled: boolean;
    purge_at: string | null;
    created_at: string | null;
}

export interface Paginated<T> {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    links: { url: string | null; label: string; active: boolean }[];
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export interface NavItem {
    title: string;
    url: string;
    icon?: LucideIcon | null;
    isActive?: boolean;
    /** Sub-menu; the item then acts as an expandable group. */
    items?: NavItem[];
}

export interface SharedData {
    name: string;
    quote: { message: string; author: string };
    auth: Auth;
    flash: { success: string | null };
    [key: string]: unknown;
}

export interface User {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown; // This allows for additional properties...
}
