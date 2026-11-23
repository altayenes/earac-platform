'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Logo } from '@/components/common/Logo';
import { formatPhoneInput, toE164Phone, isValidTurkishPhone } from '@/lib/phoneUtils';
import { Lock, Phone, ArrowRight, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';

export default function SifreSifirlaPage() {
  const router = useRouter();
  const [step, setStep] = useState<'REQUEST' | 'VERIFY'>('REQUEST');
  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

  const [countdown, setCountdown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!phone) {
      setErrorMsg('Lütfen kayıtlı telefon numaranızı giriniz.');
      return;
    }
    if (!isValidTurkishPhone(phone)) {
      setErrorMsg('Lütfen geçerli bir cep telefonu numarası giriniz (5XX XXX XX XX).');
      return;
    }

    setIsLoading(true);
    try {
      await api.auth.sendSms({ phone: toE164Phone(phone), purpose: 'PASSWORD_RESET' });
      setStep('VERIFY');
      setCountdown(60);
      setSuccessMsg(`Şifre sıfırlama kodu ${toE164Phone(phone)} numarasına gönderildi (Simülasyon: 123456).`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Kod gönderilemedi. Lütfen tekrar deneyiniz.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!smsCode) {
      setErrorMsg('Lütfen SMS doğrulama kodunu giriniz.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg('Yeni parola en az 8 karakter olmalıdır.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setErrorMsg('Parolalar eşleşmiyor.');
      return;
    }

    setIsLoading(true);
    try {
      await api.auth.resetPassword({
        phone: toE164Phone(phone),
        smsCode,
        smsVerificationCode: smsCode,
        newPassword,
      });

      alert('Parolanız başarıyla güncellendi! Yeni parolanızla giriş yapabilirsiniz.');
      router.push('/giris');
    } catch (err: any) {
      setErrorMsg(err.message || 'Parola sıfırlanamadı.');
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
            Şifremi Unuttum
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Telefonunuza gelecek SMS doğrulama kodu ile yeni parolanızı belirleyin.
          </p>
        </div>

        <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl p-6 sm:p-8 shadow-md">
          {errorMsg && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {step === 'REQUEST' ? (
            <form onSubmit={handleSendCode} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Kayıtlı Cep Telefonu
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
                    <span>Doğrulama Kodu Gönder</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="text-center pb-1">
                <KeyRound className="w-8 h-8 text-blue-600 mx-auto mb-1" />
                <h3 className="font-bold text-slate-800 text-sm">SMS Kodunu Giriniz</h3>
              </div>

              <div className="space-y-1.5">
                <input
                  type="text"
                  maxLength={6}
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value)}
                  placeholder="123456"
                  className="w-full bg-white border-2 border-[#CBD5E1] focus:border-blue-600 rounded-xl px-4 py-3 text-center text-xl font-bold tracking-widest text-slate-900 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Yeni Parola
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="En az 8 karakter"
                    className="w-full bg-white border border-[#CBD5E1] rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Yeni Parola Tekrar
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    placeholder="Yeni parolanızı tekrar giriniz"
                    className="w-full bg-white border border-[#CBD5E1] rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs hover:shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Yeni Parolayı Kaydet</span>
                )}
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-[#CBD5E1] text-center">
            <Link href="/giris" className="text-sm text-blue-600 hover:text-blue-800 font-bold">
              Giriş Ekranına Dön
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
