'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Code2,
  Database,
  FileText,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Newspaper,
  X,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import { useNotificationStore } from '@/store/notificationStore';
import { apiFetch } from '@/utils/api';
import OceanBackground from '@/components/OceanBackground';

interface UserData {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'general';
}

interface NavLinkItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [logoFailed, setLogoFailed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const navLinks: NavLinkItem[] = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/data-manager', label: 'Data Hub', icon: Database },
    { href: '/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/news', label: 'News', icon: Newspaper },
    { href: '/reports', label: 'Reports', icon: FileText },
    { href: '/research-copilot', label: 'Research Copilot', icon: Code2 },
    { href: '/forecast-intelligence', label: 'Forecast Intelligence', icon: BarChart3 },
    { href: '/event-detection', label: 'Event Detection', icon: FileText },
    { href: '/digital-twin', label: 'Digital Twin', icon: Database },
    { href: '/scientific-report', label: 'Scientific Report', icon: LayoutDashboard },
  ];

  if (isAuthenticated && userData?.role === 'admin') {
    navLinks.push({ href: '/api-hub', label: 'API', icon: Code2 });
  }

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.add('has-app-navbar');
    return () => {
      document.body.classList.remove('has-app-navbar');
    };
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const tokenMatch = document.cookie
          .split('; ')
          .find((row) => row.startsWith('nerexis_auth_token='));
        const token = tokenMatch ? tokenMatch.split('=')[1] : '';

        if (!token) {
          setIsAuthenticated(false);
          setUserData(null);
          setIsLoading(false);
          return;
        }

        const response = await apiFetch('/auth/me', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setUserData(data.user);
          setIsAuthenticated(true);
          document.cookie = `nerexis_user_role=${encodeURIComponent(data.user.role || 'general')}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        } else {
          setIsAuthenticated(false);
          setUserData(null);
          document.cookie = 'nerexis_auth_token=; Path=/; Max-Age=0; SameSite=Lax';
          document.cookie = 'nerexis_user_email=; Path=/; Max-Age=0; SameSite=Lax';
          document.cookie = 'nerexis_user_role=; Path=/; Max-Age=0; SameSite=Lax';
        }
      } catch {
        setIsAuthenticated(false);
        setUserData(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    const criticalRoutes = ['/', '/dashboard', '/analytics', '/data-manager', '/news', '/reports'];
    criticalRoutes.forEach((route) => {
      router.prefetch(route);
    });
  }, [router]);

  const isActive = (href: string) => pathname === href;

  const handleSignOut = async () => {
    const userName = userData?.name || 'User';

    const tokenMatch = document.cookie
      .split('; ')
      .find((row) => row.startsWith('oceanet_auth_token='));
    const token = tokenMatch ? tokenMatch.split('=')[1] : '';

    if (token) {
      try {
        await apiFetch('/auth/signout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
      }
    }

    document.cookie = 'nerexis_auth_token=; Path=/; Max-Age=0; SameSite=Lax';
    document.cookie = 'nerexis_user_email=; Path=/; Max-Age=0; SameSite=Lax';
    document.cookie = 'nerexis_user_role=; Path=/; Max-Age=0; SameSite=Lax';

    addNotification({
      message: `Goodbye ${userName}! You've been signed out.`,
      type: 'info',
      duration: 3000,
    });

    setTimeout(() => {
      router.push('/sign-in');
      router.refresh();
    }, 500);
  };

  return (
    <nav className="fixed top-0 left-0 z-50 w-full overflow-hidden border-b border-gray-800/60 bg-gray-950 md:h-screen md:w-64 md:border-b-0 md:border-r md:shadow-[2px_0_32px_rgba(0,0,0,0.6)]">
      <OceanBackground className="opacity-90" />
      <div className="relative z-10 flex h-[72px] px-4 py-3 md:h-full md:flex-col md:justify-between md:py-6">
        <div className="flex-1">
          <div className="flex items-center justify-between md:mb-8 md:justify-start">
            <Link href="/" className="block group">
              {!logoFailed ? (
                <div className="px-1 py-1 transition-all duration-300 group-hover:scale-[1.02]">
                  <img
                    src="/assets/nerexis-logo.png"
                    alt="Nerexis"
                        className="h-16 w-auto max-w-[260px] object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.45)] md:h-24 md:max-w-[300px]"
                    onError={() => setLogoFailed(true)}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 px-1">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500 text-sm font-bold text-white">
                    N
                  </div>
                  <span className="text-lg font-bold tracking-wide text-white">Nerexis</span>
                </div>
              )}
            </Link>

            <button
              onClick={() => setIsOpen(!isOpen)}
              className="rounded-lg p-2 text-white transition-all duration-300 hover:bg-white/10 md:hidden"
              suppressHydrationWarning
            >
              {isMounted && isOpen ? <X size={22} suppressHydrationWarning /> : <Menu size={22} suppressHydrationWarning />}
            </button>
          </div>

          <div className={`${isOpen ? 'block' : 'hidden'} mt-4 max-h-[calc(100vh-140px)] overflow-y-auto space-y-2 pr-1 md:mt-0 md:block md:max-h-none md:overflow-visible`}>
            {navLinks.map((link, idx) => {
              const active = isActive(link.href);
              const Icon = link.icon;

              return (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Link
                    href={link.href}
                    prefetch
                    className={`flex items-center gap-3 rounded-lg border-l-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                      active
                        ? 'border-cyan-400 text-white'
                        : 'border-transparent text-gray-400 hover:border-white/20 hover:bg-white/[0.07] hover:text-gray-100'
                    }`}
                    style={active ? { backgroundColor: 'rgba(6,182,212,0.12)' } : undefined}
                    onClick={() => setIsOpen(false)}
                  >
                    <Icon size={16} className={active ? 'flex-shrink-0 text-cyan-400' : 'flex-shrink-0 text-gray-500'} />
                    <span>{link.label}</span>
                    {active ? <span className="ml-auto h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-400" /> : null}
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="hidden flex-col gap-3 border-t border-gray-800/80 pt-4 md:flex">
          <div className="rounded-xl border border-white/10 bg-gray-950/78 p-1.5 shadow-[0_12px_26px_rgba(0,0,0,0.45)]">
          {isLoading ? (
            <div className="h-14 rounded-lg border border-white/15 bg-gray-900/80 animate-pulse" />
          ) : isAuthenticated && userData ? (
            <>
              <div className="flex items-center gap-2.5 rounded-xl border border-white/20 bg-gray-900/82 px-2.5 py-2 shadow-[0_10px_28px_rgba(0,0,0,0.35)]">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-[11px] font-bold text-white">
                  {userData.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold leading-tight text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">{userData.name}</p>
                  <p className="text-[11px] leading-tight text-gray-200">
                    {userData.role === 'admin' ? 'Administrator' : 'General User'}
                  </p>
                </div>
              </div>
              <motion.button
                className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-gray-900/78 px-3.5 py-1.5 text-[13px] font-semibold text-white transition-all duration-200 hover:border-red-400/70 hover:bg-red-600/25 hover:text-white"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSignOut}
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </motion.button>
            </>
          ) : (
            <motion.button
              className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all duration-200 hover:from-cyan-400 hover:to-blue-500"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push('/sign-in')}
            >
              Sign In
            </motion.button>
          )}
          </div>
        </div>
      </div>
    </nav>
  );
}
