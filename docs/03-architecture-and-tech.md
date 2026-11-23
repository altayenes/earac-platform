# Teknoloji ve Mimari Kararları

Proje Deposu: [earac-platform GitHub Deposu](https://github.com/altayenes/earac-platform)

## Kesinleşen yön
- **Frontend:** Next.js + TypeScript + Tailwind CSS (masaüstü, tablet ve mobil uyumlu responsive web)
- **Backend:** NestJS + Node.js + TypeScript
- **Veritabanı:** PostgreSQL (yerel geliştirme kurulumu)
- **ORM:** Prisma
- **Paket Yöneticisi ve Klasör Yapısı:** `npm` kullanılır; `backend/` ve `frontend/` bağımsız `package.json` dosyalarına sahip ayrı paketler olarak yönetilir (monorepo workspace kullanılmayacak).
- **Mimari:** Modular Monolith + Layered Architecture; seçici Clean Architecture ilkeleri; 12 modüllük NestJS yapısı (`Auth`, `User`, `Vehicle`, `Branch`, `Pricing`, `Reservation`, `Payment`, `Handover`, `Notification`, `Report`, `Audit`, `Seed`).
- **Kimlik Doğrulama ve Güvenlik:** JWT (`Access Token: 15 dk` + `Refresh Token: 7 gün`, HttpOnly Cookie, veritabanında hash'li saklama); parola hash algoritması **`argon2` (`argon2id`)**.
- **Eşzamanlılık ve Kapasite Kilitleme:** Rezervasyon kapasite kontrolü ve 15 dakikalık `PENDING_PAYMENT` blokesi PostgreSQL **`pg_advisory_xact_lock`** ile atomik yapılır; süresi dolan blokeler hem sorguda (`expiresAt > NOW()` lazy check) filtrelenir hem de periyodik Cron Job ile `EXPIRED` işaretlenir.
- **API dokümantasyonu:** Swagger/OpenAPI
- **Mikroservis kullanılmayacak.**
- NestJS iş kurallarının (`EligibilityRules`, `ReservationRules`, `AuthorizationRules` ve kapasite hesaplama) tek merkezi olacak; Next.js yalnızca kullanıcı arayüzünü yönetecek.
- Açık API/DTO sözleşmeleri kullanılacak; Prisma modelleri doğrudan dışarı açılmayacak.
- OpenAPI üzerinden frontend istemcisi/tipleri üretme seçeneği API sözleşmesi sabitlendikten sonra uygulanacak.
- JSON/mock kalıcı veri katmanı olarak kullanılmayacak; PostgreSQL + `prisma db seed` başlangıçtan itibaren hedef olacak.
- Yerel geliştirmede gerçek ödeme ve gerçek SMS çıkışı yerine servis arayüzleri arkasında çalışan **Sandbox / Simülasyon** adaptörleri kullanılacak.

## Çalışma Zamanı ve Altyapı
- **Çalışma Zamanı (Runtime):** Node.js (`v20+` veya `v22+` LTS), npm (`v10+`)
- **Veritabanı Motoru:** PostgreSQL 15+ (Prisma ORM ile entegre)
- **Kaynak Kod Deposu:** `https://github.com/altayenes/earac-platform.git` (Varsayılan dal: `main`)
