# Gereksinimler ve İş Kuralları

Proje Deposu: [earac-platform GitHub Deposu](https://github.com/altayenes/earac-platform)

Bu belge kesinleşen mevcut kararları ve dış bağımlılığı (hukuk/tasarım) olan açık noktaları ayırır. Açık maddeler kullanıcı onayı olmadan kesinleştirilmemelidir.

## Müşteri hesabı
- Siteyi hesap açmadan incelemek mümkün.
- Rezervasyon için müşteri hesabı zorunlu.
- Kayıtta zorunlu alanlar: ad, soyad, e-posta, telefon, parola, doğum tarihi, ehliyet alma tarihi, T.C. kimlik numarası.
- E-posta zorunludur (`v1` kararı); resmi sözleşme, rezervasyon dökümleri ve güvenlik bildirimlerinde telefonla birlikte birincil iletişim kanalıdır.
- Giriş: telefon + parola.
- Parola sıfırlama: kayıtlı telefona SMS kodu (yerel geliştirmede sandbox simülasyon).
- Telefon/e-posta değişikliklerinde yeni iletişim bilgisi doğrulanır.
- Ad, soyad, T.C. kimlik numarası, doğum tarihi ve ehliyet tarihi müşteri tarafından doğrudan değiştirilemez; düzeltme talebi yönetici onayı gerektirir.
- Hesap kapatma talebinde giriş devre dışı bırakılır; hukuki saklama zorunluluğu olmayan veriler silinir veya anonimleştirilir.
- KVKK hukuki dayanakları, saklama süreleri ve süreçleri üretim öncesi hukuk uzmanı tarafından doğrulanmalıdır.

## Segment uygunluğu (Sabit İş Kuralı)
| Segment | Asgari yaş | Ehliyet süresi |
|---|---:|---:|
| Economic | 21 | 2 yıl |
| Medium | 23 | 3 yıl |
| Premium | 25 | 5 yıl |

- Yaş ve ehliyet süresi koşullarının ikisi de sağlanmalı.
- Bu değerler backend içerisinde sabit iş kuralı (`EligibilityRules`) olarak korunur; yönetim panelinden değiştirilemez.
- Kontrol, seçilen segment ve kiralama başlangıç tarihi esas alınarak yapılmalı (kiralama başlangıç günü itibarıyla tam yaş ve tam ehliyet yılı dolmuş olmalıdır).

## Araçlar, marka/model ve özellik yönetimi
- Bağımsız boyutlar: segment (`Segments`), gövde/kasa tipi (`BodyTypes`), yakıt tipi (`FuelTypes`), vites tipi (`TransmissionTypes`).
- Başlangıç segmentleri ve başlangıç (seed) verileri: Sistem ilk kurulumda `prisma db seed` ile 3 ana segmenti (`Economic`, `Medium`, `Premium`), temel kasa/yakıt/vites tiplerini, örnek marka/modelleri ve en az bir varsayılan şubeyi veritabanına yükler.
- **Marka ve Model Hiyerarşisi:** Serbest metin yerine ilişkisel `VehicleBrands` ve buna bağlı `VehicleModels` yapısı kullanılır; yazım hataları engellenir.
- **Silme ve Pasifleştirme Kuralı:** Araç özellikleri (`BodyTypes`, `FuelTypes`, `TransmissionTypes`), markalar, modeller ve şubeler yönetim panelinden eklenebilir; ancak herhangi bir araç veya rezervasyonda kullanılmış bir kayıt fiziksel olarak silinemez (`DELETE` uygulanmaz), yalnızca pasife (`isActive: false`) alınabilir.
- Araç alanları: marka, model, model yılı, plaka, segment, gövde tipi, yakıt, vites, koltuk sayısı, şube, operasyonel durum.
- Bagaj kapasitesi, açıklama ve fotoğraf ilk sürüm kapsamı dışında.
- Müşteri çevrimiçi aşamada fiziksel araç/plaka görmez.
- Bakım durumundaki araçlar kapasite ve uygun araç listesine dahil edilmez.
- İade sırasında hasar kaydı açılırsa araç otomatik olarak hizmet dışına alınır.
- Ayrıntılı bakım takvimi/servis geçmişi ilk sürüm dışında.

## Fiyatlandırma
- Günlük fiyat segment + gövde tipi birleşimine (`SegmentBodyTypePrices`) göre belirlenir.
- Aynı segment ve gövde tipindeki araçlar aynı günlük fiyata sahiptir.
- Yakıt ve vites ilk fiyatlandırmada etkili değildir.
- Fiyat araç bazında değil, segment/gövde tipi kombinasyonu bazında tutulur.
- Rezervasyonda fiyatın değişmez anlık görüntüsü (`ReservationPriceSnapshots`) saklanır; sonradan yapılan fiyat güncellemeleri mevcut veya geçmiş rezervasyonları etkilemez.
- Fiyatı tanımlanmamış veya pasif kombinasyon rezerve edilemez.
- Alternatif araç tipi fiyatı değiştiriyorsa ödeme öncesi yeni fiyat gösterilir ve müşteri kabul eder.

## Kiralama dönemi, tarih/saat seçimi ve şube
- Yalnızca günlük kiralama; saatlik fiyat yok.
- **Tarih ve Saat Seçimi:** Müşteri çevrimiçi arama ve rezervasyon sırasında **Alış Tarihi**, **Planlanan Alış Saati** (şube çalışma saatleri dahilinde; varsayılan şube çalışma saatleri `08:00 - 22:00` olup şube bazında ayarlanabilir) ve **İade Tarihi** seçer.
- **Planlanan İade Saati:** Günlük kiralama kuralı gereği planlanan iade saati otomatik olarak **planlanan alış saatiyle aynı** kabul edilir (ör. 10 Haziran 14:00 alış – 12 Haziran 14:00 iade = 2 gün).
- **Hazırlık Tampon Süresi (Turnaround Buffer):** İki kiralama arasında sabit **2 saatlik hazırlık/temizlik tamponu** uygulanır (`TURNAROUND_BUFFER_HOURS = 2`). Planlanan kapasite aralığı `[Planlanan Alış, Planlanan İade + 2 saat)` olarak değerlendirilir. Aralık başlangıcı dahildir, bitişi hariçtir; önceki blokajın bittiği anda yeni rezervasyon başlayabilir.
- **Geç İade Yönetimi:** Araç planlanan iade saatinden geç dönerse, iade kontrolü tamamlanmadan araç müsait sayılmaz. Gerçek iade ve kontrol tamamlanma zamanından itibaren 2 saatlik hazırlık tamponu uygulanır. Gecikme sonraki rezervasyonları etkileyebilecekse sistem kapasite riskini işaretler ve yetkili personele/yöneticiye uyarı verir. Mevcut rezervasyonlar otomatik olarak sessizce değiştirilmez veya iptal edilmez; işletme müşteriyle çözüm sürecini yürütür.
- Gerçek teslim saati ve gerçek iade saati, araç şubede fiziksel olarak teslim verildiğinde ve iade alındığında ayrıca kaydedilir.
- İlk sürümde araç teslim alınan aynı şubeye iade edilir; farklı şubeye iade kapsam dışıdır.

## Rezervasyon, geçici blokaj ve araç tahsisi
- **Geçici Kapasite Blokesi (TTL):** Müşteri ödeme adımına geçtiğinde seçilen araç grubu (`Şube + Segment + Gövde + Yakıt + Vites`) ve tarih/saat aralığı için sunucu saati esas alınarak **15 dakikalık** geçici kapasite blokesi (`PENDING_PAYMENT` + `expiresAt`) oluşturulur.
- Ödeme başarılı ve doğrulanmışsa rezervasyon otomatik onaylanır (`CONFIRMED`).
- Ödeme kesin olarak başarısızsa veya sağlayıcıdan başarısızlık doğrulanırsa geçici kapasite serbest bırakılır (`PAYMENT_FAILED`).
- 15 dakika dolduğunda ödeme sonucu kesin değilse kapasite hemen serbest bırakılmaz. Sistem sağlayıcıdan ödeme durumunu sorgular/doğrular; sonuç belirsiz kaldığı sürece kayıt uzlaştırma/inceleme durumunda tutulur, kapasite güvenli biçimde korunur ve yetkili personele uyarı verilir. Sonuç kesinleşince rezervasyon onaylanır veya blokaj serbest bırakılır.
- Ödeme webhook/callback tekrarları idempotent işlenir; aynı ödeme veya bildirim ikinci kez rezervasyon/tahsilat oluşturamaz.
- Fiziksel araç ve plaka çevrimiçi aşamada atanmaz.
- Ödeme sonrası segment ve seçilen özellikler sessizce değiştirilemez.
- Tam eşleşme: segment, gövde, yakıt, vites, şube ve tarih/saat aralığı.
- Tam eşleşme yoksa ödeme öncesi alternatif sunulabilir; müşteri açıkça kabul etmelidir.
- **Teslimatta Uygun Araç Bulunamama İstisnası:** Normal akışta şubede müşteriye yalnızca tam eşleşen uygun fiziksel araçlar sunulur. Son uygun aracın hasarlanması/arızalanması gibi istisnai durumda yönetici, zorunlu özellikleri (özellikle şube, tarih/süre ve vites gibi müşteri talebindeki özellikleri) karşılayan eşdeğer veya üst segment alternatifi değerlendirebilir. Fiyat farkı alınmadan araç atanması için **Yönetici Onayı + Müşteri Onayı** gerekir ve işlem gerekçesiyle `AuditLogs` kaydına yazılır. Müşteri alternatifi reddedebilir. İşletme uygun bir çözüm sunamazsa müşteri rezervasyonu iptal edip kira bedelinin tamamının iadesini talep edebilir; uygulama ayrıntıları üretim öncesi hukuk incelemesinden geçirilir.
- Çifte rezervasyon backend ve veritabanı/transaction seviyesinde engellenmeli.

## Ödeme (v1 Sandbox / Simülasyon)
- Yerel geliştirme (v1) aşamasında gerçek ödeme alınmaz; bir `PaymentProvider` arayüzü arkasında çalışan **Sandbox / Simülasyon Ödeme** modülü kullanılır (başarılı ödeme, başarısız ödeme ve süre aşımı senaryolarını test edebilir).
- Başarılı ödeme rezervasyonu otomatik onaylar.
- Başarısız/süresi dolmuş ödeme kapasite blokesini kaldırır.
- Webhook/callback tekrarlarına karşı `idempotencyKey` zorunludur.
- Üretim aşaması için gerçek ödeme sağlayıcısı (iyzico/PayTR vb.) ve depozito/ön provizyon politikası ayrıca netleştirilecektir.

## İptal ve iade
- Ödenmiş rezervasyon müşteri tarafından iptal edilirse kira bedelinin tamamının iadesi mevcut karardır.
- İptal kapasiteyi serbest bırakır.
- Müşteri iade durumunu görebilir.
- İptal son saati, teslim sonrası iptal, iade süresi/sağlayıcı kesintileri ve tüketici mevzuatı üretim öncesi hukuk incelemesiyle kesinleştirilecektir.
- Fiziksel teslimden sonra normal rezervasyon iptali değil, kiralama sonlandırma/iade süreci işletilir.

## Rezervasyon değişikliği
- Müşteri değişiklik talebi oluşturabilir.
- Yönetici onaylar veya reddeder.
- Onay verilene kadar eski rezervasyon geçerli kalır.
- Yeni tarih/konfigürasyon için kapasite kontrolü yapılır.
- Fiyat değişirse müşteri bilgilendirilir ve onayı alınır; ek ödeme/iade süreci uygulanır.

## Bildirimler (v1 Sandbox / Simülasyon)
- SMS: telefon doğrulama, rezervasyon, ödeme sonucu, iptal, iade durumu, değişiklik sonucu, teslim/iade hatırlatmaları.
- E-posta: yalnızca doğrulanmış ve isteğe bağlı e-posta adresi varsa.
- Yerel geliştirmede (v1) gerçek SMS/e-posta gönderilmez; `NotificationProvider` arayüzü arkasında konsol/veritabanı loglu **Sandbox Simülasyon** kullanılır.

## Yönetim ve personel
- Bir ana yönetici.
- Personel hesaplarını yönetici oluşturur.
- Personel yönetici hesabı oluşturamaz ve kendi yetkisini değiştiremez.
- Yönetici personel erişimini iptal edebilir.
- Yetkiler modül bazlı (`RESERVATIONS`, `VEHICLES`, `HANDOVER_RETURN`, `CUSTOMERS`, `REPORTS`) atanır; personel yalnızca kendisine verilen işlemleri yapar.
- Önemli işlemler `AuditLogs` tablosunda loglanır.
- Yetkili personel ve yönetici araç teslim/iade işlemi yapabilir.

## Teslim ve iade
Teslim:
1. Müşteri seçilen şubeye gelir.
2. Personel rezervasyonu bulur.
3. Sistem şubedeki tam eşleşen ve uygun fiziksel araçları listeler (plaka yalnızca şube personeli ekranında ve teslim tutanağında görünür).
4. Müşteri uygun araçlardan birini seçer.
5. Personel teslim işlemini ve gerçek teslim saatini kaydeder.
6. Fiziksel araç kiralamayla ilişkilendirilir.

İade:
- Aynı şubede yapılır.
- Yetkili personel hasar, yakıt seviyesi, kilometre, genel durum ve gerçek iade tarih/saatini kaydeder.
- İade tamamlanana kadar araç uygun sayılmaz.
- Hasar varsa araç otomatik hizmet dışına çıkar; yönetici incelemesi gerekir.
- Bakım durumundaki araç kapasiteden çıkarılır.

## Raporlar
İstenen temel raporlar:
- Toplam rezervasyon sayısı
- **Finansal rapor:** Tahsilat tarihi bazında başarılı tahsilatlar, gerçekleşen iadeler ve net tahsilat (başarılı tahsilatlar eksi gerçekleşen iadeler). Vergi, sağlayıcı komisyonu ve muhasebe anlamında net kâr hesabı ilk sürüm kapsamı dışındadır.
- **Kiralama performans raporu:** Kiralama başlangıç tarihi bazında başlayan/tamamlanan kiralamalar ve bunlara bağlı rezervasyon tutarları; iptal ve iade kayıtları ayrıca gösterilir. Bu rapor muhasebe/vergisel gelir tablosu yerine geçmez.
- Kiradaki araçlar
- Müsait araçlar
- Bakımdaki araçlar
- İptal edilen rezervasyonlar
- Dashboard kartları ve grafikler

## Arayüz ve Marka Kimliği
- **Marka Adı:** `EAraç Kiralama`
- **Logo:** Koyu Lacivert (`#0F172A`) rozet içinde geometrik `EA` monogram SVG (`A` harfinin yatay çizgisi Kurumsal Mavi `#2563EB`); yanında `EA` (Kurumsal Mavi) + `raç` (Koyu Lacivert) ve altında ince `KİRALAMA` alt başlığı (`src/components/common/Logo.tsx`).
- **Renk Paleti:**
  - Ana Kurumsal Zemin: Koyu Lacivert (`#0F172A`)
  - Vurgu & Aksiyon: Kurumsal Mavi (`#2563EB` / `#1D4ED8`)
  - Çalışma Alanı / Arka Plan: Mat Slate (`#E5EBF2` / `#F8FAFC`)
  - Kartlar & Formlar: Temiz Beyaz (`#FFFFFF`) ve Nötr Slate (`#F8FAFC`)
- **%100 Doğal Türkçe Arayüz Kuralı:** Tüm menüler, butonlar, formlar, hata/bilgi mesajları, segment ve durum etiketleri (Ekonomik, Orta, Premium, Müsait, Hazırlıkta vb.) kullanıcıya ve personele daima doğal Türkçe olarak sunulur; ham teknik enum terimleri arayüze sızdırılmaz.
- **Tasarım:** Modern, sade, profesyonel, mobil ve masaüstü tam responsive arayüz.
- **Ana Sayfa:** Logo ve gezinme; şube, alış tarihi/saati ve iade tarihi arama alanı (24 saat kuralı ve saat eşitleme kilidi); segment ve filo özellikleri; güven rozetleri; şeffaf süreç adımları ve kurumsal footer.
