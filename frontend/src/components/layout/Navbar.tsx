'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/common/Logo';
import {
  Menu,
  X,
  User as UserIcon,
  CalendarCheck,
  LogOut,
  ShieldCheck,
  ChevronRight,
  Car,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Yönetim paneli rotalarında genel müşteri navbar'ı render edilmez
  if (pathname?.startsWith('/yonetim')) {
    return null;
  }

  const navLinks = [
    { label: 'Müsait Araçlar', href: '/araclar' },
    { label: 'Nasıl Çalışır?', href: '/#nasil-calisir' },
    { label: 'Segment Kuralları', href: '/#kurallar' },
    { label: 'SSS', href: '/#sss' },
  ];

  const handleLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-[#F8FAFC]/95 backdrop-blur-md border-b border-[#CBD5E1] shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Sol: Logo */}
          <div className="flex items-center">
            <Logo size="md" />
          </div>

          {/* Orta: Masaüstü Gezinme */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-blue-600 bg-blue-50 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Sağ: Kullanıcı Aksiyonları */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/rezervasyonlarim"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <CalendarCheck className="w-4 h-4 text-blue-600" />
                  <span>Rezervasyonlarım</span>
                </Link>

                <Link
                  href="/hesabim"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:border-blue-400 hover:bg-blue-50/40 text-slate-800 text-sm font-medium transition-all shadow-2xs"
                >
                  <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                    {user.customerProfile?.firstName
                      ? user.customerProfile.firstName.charAt(0).toUpperCase()
                      : <UserIcon className="w-3.5 h-3.5" />}
                  </div>
                  <span className="max-w-[120px] truncate">
                    {user.customerProfile?.firstName
                      ? `${user.customerProfile.firstName} ${user.customerProfile.lastName}`
                      : user.phone}
                  </span>
                  {user.customerProfile && (
                    <span title="Kimlik Doğrulandı" className="inline-flex">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    </span>
                  )}
                </Link>

                <button
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Güvenli Çıkış"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <Link
                  href="/giris"
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  Giriş Yap
                </Link>
                <Link
                  href="/kayit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-xs hover:shadow-sm active:scale-98"
                >
                  <Car className="w-4 h-4" />
                  <span>Kayıt Ol</span>
                </Link>
              </div>
            )}
          </div>

          {/* Mobil Menü Butonu */}
          <div className="flex md:hidden items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Menüyü aç/kapat"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobil Açılır Menü */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#CBD5E1] bg-[#F8FAFC] px-4 pt-3 pb-6 space-y-3">
          <nav className="flex flex-col space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg text-base font-medium text-slate-700 hover:bg-slate-200/60"
              >
                <span>{link.label}</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>
            ))}
          </nav>

          <div className="pt-3 border-t border-[#CBD5E1]">
            {isAuthenticated && user ? (
              <div className="space-y-2">
                <Link
                  href="/rezervasyonlarim"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-base font-medium text-slate-800 hover:bg-slate-200/60"
                >
                  <CalendarCheck className="w-5 h-5 text-blue-600" />
                  <span>Rezervasyonlarım</span>
                </Link>

                <Link
                  href="/hesabim"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-base font-medium text-slate-800 hover:bg-slate-200/60"
                >
                  <UserIcon className="w-5 h-5 text-slate-700" />
                  <span>Hesabım & Profil ({user.customerProfile?.firstName || user.phone})</span>
                </Link>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-base font-medium text-rose-600 hover:bg-rose-50"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Güvenli Çıkış Yap</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Link
                  href="/giris"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-2.5 px-4 rounded-lg font-semibold text-slate-700 bg-slate-200/60 hover:bg-slate-200"
                >
                  Giriş Yap
                </Link>
                <Link
                  href="/kayit"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-2.5 px-4 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700"
                >
                  Kayıt Ol
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
