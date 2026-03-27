'use client';

import MenuPage from '@/app/menu/[companyId]/page';

export default function WaiterDashboardPage() {
    // We simply render the customer MenuPage, but because it's wrapped
    // in WaiterDashboardLayout, it injects the WaiterCartSheet instead of the customer CartSheet!
    return <MenuPage />;
}
