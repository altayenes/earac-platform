# Merkezi Veri Envanteri ve Hibrit Veri Yönetimi Matrisi (`04-data-inventory.md`)

Proje Deposu: [earac-platform GitHub Deposu](https://github.com/altayenes/earac-platform)

## Amaç
`05-decisions-log.md` içindeki **Hibrit Veri Yönetimi** kararı doğrultusunda; sistemdeki tüm veri gruplarının hangi katmanda tutulacağını, kim tarafından değiştirilebileceğini, durum makinelerini (State Machine), silme/pasifleştirme davranışını ve üretim öncesi onay bekleyen dış bağımlılıkları tek merkezde tanımlamak.

## 1. Katman: Backend Kontrollü Sabit İş Kuralları (Kod / Konfigürasyon)
Bu veriler veritabanı üzerinden rastgele değiştirilemez; doğrudan NestJS iş mantığı katmanında (`domain/rules`) korunur.

| Kural Grubu | Kapsadığı Kurallar ve Sabit Değerler | Değişiklik Yetkisi |
| :--- | :--- | :--- |
| **`EligibilityRules`** | **Economic:** min. 21 yaş, min. 2 yıl ehliyet<br>**Medium:** min. 23 yaş, min. 3 yıl ehliyet<br>**Premium:** min. 25 yaş, min. 5 yıl ehliyet | Yalnızca proje sahibi onayıyla kaynak kod/konfigürasyon üzerinden güncellenir. |
| **`ReservationRules`** | Günlük kiralama (24 saatlik tam gün katları), planlanan alış saati = planlanan iade saati, **2 saatlik hazırlık tamponu (`TURNAROUND_BUFFER_HOURS = 2`)**, **15 dakikalık geçici ödeme blokesi (`PAYMENT_HOLD_MINUTES = 15`)**, v1'de aynı şubeye iade, `Şube + Segment + Gövde + Yakıt + Vites` tam eşleşme şartı, PostgreSQL `pg_advisory_xact_lock` + lazy check + cron TTL temizliği. | Yalnızca proje sahibi onayıyla kaynak kod/konfigürasyon üzerinden güncellenir. |
| **`AuthorizationRules`** | Tek Ana Yönetici (`SUPER_ADMIN`) ve onun oluşturduğu modül bazlı yetkilendirilmiş personel (`STAFF`) yapısı; personelin kendi yetkisini değiştirememesi; JWT (`15 dk access` + `7 gün HttpOnly cookie refresh`, DB'de hash'li) ve `argon2id` parola hash. | Yalnızca proje sahibi onayıyla kaynak kod/konfigürasyon üzerinden güncellenir. |

## 2. Katman: Yönetim Panelinden Yönetilen İşletme Verileri (PostgreSQL)
Bu veriler PostgreSQL veritabanında tutulur ve yönetim paneli üzerinden yönetilir. Geçmiş kayıtlarla ilişkisi bulunan hiçbir kayıt fiziksel olarak silinmez (`DELETE` yasaktır), `isActive: false` ile pasife alınır.

| Tablo / Veri Grubu | Temel Alanlar ve İlişkiler | Yönetim Yetkisi | Silme / Pasifleştirme Kuralı |
| :--- | :--- | :--- | :--- |
| **`Users` & `CustomerProfiles`** | Tek `Users` tablosu (`role`: `CUSTOMER`, `STAFF`, `SUPER_ADMIN`, `phone`, `passwordHash`, `isActive`) + 1:1 `CustomerProfiles` (ad, soyad, T.C. Kimlik No şifreli, doğum/ehliyet tarihi, doğrulanmış isteğe bağlı e-posta) | Kullanıcı / Ana Yönetici | Hesap kapatmada `isActive: false` yapılır; yasal kayıtlar korunup gereksiz kişisel veriler anonimleştirilir. |
| **`StaffPermissions`** | `Users` ile 1:1 ilişki; modül izin bayrakları (`RESERVATIONS`, `VEHICLES`, `HANDOVER_RETURN`, `CUSTOMERS`, `REPORTS`) | Sadece Ana Yönetici | Personel erişimi silinmek yerine devre dışı (`isActive: false`) bırakılır. |
| **`Segments`** | `id`, `code` (`ECONOMIC`, `MEDIUM`, `PREMIUM`), `name`, `isActive` | Ana Yönetici | Sabit 3 ana segment başlangıçta seed ile gelir; silinmez. |
| **`BodyTypes`** | `id`, `name` (Sedan, Hatchback, SUV vb.), `isActive` | Ana Yönetici (veya yetkili personel) | Araç veya rezervasyonda kullanıldıysa silinmez; pasife alınır. |
| **`FuelTypes`** | `id`, `name` (Benzin, Dizel, Hibrit, Elektrik vb.), `isActive` | Ana Yönetici (veya yetkili personel) | Araç veya rezervasyonda kullanıldıysa silinmez; pasife alınır. |
| **`TransmissionTypes`** | `id`, `name` (Manuel, Otomatik vb.), `isActive` | Ana Yönetici (veya yetkili personel) | Araç veya rezervasyonda kullanıldıysa silinmez; pasife alınır. |
| **`VehicleBrands` & `VehicleModels`** | Marka adı, Model adı, `brandId`, `isActive` | Ana Yönetici / Araç Yetkili Personel | Envanterde kullanıldıysa silinmez; pasife alınır (Seed verisiyle başlar). |
| **`Branches`** | Şube adı, şehir/adres, iletişim, `openingTime` (varsayılan `08:00`), `closingTime` (varsayılan `22:00`), `isActive` | Ana Yönetici | Aktif/geçmiş rezervasyonu veya aracı olan şube silinmez; pasife alınır. |
| **`SegmentBodyTypePrices`** | `segmentId`, `bodyTypeId`, `dailyPrice`, `currency` (`TRY`), `isActive`, `updatedAt` | Ana Yönetici | Fiyat güncellendiğinde yalnızca yeni rezervasyonlara uygulanır; eski rezervasyonlar snapshot'tan okunur. |
| **`Vehicles`** | Plaka, marka/model, yıl, koltuk sayısı, şube, segment, gövde, yakıt, vites, 5 operasyonel durum (`AVAILABLE`, `RENTED`, `MAINTENANCE`, `DAMAGED_OUT_OF_SERVICE`, `INACTIVE` — `MAINTENANCE -> INACTIVE` geçişi dahil) | Ana Yönetici / Araç Yetkili Personel | Geçmiş kiralaması olan araç silinmez; hasarlı iadede otomatik `DAMAGED_OUT_OF_SERVICE` olur. |

## 3. Katman: Sistem Tarafından Otomatik Üretilen Korunaklı Veriler (Immutable / Audit)
Bu veriler kullanıcı veya personel tarafından elle düzenlenemez ve silinemez; sistem akışı içinde transaction ile üretilir.

| Tablo / Veri Grubu | Üretildiği An ve İlişki | Koruma ve Bütünlük Kuralı |
| :--- | :--- | :--- |
| **`Reservations`** | Müşteri rezervasyon talebi oluşturduğunda (`vehicleId` nullable, `branchId + segmentId + bodyTypeId + fuelTypeId + transmissionTypeId` zorunlu) | 8 durumlu kontrollü geçişler (`PENDING_PAYMENT`, `CONFIRMED`, `EXPIRED`, `PAYMENT_FAILED`, `CANCELLED`, `ACTIVE`, `COMPLETED`, `NO_SHOW`); fiziksel silinmez. |
| **`ReservationPriceSnapshots`** | Rezervasyon oluşturulduğu / onaylandığı anda (`Reservations` ile ayrı 1:1 tablo) | Günlük fiyat, gün sayısı, toplam tutar ve segment/kasa bilgisi dondurulur; asla güncellenmez. |
| **`ReservationChangeRequests`** | Müşteri tarih veya araç grubu değişikliği talep ettiğinde (`Reservations` ile 1:N) | Yönetici onayına kadar eski rezervasyon korunur; onay/red geçmişi saklanır. |
| **`Payments`** | Sandbox/ödeme veya iade işlemi tamamlandığında (`Reservations` ile 1:N; `type`: `CHARGE` / `REFUND`) | `idempotencyKey` ile korunur; çift tahsilat/iade engellenir. |
| **`ReservationStatusHistories`** | Rezervasyon durumu her değiştiğinde | Kim tarafından, ne zaman, hangi durumdan hangi duruma geçildiğini salt okunur tutar. |
| **`AuditLogs`** | Kritik yönetim, yetki, fiyat, istisna araç atama, kimlik düzeltme ve durum işlemlerinde | Silinemez ve değiştirilemez denetim izi kaydıdır. |
| **`SmsVerificationCodes`** | Kayıt, telefon değişimi ve parola sıfırlama adımlarında (`phone`, `purpose`, opsiyonel `userId`) | Süreli (`expiresAt`) ve deneme sınırlı doğrulama kaydıdır (v1'de sandbox simülasyon). |

## 4. Katman: Üretim Öncesi / Dış Bağımlılığı Olan Açık Noktalar
Yerel MVP geliştirme sürecini engellemeyen, ancak canlı ortama geçiş veya UI/UX aşaması öncesi netleştirilecek konular (`05-decisions-log.md` ile %100 uyumludur):
1. **Gerçek Ödeme Sağlayıcısı & Depozito Politikası:** Canlı ortamda entegre edilecek sanal POS (iyzico/PayTR vb.) ve provizyon kuralları.
2. **Gerçek SMS / E-posta Sağlayıcısı:** Canlı ortam bildirim servis sağlayıcısı seçimi.
3. **KVKK ve Hukuk Onayı:** T.C. kimlik no saklama süreleri ve iptal son saati mevzuat uyumu.
4. **Marka Kimliği:** UI/UX tasarım aşamasında belirlenecek marka adı, logo ve renk paleti.
5. **Korunan Müşteri Alanları Düzeltme Akışı:** Ad, soyad, T.C. kimlik no, doğum ve ehliyet tarihi düzeltme taleplerinde istenecek kanıt/belge türü (v1'de basit metin talebi + yönetici onayı ile başlanabilir).
