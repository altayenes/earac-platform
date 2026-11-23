'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Logo } from '@/components/common/Logo';
import { formatPhoneInput, toE164Phone, isValidTurkishPhone, isValidEmail } from '@/lib/phoneUtils';
import { Lock, Phone, Mail, ArrowRight, AlertCircle, ShieldCheck, KeyRound, CheckCircle2 } from 'lucide-react';

function KayitContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/hesabim';
  const { register } = useAuth();

  const [step, setStep] = useState<'DETAILS' | 'SMS_VERIFY'>('DETAILS');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [smsCode, setSmsCode] = useState('');

  const [countdown, setCountdown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  // Geri sayım sayacı
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // SMS Gönderme Adımı
  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    if (!phone) {
      setErrorMsg('Lütfen geçerli bir telefon numarası giriniz.');
      return;
    }
    if (!isValidTurkishPhone(phone)) {
      setErrorMsg('Lütfen geçerli bir cep telefonu numarası giriniz (5XX XXX XX XX).');
      return;
    }
    if (!email || !isValidEmail(email)) {
      setErrorMsg('Lütfen geçerli bir e-posta adresi giriniz (ör. ornek@domain.com).');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('Parola en az 8 karakter uzunluğunda olmalıdır.');
      return;
    }
    if (password !== passwordConfirm) {
      setErrorMsg('Girdiğiniz parolalar eşleşmiyor.');
      return;
    }

    setIsLoading(true);
    try {
      await api.auth.sendSms({ phone: toE164Phone(phone), purpose: 'REGISTER' });
      setStep('SMS_VERIFY');
      setCountdown(60);
      setInfoMsg(`Doğrulama kodu ${toE164Phone(phone)} numarasına SMS ile gönderildi (Simülasyon Kodu: 123456).`);
    } catch (err: any) {
      setErrorMsg(err.message || 'SMS kodu gönderilemedi. Lütfen tekrar deneyiniz.');
    } finally {
      setIsLoading(false);
    }
  };

  // Tekrar SMS Kodu İste
  const handleResendSms = async () => {
    if (countdown > 0) return;
    setErrorMsg('');
    try {
      await api.auth.sendSms({ phone: toE164Phone(phone), purpose: 'REGISTER' });
      setCountdown(60);
      setInfoMsg('Yeni doğrulama kodu gönderildi.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Kod gönderilemedi.');
    }
  };

  // Kayıt ve Doğrulama
  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!smsCode || smsCode.length < 4) {
      setErrorMsg('Lütfen 6 haneli SMS doğrulama kodunu giriniz.');
      return;
    }

    setIsLoading(true);
    try {
      await register({
        phone: toE164Phone(phone),
        password,
        email: email.trim(),
        smsCode,
        smsVerificationCode: smsCode,
      });

      router.push(redirect);
    } catch (err: any) {
      setErrorMsg(err.message || 'Kayıt işlemi tamamlanamadı. SMS kodunu kontrol ediniz.');
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
            Yeni Müşteri Hesabı
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Hemen kayıt olun, şeffaf ve avantajlı araç kiralama deneyimine başlayın.
          </p>
        </div>

        <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl p-6 sm:p-8 shadow-md">
          {errorMsg && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div className="mb-5 p-3.5 bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-xl flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-600" />
              <span>{infoMsg}</span>
            </div>
          )}

          {step === 'DETAILS' ? (
            <form onSubmit={handleSendSms} className="space-y-4">
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
              </div>

              {/* E-posta */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  E-posta Adresi
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@domain.com"
                    className="w-full bg-white border border-[#CBD5E1] rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
              </div>

              {/* Parola */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Parola
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="En az 8 karakter"
                    className="w-full bg-white border border-[#CBD5E1] rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
              </div>

              {/* Parola Tekrar */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Parola Tekrar
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Parolanızı tekrar giriniz"
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
                  <>
                    <span>Devam Et: SMS Doğrulama</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleCompleteRegistration} className="space-y-5">
              <div className="text-center pb-2">
                <KeyRound className="w-10 h-10 text-blue-600 mx-auto mb-2" />
                <h3 className="font-bold text-slate-800 text-base">SMS Doğrulama Kodu</h3>
                <p className="text-xs text-slate-500 mt-1">
                  <strong>{toE164Phone(phone)}</strong> numarasına gönderilen 6 haneli kodu giriniz.
                </p>
              </div>

              <div className="space-y-1.5">
                <input
                  type="text"
                  maxLength={6}
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value)}
                  placeholder="123456"
                  className="w-full bg-white border-2 border-[#CBD5E1] focus:border-blue-600 rounded-xl px-4 py-3.5 text-center text-2xl font-bold tracking-widest text-slate-900 focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Kod gelmedi mi?</span>
                {countdown > 0 ? (
                  <span className="font-semibold text-blue-600">Tekrar gönder ({countdown} sn)</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendSms}
                    className="font-bold text-blue-600 hover:underline"
                  >
                    Tekrar Kod Gönder
                  </button>
                )}
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs hover:shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Doğrula ve Kaydı Tamamla</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setStep('DETAILS')}
                  className="w-full py-2 text-xs font-bold text-slate-600 hover:text-slate-900 text-center"
                >
                  Telefon Numarasını Değiştir
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-[#CBD5E1] text-center">
            <p className="text-sm text-slate-600">
              Zaten bir hesabınız var mı?{' '}
              <Link
                href={`/giris${redirect !== '/hesabim' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
                className="text-blue-600 hover:text-blue-800 font-bold"
              >
                Giriş Yapın
              </Link>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>KVKK Güvenceli Müşteri Hesabı & Hızlı Rezervasyon</span>
        </div>
      </div>
    </div>
  );
}

export default function KayitPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-500">Yükleniyor...</div>}>
      <KayitContent />
    </Suspense>
  );
}
