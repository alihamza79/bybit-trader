import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { Navbar } from '@/components/features/Navbar';
import { ProxyStatusProvider } from '@/components/ProxyStatusProvider';

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): Promise<React.JSX.Element> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen">
      <Navbar userEmail={user.email ?? ''} />
      <ProxyStatusProvider>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </ProxyStatusProvider>
    </div>
  );
}
