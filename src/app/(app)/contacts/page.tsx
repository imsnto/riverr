// src/app/(app)/contacts/page.tsx
'use client';
import Dashboard from '@/components/dashboard/dashboard';
import { SidebarProvider } from '@/components/ui/sidebar';

export default function ContactsPage() {
  return (
    <SidebarProvider>
      <Dashboard view="contacts" />
    </SidebarProvider>
  );
}
