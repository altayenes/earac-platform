'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  User as UserIcon,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Mail,
  Phone,
  Calendar,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
  Trash2,
} from 'lucide-react';

export default function HesabimPage() {
  const router = useRouter();
  const { user, refreshUser, isAuthenticated, isLoading: authLoading, logout } = useAuth();

  // KYC Form Durumu
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [licenseDate, setLicenseDate] = useState('');
  const [isSubmittingKyc, setIsSubmittingKyc] = useState(false);
  const [kycError, setKycError] = useState('');
  const [kycSuccess, setKycSuccess] = useState('');

  // E-posta güncelleme
  const [emailInput, setEmailInput] = useState('');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');

  // Modallar
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [phoneSmsCode, setPhoneSmsCode] = useState('');
  const [phoneStep, setPhoneStep] = useState<'ENTER' | 'VERIFY'>('ENTER');
  const [phoneModalError, setPhoneModalError] = useState('');
  const [phoneModalSuccess, setPhoneModalSuccess] = useState('');

  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [corrFirstName, setCorrFirstName] = useState('');
  const [corrLastName, setCorrLastName] = useState('');
  const [corrNationalId, setCorrNationalId] = useState('');
  const [corrBirthDate, setCorrBirthDate] = useState('');
  const [corrLicenseDate, setCorrLicenseDate] = useState('');
  const [corrReason, setCorrReason] = useState('');
  const [corrError, setCorrError] = useState('');
  const [corrSuccess, setCorrSuccess] = useState('');

  const [closeAccountModalOpen, setCloseAccountModalOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [closeError, setCloseError] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/giris?redirect=/hesabim');
    }
    if (user?.email) {
      setEmailInput(user.email);
    }
  }, [authLoading, isAuthenticated, router, user]);

  if (authLoading || !user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600 text-sm">Hesap bilgileri yükleniyor...</p>
      </div>
    );
  }

  const profile = user.customerProfile;

  // KYC Profil Oluşturma
  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setKycError('');
    setKycSuccess('');

    if (nationalId.length !== 11) {
      setKycError('T.C. Kimlik Numarası tam 11 haneli olmalıdır.');
      return;
    }

    setIsSubmittingKyc(true);
    try {
      await api.users.createProfile({
        firstName,
        lastName,
        nationalId,
        birthDate,
        licenseDate,
      });
      await refreshUser();
      setKycSuccess('KYC Kimlik profiliniz başarıyla oluşturuldu ve doğrulandı!');
    } catch (err: any) {
      setKycError(err.message || 'Profil oluşturulamadı.');
    } finally {
      setIsSubmittingKyc(false);
    }
  };

  // E-posta Güncelleme & Doğrulama İsteği
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailMsg('');
    setIsUpdatingEmail(true);
    try {
      await api.users.verifyEmail({ email: emailInput });
      setEmailMsg('E-posta doğrulama bağlantısı adresinize gönderildi.');
      await refreshUser();
    } catch (err: any) {
      setEmailMsg(err.message || 'E-posta güncellenemedi.');
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  // Telefon Güncelleme: SMS Gönder
  const handleSendPhoneSms = async () => {
    setPhoneModalError('');
    setPhoneModalSuccess('');
    try {
      await api.auth.sendSms({ phone: newPhone, purpose: 'PHONE_UPDATE' });
      setPhoneStep('VERIFY');
      setPhoneModalSuccess('Yeni telefonunuza onay SMS kodu iletildi (Simülasyon: 123456).');
    } catch (err: any) {
      setPhoneModalError(err.message || 'Kod gönderilemedi.');
    }
  };

  // Telefon Güncelleme: Onayla
  const handleConfirmPhoneChange = async () => {
    setPhoneModalError('');
    try {
      await api.users.changePhone({
        newPhone,
        smsVerificationCode: phoneSmsCode,
      });
      alert('Telefon numaranız başarıyla güncellendi!');
      setPhoneModalOpen(false);
      await refreshUser();
    } catch (err: any) {
      setPhoneModalError(err.message || 'Numara güncellenemedi.');
    }
  };

  // Düzeltme Talebi Gönder
  const handleSendCorrectionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setCorrError('');
    setCorrSuccess('');

    if (!corrReason) {
      setCorrError('Lütfen düzeltme talebinizin resmi gerekçesini açıklayınız.');
      return;
    }

    try {
      await api.users.createCorrectionRequest({
        requestedFirstName: corrFirstName || undefined,
        requestedLastName: corrLastName || undefined,
        requestedNationalId: corrNationalId || undefined,
        requestedBirthDate: corrBirthDate || undefined,
        requestedLicenseDate: corrLicenseDate || undefined,
        reason: corrReason,
      });
      setCorrSuccess('Resmi düzeltme talebiniz müşteri hizmetleri yöneticisine iletildi.');
      setTimeout(() => setCorrectionModalOpen(false), 2500);
    } catch (err: any) {
      setCorrError(err.message || 'Talep iletilemedi.');
    }
  };

  // Hesabı Kapat
  const handleCloseAccount = async () => {
    setCloseError('');
    if (!closeReason) {
      setCloseError('Lütfen ayrılma gerekçenizi belirtiniz.');
      return;
    }

    try {
      await api.users.closeAccount(closeReason);
      alert('Hesabınız kapatılmıştır. Güvenliğiniz için oturumunuz sonlandırılıyor.');
      await logout();
      router.push('/');
    } catch (err: any) {
      setCloseError(err.message || 'Hesap kapatılamadı. Aktif rezervasyonunuz olabilir.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Üst Başlık & Kullanıcı Özeti */}
      <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center font-black text-xl shadow-md">
            {profile?.firstName ? profile.firstName.charAt(0).toUpperCase() : <UserIcon className="w-7 h-7" />}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#0F172A]">
              {profile ? `${profile.firstName} ${profile.lastName}` : 'Kullanıcı Hesabı'}
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">{user.phone}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {profile ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>KYC Kimlik Onaylı</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Profil Tamamlanmadı</span>
            </span>
          )}
        </div>
      </div>

      {/* KYC PROFİL ALANI */}
      <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#CBD5E1] gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <span>Resmi Kimlik & Sürücü Bilgileri (KYC)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Kiralama sözleşmesi ve sigorta uygunluğu için doğrulanmış yasal kimlik bilgileri.
            </p>
          </div>

          {profile && (
            <button
              onClick={() => {
                setCorrFirstName(profile.firstName);
                setCorrLastName(profile.lastName);
                setCorrBirthDate(profile.birthDate);
                setCorrLicenseDate(profile.licenseDate);
                setCorrectionModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-2 rounded-xl border border-blue-200 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Resmi Bilgi Düzeltme Talebi</span>
            </button>
          )}
        </div>

        {kycSuccess && (
          <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{kycSuccess}</span>
          </div>
        )}

        {kycError && (
          <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{kycError}</span>
          </div>
        )}

        {/* Profil Var: Salt Okunur / Kilitli Görünüm */}
        {profile ? (
          <div className="mt-6 space-y-6">
            <div className="p-4 bg-slate-100/80 rounded-xl border border-[#CBD5E1] flex items-start gap-3">
              <Lock className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600 leading-relaxed">
                <span className="font-bold text-slate-800">Yasal Güvenlik Koruması:</span> Ad, Soyad, T.C. Kimlik No,
                Doğum Tarihi ve Ehliyet Tarihi alanları sahtecilik ve sigorta suistimalini önlemek amacıyla kilitlidir.
                Değişiklik talebiniz varsa lütfen &quot;Resmi Bilgi Düzeltme Talebi&quot; butonunu kullanınız.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ad</span>
                <div className="p-3 bg-white border border-[#CBD5E1] rounded-xl font-bold text-slate-900 text-sm">
                  {profile.firstName}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Soyad</span>
                <div className="p-3 bg-white border border-[#CBD5E1] rounded-xl font-bold text-slate-900 text-sm">
                  {profile.lastName}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">T.C. Kimlik No (Maskeli)</span>
                <div className="p-3 bg-white border border-[#CBD5E1] rounded-xl font-bold text-slate-900 text-sm tracking-widest">
                  {profile.maskedNationalId}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Doğum Tarihi / Yaş</span>
                <div className="p-3 bg-white border border-[#CBD5E1] rounded-xl font-bold text-slate-900 text-sm flex items-center justify-between">
                  <span>{profile.birthDate}</span>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-extrabold">
                    {profile.calculatedAge} Yaşında
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ehliyet Tarihi / Deneyim</span>
                <div className="p-3 bg-white border border-[#CBD5E1] rounded-xl font-bold text-slate-900 text-sm flex items-center justify-between">
                  <span>{profile.licenseDate}</span>
                  <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-extrabold">
                    {profile.calculatedLicenseYears} Yıllık Ehliyet
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kiralama Yetkisi</span>
                <div className="p-3 bg-white border border-[#CBD5E1] rounded-xl text-sm font-semibold text-emerald-700">
                  {profile.calculatedAge >= 25 && profile.calculatedLicenseYears >= 5
                    ? 'Tüm Segmentler (Premium Dahil)'
                    : profile.calculatedAge >= 23 && profile.calculatedLicenseYears >= 3
                    ? 'Ekonomik ve Orta Segment'
                    : profile.calculatedAge >= 21 && profile.calculatedLicenseYears >= 2
                    ? 'Ekonomik Segment'
                    : 'Yetersiz Yaş/Ehliyet'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Profil Yok: İlk Kez Profil Doldurma Formu */
          <form onSubmit={handleCreateProfile} className="mt-6 space-y-5">
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
              <span className="font-bold">Önemli:</span> Bu formu yalnızca bir kez doldurabilirsiniz. Bilgilerinizin
              resmi kimliğiniz ve sürücü belgenizle birebir aynı olduğundan emin olunuz.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase">Adınız</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ahmet"
                  className="w-full bg-white border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase">Soyadınız</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Yılmaz"
                  className="w-full bg-white border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase">T.C. Kimlik Numarası</label>
                <input
                  type="text"
                  maxLength={11}
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ''))}
                  placeholder="11 haneli T.C. No"
                  className="w-full bg-white border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase">Doğum Tarihi</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full bg-white border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 uppercase">Sürücü Belgesi (Ehliyet) Veriliş Tarihi</label>
                <input
                  type="date"
                  value={licenseDate}
                  onChange={(e) => setLicenseDate(e.target.value)}
                  className="w-full bg-white border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  required
                />
                <p className="text-[11px] text-slate-500">Ehliyetinizin arkasında yer alan ilk veriliş tarihi.</p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingKyc}
              className="py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all shadow-xs disabled:opacity-50"
            >
              {isSubmittingKyc ? 'Kaydediliyor...' : 'Kimlik Profilimi Oluştur ve Doğrula'}
            </button>
          </form>
        )}
      </div>

      {/* İLETİŞİM VE GÜVENLİK AYARLARI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* İletişim Bilgileri */}
        <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl p-6 shadow-xs space-y-5">
          <h3 className="font-bold text-[#0F172A] text-base pb-3 border-b border-[#CBD5E1]">
            İletişim Bilgileri
          </h3>

          {/* Telefon */}
          <div className="flex items-center justify-between p-3.5 bg-white border border-[#CBD5E1] rounded-xl">
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-blue-600" />
              <div>
                <span className="text-xs text-slate-500 block">Kayıtlı Telefon</span>
                <span className="font-bold text-slate-900 text-sm">{user.phone}</span>
              </div>
            </div>
            <button
              onClick={() => {
                setPhoneModalOpen(true);
                setPhoneStep('ENTER');
              }}
              className="text-xs text-blue-600 font-bold hover:underline"
            >
              Değiştir
            </button>
          </div>

          {/* E-posta */}
          <form onSubmit={handleUpdateEmail} className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase">E-posta Adresi</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="ornek@domain.com"
                  className="w-full bg-white border border-[#CBD5E1] rounded-xl pl-9 pr-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isUpdatingEmail}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 disabled:opacity-50"
              >
                {isUpdatingEmail ? 'Kaydediliyor...' : 'Güncelle'}
              </button>
            </div>
            {emailMsg && <p className="text-xs text-blue-600 font-medium">{emailMsg}</p>}
          </form>
        </div>

        {/* Hesap Yönetimi & Kapatma */}
        <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl p-6 shadow-xs space-y-5 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-[#0F172A] text-base pb-3 border-b border-[#CBD5E1]">
              Hesap Güvenliği & KVKK
            </h3>
            <p className="text-xs text-slate-600 mt-3 leading-relaxed">
              Hesabınızı ve kişisel verilerinizi dilediğiniz zaman silebilirsiniz. Ancak aktif veya borcu bulunan
              rezervasyonlarınız varsa hesap kapatılamaz.
            </p>
          </div>

          <div className="pt-4 border-t border-[#CBD5E1]">
            <button
              onClick={() => setCloseAccountModalOpen(true)}
              className="inline-flex items-center gap-2 text-xs font-bold text-rose-600 hover:text-rose-800 p-2 rounded-lg hover:bg-rose-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Hesabımı Kapat</span>
            </button>
          </div>
        </div>
      </div>

      {/* TELEFON DEĞİŞTİRME MODALI */}
      {phoneModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base">Telefon Numarası Güncelle</h3>
              <button onClick={() => setPhoneModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {phoneModalError && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl">{phoneModalError}</div>
            )}
            {phoneModalSuccess && (
              <div className="p-3 bg-blue-50 text-blue-700 text-xs rounded-xl">{phoneModalSuccess}</div>
            )}

            {phoneStep === 'ENTER' ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase">Yeni Telefon Numarası</label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+90 5XX XXX XX XX"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={handleSendPhoneSms}
                  className="w-full py-2.5 bg-blue-600 text-white font-bold rounded-xl text-sm"
                >
                  SMS Kodu Gönder
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase">6 Haneli SMS Kodu</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={phoneSmsCode}
                    onChange={(e) => setPhoneSmsCode(e.target.value)}
                    placeholder="123456"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-center text-lg font-bold"
                  />
                </div>
                <button
                  onClick={handleConfirmPhoneChange}
                  className="w-full py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-sm"
                >
                  Numarayı Onayla ve Değiştir
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RESMİ DÜZELTME TALEBİ MODALI */}
      {correctionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base">Resmi Kimlik Düzeltme Talebi</h3>
              <button onClick={() => setCorrectionModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {corrError && <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl">{corrError}</div>}
            {corrSuccess && <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl">{corrSuccess}</div>}

            <form onSubmit={handleSendCorrectionRequest} className="space-y-3">
              <p className="text-xs text-slate-500">
                Resmi kimliğinizde mahkeme kararı, soyadı değişikliği veya yenileme varsa bilgileri girip gerekçenizi
                yazınız. Yönetici onayından sonra profil güncellenir.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Düzeltilecek Ad"
                  value={corrFirstName}
                  onChange={(e) => setCorrFirstName(e.target.value)}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  placeholder="Düzeltilecek Soyad"
                  value={corrLastName}
                  onChange={(e) => setCorrLastName(e.target.value)}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <textarea
                placeholder="Düzeltme gerekçeniz ve resmi açıklama (Zorunlu)"
                rows={3}
                value={corrReason}
                onChange={(e) => setCorrReason(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-3 text-xs"
                required
              />

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 text-white font-bold rounded-xl text-sm"
              >
                Talebi Yöneticiye İlet
              </button>
            </form>
          </div>
        </div>
      )}

      {/* HESAP KAPATMA MODALI */}
      {closeAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-rose-600 text-base flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                <span>Hesabı Kalıcı Olarak Kapat</span>
              </h3>
              <button onClick={() => setCloseAccountModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {closeError && <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl">{closeError}</div>}

            <p className="text-xs text-slate-600">
              Hesabınızı kapattığınızda tüm verileriniz anonimleştirilir ve oturumunuz kapatılır. Lütfen ayrılma
              gerekçenizi belirtiniz:
            </p>

            <textarea
              placeholder="Hesap kapatma gerekçesi..."
              rows={3}
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
              className="w-full border border-slate-300 rounded-xl p-3 text-xs"
              required
            />

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setCloseAccountModalOpen(false)}
                className="flex-1 py-2 bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Vazgeç
              </button>
              <button
                onClick={handleCloseAccount}
                className="flex-1 py-2 bg-rose-600 text-white font-bold rounded-xl text-xs hover:bg-rose-700"
              >
                Hesabımı Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
