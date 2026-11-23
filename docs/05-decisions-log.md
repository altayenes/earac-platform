# Karar Günlüğü

Proje Deposu: [earac-platform GitHub Deposu](https://github.com/altayenes/earac-platform)

## Kesinleşen kararlar
- Tek işletme ve kendi filosu; çok şirketli pazar yeri değil.
- Yerel geliştirme/test öncelikli; şu aşamada public deployment veya ücretli hosting yok.
- Next.js + TypeScript + Tailwind CSS frontend; NestJS + TypeScript backend; PostgreSQL + Prisma.
- Paket yöneticisi ve klasör yapısı: `npm` kullanılır; `backend/` ve `frontend/` bağımsız paketler olarak yönetilir (monorepo workspace yok).
- Modular Monolith + Layered Architecture; 12 modüllük NestJS yapısı (`Auth`, `User`, `Vehicle`, `Branch`, `Pricing`, `Reservation`, `Payment`, `Handover`, `Notification`, `Report`, `Audit`, `Seed`).
- Swagger/OpenAPI; mikroservis yok.
- Antigravity ajan ekibinde 6 rol sürekli açık tutulmaz; Subagent ağırlıklı çalışılır, Backend ve Frontend paralel değil sıralı geliştirilir, dosya yazma izinleri (`EnableWriteTools`) aşamalı açılır.
- Kullanıcı ve kimlik doğrulama: Tek `Users` tablosu (`role`: `CUSTOMER`, `STAFF`, `SUPER_ADMIN`) + 1:1 `CustomerProfiles` ve `StaffPermissions`; kimlik doğrulama JWT (`15 dk access` + `7 gün HttpOnly cookie refresh`, DB'de hash'li); parola hash algoritması `argon2` (`argon2id`).
- Günlük kiralama; saatlik fiyat yok. Müşteri Alış Tarihi + Planlanan Alış Saati ve İade Tarihi seçer; Planlanan İade Saati otomatik olarak alış saatiyle aynı kabul edilir.
- İki kiralama arasında sabit **2 saatlik hazırlık/temizlik tamponu (`TURNAROUND_BUFFER_HOURS = 2`)** uygulanır; şubeler varsayılan `08:00 - 22:00` çalışma saatlerine sahiptir.
- Ödeme adımında **15 dakikalık geçici kapasite blokesi (`PENDING_PAYMENT` + `expiresAt`)** uygulanır; kapasite kilidi PostgreSQL `pg_advisory_xact_lock`, sorgularda `expiresAt > NOW()` lazy check ve periyodik cron temizliği ile yönetilir.
- İlk sürümde aynı şubeye iade; rezervasyon için müşteri hesabı zorunlu.
- Segment uygunluk kuralları sabittir: Economic (min. 21 yaş / 2 yıl ehliyet), Medium (min. 23 yaş / 3 yıl ehliyet), Premium (min. 25 yaş / 5 yıl ehliyet).
- Araç durum makinesi (5 durum): `AVAILABLE`, `RENTED`, `MAINTENANCE`, `DAMAGED_OUT_OF_SERVICE`, `INACTIVE` (`MAINTENANCE -> INACTIVE` geçişi dahil).
- Rezervasyon durum makinesi (8 durum): `PENDING_PAYMENT`, `CONFIRMED`, `EXPIRED`, `PAYMENT_FAILED`, `CANCELLED`, `ACTIVE`, `COMPLETED`, `NO_SHOW` (`CONFIRMED -> NO_SHOW` geçişi dahil).
- Fiziksel araç çevrimiçi rezervasyon sırasında atanmaz (`Reservations.vehicleId` nullable); müşteri şubede tam eşleşen uygun aracı seçer.
- Teslimatta stok sıfırlanması gibi acil istisnalarda yalnızca **Yönetici Onayı + Müşteri Onayı** ile fiyat farkı olmadan eşdeğer/üst segment araç atanabilir.
- Rezervasyon değişikliği (v1): `ReservationChangeRequests` tablosu üzerinden basit talep + yönetici onayı (tarih aralığı veya araç grubu değişikliği) şeklinde uygulanır; onaylanana kadar eski rezervasyon geçerli kalır.
- Ödeme başarılı olunca rezervasyon otomatik onaylanır (`Payments` tablosu 1:N, `CHARGE` / `REFUND` tipli); müşteri iptalinde kira bedelinin tamamı iade edilir.
- Hasarlı iade edilen araç otomatik hizmet dışı (`DAMAGED_OUT_OF_SERVICE`) kalır.
- Araç fiyatı segment + gövde tipi kombinasyonuna bağlıdır; rezervasyon fiyat snapshot'ı ayrı 1:1 `ReservationPriceSnapshots` tablosunda saklanır.
- 3 katmanlı Hibrit Veri Yönetimi uygulanır; araç özellikleri (`BodyTypes`, `FuelTypes`, `TransmissionTypes`) ve marka/model (`VehicleBrands`, `VehicleModels`) ilişkisel tutulur, kullanılmış kayıtlar silinmez, pasife (`isActive: false`) alınır.
- Başlangıç verileri (`Segments`, temel özellikler, örnek marka/model ve örnek şubeler) `prisma db seed` ile yüklenir.
- Yerel geliştirmede (v1) gerçek ödeme ve SMS yerine `PaymentProvider` ve `NotificationProvider` arayüzleri arkasında **Sandbox / Simülasyon** kullanılır.

## Açık kararlar – üretim öncesi veya dış onay gerektirenler
*(Not: Aşağıdaki maddeler yerel MVP kodlamasını engellemez; canlıya geçiş veya üretim operasyonları öncesi hukuk ve sağlayıcı anlaşmalarıyla netleştirilecektir.)*
1. **Canlı Ödeme Sağlayıcısı ve Depozito:** Üretim ortamında kullanılacak gerçek ödeme sağlayıcısı (iyzico/PayTR vb.) ve ön provizyon/depozito tutar politikası.
2. **Hukuk ve KVKK İncelemesi:** T.C. kimlik numarası saklama/şifreleme/anonimleştirme süreleri, iptal son saati ve tüketici mevzuatı uyumu.
3. **Canlı SMS/E-posta Sağlayıcısı:** Üretim ortamında kullanılacak SMS ve e-posta sağlayıcısı seçimi.

## Karar değişikliği süreci
Ajan bir değişiklik önerirse:
- Mevcut karar ve gerekçesini belirtir.
- Önerilen değişikliği ve teknik/iş etkilerini açıklar.
- Veri migrasyonu, geriye uyumluluk, güvenlik ve test etkilerini belirtir.
- Kullanıcı onayı olmadan kararı kesinleştirmez.

## Karar: Marka Kimliği ve Tasarım Sistemi (UI/UX)
- **Durum:** Onaylandı
- **Karar:** Platformun resmi adı **`EAraç Kiralama`** olarak kesinleştirilmiştir.
  - **Logo:** Koyu Lacivert (`#0F172A`) rozet içinde geometrik `EA` monogram SVG (`A` harfinin yatay çizgisi Kurumsal Mavi `#2563EB`); yanında `EA` (Kurumsal Mavi) + `raç` (Koyu Lacivert) ve altında ince `KİRALAMA` alt başlığı.
  - **Renk Sistemi:** Sol menü ve zemin Koyu Lacivert (`#0F172A`), vurgu ve aksiyon butonları Kurumsal Mavi (`#2563EB`), çalışma alanı Mat Slate (`#E5EBF2` / `#F8FAFC`), kartlar ve formlar Temiz Beyaz (`#FFFFFF`).
  - **%100 Doğal Türkçe:** Tüm sistemde kullanıcıya ham İngilizce enum/teknik anahtarlar gösterilemez; durumlar, filtreler, segmentler ve hata mesajları yerelleştirilmiştir.

## Karar: Müşteri Kayıt ve E-Posta Zorunluluğu
- **Durum:** Onaylandı
- **Karar:** v1 sürümünde müşteri kaydında telefon, ad, soyad, parola, doğum tarihi, ehliyet tarihi ve T.C. kimlik numarasının yanı sıra **e-posta adresi de zorunlu** kılınmıştır (`RegisterDto`: `@IsNotEmpty() @IsEmail()`). Bu karar resmi sözleşme, e-posta makbuzları ve güvenlik doğrulamalarını teminat altına alır.

## Karar: Korunan Müşteri Alanları ve Resmi Düzeltme Akışı
- **Durum:** Onaylandı
- **Karar:** Sahtecilik ve sigorta suistimalini önlemek amacıyla ad, soyad, TCKN, doğum ve ehliyet tarihi profilde doğrudan düzenlemeye kapatılmıştır (`KYC Kimlik Onaylı` kilitli görünüm). Değişiklikler müşteri tarafından gerekçe belirtilerek talep edilir (`IdentityCorrectionRequests`), Yönetici Panelindeki `/yonetim/duzeltme-talepleri` ekranında incelenir, onaylandığında profil güncellenir ve işlem `AuditLogs` kaydına yazılır.

## Karar: Hibrit Veri Yönetimi
- **Durum:** Onaylandı
- **Karar:** EAraç Kiralama (`earac-platform`) projesinde 3 katmanlı hibrit veri yönetimi yaklaşımı kullanılacaktır: temel iş kuralları backend'de sabit, işletme verileri PostgreSQL'de yönetilebilir (soft-deactivate), sistem verileri otomatik ve korunaklı tutulur; kritik işlemler `AuditLogs` tablosuna yazılır.

## Karar: Araç Özelliklerinin (Kasa, Yakıt ve Vites Tipi) Yönetimi
- **Durum:** Onaylandı
- **Karar:** `BodyTypes`, `FuelTypes`, `TransmissionTypes` yalnızca Ana Yönetici (veya yetkili personel) tarafından eklenebilir/güncellenebilir; daha önce araç veya rezervasyonda kullanılmış kayıtlar silinemez (`DELETE` yasak), yalnızca `isActive: false` yapılır.

## Karar: Segment Yaş Sınırları ve Rezervasyon Tarih/Saat Kapasite Aralığı
- **Durum:** Onaylandı
- **Karar:** Asgari yaş/ehliyet sınırları **Economic: 21/2**, **Medium: 23/3**, **Premium: 25/5** olarak sabitlenmiştir. Müşteri Alış Tarihi + Planlanan Alış Saati ve İade Tarihi seçer; Planlanan İade Saati otomatik olarak alış saatiyle aynı kabul edilir.

## Karar: Faz 1 Öncesi 7 Teknik Mimari Karar (Analiz Raporu Yanıtı)
- **Durum:** Onaylandı
- **Karar:** `npm` + bağımsız `backend/` ve `frontend/` paketleri; 5 durumlu Araç State Machine (`MAINTENANCE -> INACTIVE` dahil); 8 durumlu Rezervasyon State Machine (`CONFIRMED -> NO_SHOW` dahil); tek `Users` tablosu + 1:1 `CustomerProfiles` ve `StaffPermissions`; JWT (`15 dk access` + `7 gün HttpOnly cookie refresh`, DB'de hash'li); `argon2id` parola hash; v1'de `ReservationChangeRequests` ile basit değişiklik talebi + yönetici onayı; `Reservations.vehicleId` nullable, `ReservationPriceSnapshots` 1:1, `Payments` 1:N (`CHARGE`/`REFUND`), `SmsVerificationCodes` (`phone + purpose + optional userId`) ve kapasite için `pg_advisory_xact_lock` + lazy check + cron temizliği kesinleştirilmiştir.
