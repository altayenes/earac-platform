# EAraç Kiralama Platformu – Proje Çalışma Talimatları

Proje Deposu: [earac-platform GitHub Deposu](https://github.com/altayenes/earac-platform)

## Proje sahibi ve karar yetkisi
- Projenin sahibi kullanıcıdır; nihai karar ve onay yetkisi kullanıcıdadır.
- Kesinleşmiş iş kurallarını veya teknoloji kararlarını kullanıcı onayı olmadan değiştirme.
- Açık kararları kesinleşmiş gibi sunma. Açık noktaları `docs/05-decisions-log.md` ve `docs/04-data-inventory.md` içinde açıkça işaretle.
- Önemli mimari, veri modeli, güvenlik veya iş kuralı değişikliklerinde önce gerekçe ve etkileriyle birlikte onay iste.

## Çalışma ilkeleri
- Önce mevcut belgeleri (`docs/` altındaki tüm Markdown dosyalarını) ve kod tabanını incele; sonra planla; onaydan sonra uygula.
- Kullanıcı açıkça istemedikçe büyük çaplı dosya değişiklikleri, paket kurulumları, veritabanı değişiklikleri veya Git commit/push işlemleri yapma.
- Küçük, anlaşılır ve gözden geçirilebilir adımlarla ilerle.
- Kod yazarken sürdürülebilirlik, güvenlik, test edilebilirlik ve tutarlı tasarıma öncelik ver.
- İş kurallarını frontend ve backend arasında çoğaltma; merkezi iş mantığı NestJS backend'de olsun.
- Prisma modellerini doğrudan API sözleşmesi olarak dışarı açma. Açık DTO/API sözleşmeleri kullan.
- Rezervasyon, kapasite ve ödeme işlemlerinde eşzamanlılık, idempotency ve veri tutarlılığı konularını özellikle ele al.
- Kapasite zaman aralıklarını `[başlangıç, bitiş)` (başlangıç dahil, bitiş hariç) olarak yorumla; iki kiralama arasında 2 saat hazırlık tamponu uygula. Gerçek iade gecikirse araç, iade kontrolü tamamlanmadan ve ardından 2 saatlik hazırlık süresi geçmeden müsait sayılamaz.
- Ödeme blokesi 15 dakikadır. Süre dolduğunda ödeme sonucu belirsizse kapasiteyi doğrulama/uzlaştırma tamamlanmadan serbest bırakma; sağlayıcı durumunu doğrula, idempotent işle ve yetkili personele uyarı üret.
- Gerçek ödeme veya gerçek SMS gönderimi yapma. Yerel geliştirmede sandbox/simülasyon kullan.
- Gizli anahtarları, parolaları veya kişisel verileri kaynak koda ya da Git'e koyma.

## Belirsiz veriler ve eksik bilgi yönetimi (Hibrit Veri Yönetimi)
- Projede kullanılan tüm veriler `docs/04-data-inventory.md` içindeki 3 katmanlı Hibrit Veri Yönetimi mimarisine göre sınıflandırılır:
  1. **Backend kontrollü sabit iş kuralları:** Yaş/ehliyet uygunluk sınırları (`Economic: 21/2`, `Medium: 23/3`, `Premium: 25/5`), günlük kiralama hesabı, aynı şubeye iade ve tam eşleşme kuralları kod/konfigürasyon seviyesinde korunur; yönetim panelinden rastgele değiştirilemez.
  2. **Yönetim panelinden yönetilen işletme verileri:** Araç özellikleri (`BodyTypes`, `FuelTypes`, `TransmissionTypes`), markalar/modeller, şubeler, segment-kasa fiyatları ve araç envanteri PostgreSQL'de tutulur. Geçmiş kayıtlarla ilişkili hiçbir referans veri fiziksel olarak silinmez (`DELETE` uygulanmaz), yalnızca pasife (`isActive: false`) alınır.
  3. **Sistem tarafından üretilen korunaklı veriler:** Rezervasyonlar, fiyat snapshot kayıtları (`ReservationPriceSnapshots`), ödemeler, durum geçmişleri ve denetim kayıtları (`AuditLogs`) sistem tarafından otomatik üretilir; geçmişe dönük değiştirilemez.
- Henüz kararlaştırılmamış veya `docs/04-data-inventory.md` içinde açık olarak işaretlenmiş veriler için ajanlar kendi başına varsayım yapamaz; eksik noktayı raporlayıp kullanıcı onayı ister.

## Teknoloji yönü
- Frontend: Next.js + TypeScript
- Backend: NestJS + TypeScript
- Veritabanı: PostgreSQL
- ORM: Prisma
- Mimari: Modular Monolith + Layered Architecture; gerektiği yerde Clean Architecture ilkeleri
- API dokümantasyonu: Swagger/OpenAPI
- Mikroservis mimarisi kullanma.
- Sürümleri ve kurulum komutlarını uygulamadan önce güncel resmi dokümantasyon ve uyumlulukla doğrula.

## Ajanlarla çalışma
- `docs/06-agent-workflow.md` içindeki rol, yetki ve koordinasyon kurallarına uy.
- 6 uzman rolü aynı anda sürekli açık tutma; yalnızca ilgili aşamanın gerektirdiği alt ajanı (Subagent) görevlendir.
- Backend ve Frontend geliştirmesini aynı anda başlatma; önce veri modeli (`schema.prisma`) ve Backend API sözleşmesini tamamla, ardından Frontend aşamasına geç.
- Dosya yazma izinlerini (`EnableWriteTools`) aşamalı olarak ve yalnızca onaylanan görev kapsamı için kullan.
- Aynı dosya üzerinde eş zamanlı yazma yaptırma. Dosya sahipliği ve görev sınırlarını önceden belirle.
- Ajanların raporlarını ana ajan birleştirir; çelişkileri kullanıcıya sunar.
- QA/güvenlik incelemesi geliştiren ajandan bağımsız yapılmalıdır.
- Hiçbir ajan kullanıcı onayı gereken bir kararı kendi başına kesinleştiremez.

## İlk çalışma talimatı
Kullanıcı ayrıca onay vermeden kod yazma, paket yükleme, dosya oluşturma/silme/değiştirme, veritabanı kurma veya Git commit/push yapma. Önce `docs/` içindeki belgeleri oku, mevcut klasör/Git durumunu incele ve analiz raporu sun.
