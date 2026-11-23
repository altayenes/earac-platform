'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/common/Logo';
import { getRoleLabel } from '@/lib/statusLabels';
import {
  LayoutDashboard,
  KeyRound,
  Car,
  CalendarCheck2,
  Building2,
  BadgePercent,
  Users,
  UserCheck,
  ShieldAlert,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  visible: boolean;
}

export default function YonetimLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 1. Temel Oturum ve Müşteri Rolü Kontrolü (BULGU-FE-01)
  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace('/giris?redirect=/yonetim');
      } else if (user.role === 'CUSTOMER') {
        router.replace('/giris?redirect=/yonetim');
      }
    }
  }, [user, isLoading, router]);

  // 2. Alt Rota Bazlı Hassas Yetki Kontrolü (BULGU-FE-01 & BULGU-FE-03)
  useEffect(() => {
    if (isLoading || !user || user.role === 'CUSTOMER') return;

    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const perms = user.staffPermission;

    // Yalnızca SUPER_ADMIN erişebilen rotalar
    const superAdminOnlyRoutes = [
      '/yonetim/personel',
      '/yonetim/duzeltme-talepleri',
      '/yonetim/denetim',
    ];

    if (!isSuperAdmin) {
      // Süper yönetici rotasına girmeye çalışırsa
      if (superAdminOnlyRoutes.some((route) => pathname.startsWith(route))) {
        router.replace('/yonetim');
        return;
      }

      // Modül izin kontrolleri
      if (pathname.startsWith('/yonetim/araclar') && !perms?.canManageVehicles) {
        router.replace('/yonetim');
        return;
      }
      if (pathname.startsWith('/yonetim/subeler') && !perms?.canManageBranches) {
        router.replace('/yonetim');
        return;
      }
      if (pathname.startsWith('/yonetim/fiyatlar') && !perms?.canManagePricing) {
        router.replace('/yonetim');
        return;
      }
      if (
        (pathname.startsWith('/yonetim/teslimat') || pathname.startsWith('/yonetim/rezervasyonlar')) &&
        !perms?.canManageReservations
      ) {
        router.replace('/yonetim');
        return;
      }
    }
  }, [user, isLoading, pathname, router]);

  if (isLoading || !user || user.role === 'CUSTOMER') {
    return (
      <div className="min-h-screen bg-[#E5EBF2] flex items-center justify-center p-4">
        <div className="bg-[#F8FAFC] p-8 rounded-2xl shadow-md border border-[#CBD5E1] text-center max-w-sm w-full space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
          <p className="text-slate-800 font-medium">Yönetim yetkisi doğrulanıyor...</p>
        </div>
      </div>
    );
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const perms = user.staffPermission;

  // Aktif sayfa yetkisi kontrolü (Render koruması)
  const isSuperAdminOnlyPage =
    pathname.startsWith('/yonetim/personel') ||
    pathname.startsWith('/yonetim/duzeltme-talepleri') ||
    pathname.startsWith('/yonetim/denetim');

  const isVehiclesUnauthorized = pathname.startsWith('/yonetim/araclar') && !isSuperAdmin && !perms?.canManageVehicles;
  const isBranchesUnauthorized = pathname.startsWith('/yonetim/subeler') && !isSuperAdmin && !perms?.canManageBranches;
  const isPricingUnauthorized = pathname.startsWith('/yonetim/fiyatlar') && !isSuperAdmin && !perms?.canManagePricing;
  const isReservationsUnauthorized =
    (pathname.startsWith('/yonetim/teslimat') || pathname.startsWith('/yonetim/rezervasyonlar')) &&
    !isSuperAdmin &&
    !perms?.canManageReservations;

  if (
    (!isSuperAdmin && isSuperAdminOnlyPage) ||
    isVehiclesUnauthorized ||
    isBranchesUnauthorized ||
    isPricingUnauthorized ||
    isReservationsUnauthorized
  ) {
    return (
      <div className="min-h-screen bg-[#E5EBF2] flex items-center justify-center p-4">
        <div className="bg-[#F8FAFC] p-8 rounded-2xl shadow-md border border-[#CBD5E1] text-center max-w-sm w-full space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full border-4 border-amber-600 border-t-transparent animate-spin" />
          <p className="text-slate-800 font-medium">Bu sayfaya erişim yetkiniz bulunmuyor. Yönlendiriliyorsunuz...</p>
        </div>
      </div>
    );
  }

  const navItems: NavItem[] = [
    {
      label: 'Genel Bakış',
      href: '/yonetim',
      icon: LayoutDashboard,
      visible: true,
    },
    {
      label: 'Şube Teslim / İade',
      href: '/yonetim/teslimat',
      icon: KeyRound,
      visible: isSuperAdmin || !!perms?.canManageReservations,
    },
    {
      label: 'Filo & Katalog',
      href: '/yonetim/araclar',
      icon: Car,
      visible: isSuperAdmin || !!perms?.canManageVehicles,
    },
    {
      label: 'Rezervasyonlar',
      href: '/yonetim/rezervasyonlar',
      icon: CalendarCheck2,
      visible: isSuperAdmin || !!perms?.canManageReservations,
    },
    {
      label: 'Şubeler',
      href: '/yonetim/subeler',
      icon: Building2,
      visible: isSuperAdmin || !!perms?.canManageBranches,
    },
    {
      label: 'Fiyat Matrisi',
      href: '/yonetim/fiyatlar',
      icon: BadgePercent,
      visible: isSuperAdmin || !!perms?.canManagePricing,
    },
    {
      label: 'Personel Yönetimi',
      href: '/yonetim/personel',
      icon: Users,
      visible: isSuperAdmin,
    },
    {
      label: 'Kimlik Düzeltme',
      href: '/yonetim/duzeltme-talepleri',
      icon: UserCheck,
      visible: isSuperAdmin,
    },
    {
      label: 'Denetim Kayıtları',
      href: '/yonetim/denetim',
      icon: ShieldAlert,
      visible: isSuperAdmin,
    },
  ];

  const handleLogout = async () => {
    await logout();
    router.replace('/giris');
  };

  const navContent = (
    <div className="flex flex-col h-full justify-between">
      <div>
        {/* Logo Bölümü */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <Link href="/yonetim" className="block">
            <Logo size="md" variant="dark" />
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Kullanıcı Profili Rozeti */}
        <div className="p-4 mx-3 my-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-inner">
            {user.email.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="text-white font-medium text-sm truncate">{user.email}</p>
            <span
              className={`inline-block px-2 py-0.5 mt-0.5 text-[11px] font-semibold rounded ${
                isSuperAdmin
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }`}
            >
              {getRoleLabel(user.role)}
            </span>
          </div>
        </div>

        {/* Menü Linkleri */}
        <nav className="px-3 py-2 space-y-1">
          {navItems
            .filter((item) => item.visible)
            .map((item) => {
              const isActive =
                item.href === '/yonetim'
                  ? pathname === '/yonetim'
                  : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md font-semibold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-4 h-4 text-white/70" />}
                </Link>
              );
            })}
        </nav>
      </div>

      {/* Alt Çıkış & Müşteri Sitesi Bağlantısı */}
      <div className="p-4 border-t border-slate-800 space-y-2">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Müşteri Sitesini Gör</span>
        </Link>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span>Güvenli Çıkış</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#E5EBF2] flex">
      {/* Sabit Sol Kenar Çubuğu (Masaüstü: w-64) */}
      <aside className="hidden md:flex flex-col w-64 bg-[#0F172A] text-slate-200 shrink-0 sticky top-0 h-screen z-30 shadow-xl">
        {navContent}
      </aside>

      {/* Mobil Hamburger Çekmecesi */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex flex-col w-72 max-w-[80vw] bg-[#0F172A] text-slate-200 h-full shadow-2xl z-10">
            {navContent}
          </div>
        </div>
      )}

      {/* Ana Çalışma Alanı */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Üst Mobil Bar */}
        <header className="md:hidden sticky top-0 z-20 bg-[#0F172A] text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Logo size="sm" variant="dark" />
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
            {getRoleLabel(user.role)}
          </span>
        </header>

        {/* Sayfa İçeriği */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
