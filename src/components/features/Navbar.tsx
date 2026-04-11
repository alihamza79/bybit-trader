'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { BarChart3, Wallet, Zap, TrendingUp, ClipboardList } from 'lucide-react';

type NavbarProps = {
  userEmail: string;
};

const navItems = [
  { href: '/trade', label: 'Trade', icon: Zap },
  { href: '/positions', label: 'Positions', icon: TrendingUp },
  { href: '/orders', label: 'Orders', icon: ClipboardList },
  { href: '/accounts', label: 'Accounts', icon: Wallet },
  { href: '/logs', label: 'Logs', icon: BarChart3 },
] as const;

export function Navbar({ userEmail }: NavbarProps): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut(): Promise<void> {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <nav className="border-b border-card-border bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/trade" className="text-lg font-bold text-primary">
            Bybit Executor
          </Link>

          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">{userEmail}</span>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
      </div>
    </nav>
  );
}
