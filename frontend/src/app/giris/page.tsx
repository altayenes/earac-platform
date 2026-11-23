'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/common/Logo';
import { formatPhoneInput, toE164Phone, isValidTurkishPhone } from '@/lib/phoneUtils';
import { Lock, Phone, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';

function GirisContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  const { login } = useAuth();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!phone || !password) {
      setErrorMsg('Lütfen telefon numaranızı ve parolanızı giriniz.');
      return;
    }

    if (!isValidTurkishPhone(phone)) {
      setErrorMsg('Lütfen geçerli bir cep telefonu numarası giriniz (5XX XXX XX XX).');
      return;
    }

    setIsLoading(true);
    try {
      await login({ phone: toE164Phone(phone), password });
      router.push(redirect);
    } catch (err: any) {
      setErrorMsg(err.message || 'Giriş yapılamadı. Lütfen bilgilerinizi kontrol ediniz.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-160px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A]">
            Müşteri Girişi
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Rezervasyonlarınızı yönetmek ve hızlı kiralama yapmak için giriş yapın.
          </p>
        </div>

        <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl p-6 sm:p-8 shadow-md">
          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Telefon */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Cep Telefonu
              </label>
              <div className="relative flex items-center">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4" />
                </div>
                <span className="absolute left-10 text-sm font-semibold text-slate-500 pointer-events-none">
                  +90
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                  placeholder="5XX XXX XX XX"
                  className="w-full bg-white border border-[#CBD5E1] rounded-xl pl-20 pr-4 py-3 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-500">Sistemde kayıtlı cep telefonunuz</p>
            </div>

            {/* Parola */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Parola
                </label>
                <Link
                  href="/sifre-sifirla"
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                >
                  Şifremi Unuttum?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white border border-[#CBD5E1] rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs hover:shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Giriş Yap</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[#CBD5E1] text-center">
            <p className="text-sm text-slate-600">
              Henüz bir hesabınız yok mu?{' '}
              <Link
                href={`/kayit${redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
                className="text-blue-600 hover:text-blue-800 font-bold"
              >
                Hemen Kayıt Olun
              </Link>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>AES-256 Şifrelenmiş & KVKK Uyumlu Güvenli Giriş</span>
        </div>
      </div>
    </div>
  );
}

export default function GirisPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-500">Yükleniyor...</div>}>
      <GirisContent />
    </Suspense>
  );
}
