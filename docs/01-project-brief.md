# Proje Özeti – EAraç Kiralama Platformu

Proje Deposu: [earac-platform GitHub Deposu](https://github.com/altayenes/earac-platform)

## Amaç
Türkiye'de tek bir araç kiralama işletmesinin kendi filosu ve şubeleri için profesyonel, işlevsel ve responsive bir web platformu geliştirmek. Müşteri çevrimiçi rezervasyon ve ödeme (v1 yerelde sandbox/simülasyon) yapar; aracı işletmenin seçtiği şubeden teslim alır ve aynı şubeye iade eder.

Bu proje çok şirketli bir pazar yeri değildir; merkezi yönetim paneline sahip çok şubeli bir araç kiralama işletmesi platformudur. İlk aşama yerel geliştirme ve test içindir; herkese açık yayın veya ücretli bulut barındırma hedeflenmemektedir.

## Ürün hedefleri
- Misafir kullanıcı araç gruplarını, şubeleri ve günlük kiralama seçeneklerini inceleyebilir.
- Rezervasyon için müşteri hesabı ve telefon (SMS) doğrulaması gerekir.
- Rezervasyon ve ödeme akışı eşzamanlılık ve idempotency açısından güvenilir olmalıdır.
- Fiziksel araç/plaka internetten rezervasyon sırasında müşteriye atanmaz.
- Müşteri şubede tam eşleşen uygun fiziksel araçlardan birini seçer.
- Yönetici ve modül bazlı yetkilendirilmiş personel operasyonları yönetebilir.

## İlk sürüm (v1) kapsamı
- Müşteri kayıt/giriş (telefon + parola), SMS doğrulama (sandbox) ve hesap yönetimi
- Araç, marka/model, özellik (kasa/yakıt/vites), segment, şube ve fiyat yönetimi
- Tarih + planlanan alış saati aralığına göre kapasite/uygunluk kontrolü; 2 saatlik hazırlık tamponu, yarı açık zaman aralıkları ve geç iade yönetimi
- Rezervasyon, 15 dakikalık geçici kapasite blokesi (belirsiz ödeme sonucunda güvenli doğrulama/uzlaştırma), sandbox ödeme, iptal/iade ve değişiklik talebi
- Şubede araç teslim ve iade işlemleri (hasar, yakıt, km kontrolü)
- Tek Ana Yönetici + modül yetkili personel (RBAC) ve denetim kayıtları (`AuditLogs`)
- Yönetim paneli, finansal tahsilat/iade raporu ve kiralama performans raporu

## İlk sürüm dışında
- Çok şirketli araç kiralama pazaryeri (v2 değerlendirme konusu)
- Native mobil uygulama (responsive web ile karşılanır)
- Farklı şubeye iade
- Saatlik fiyatlandırma
- Araç fotoğrafları/açıklamaları/bagaj kapasitesi
- Ayrıntılı bakım takvimi ve atölye raporları
- Herkese açık üretim yayını ve ücretli hosting
