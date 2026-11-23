# Yol haritası

## ✅ v0.1: Oynanabilir çekirdek
- Seviye üretici ve çözücü (sonsuz, her zaman çözülebilir seviyeler, zorluk eğrisi, şekilli tahtalar)
- Kedi çizimleri, animasyonlar (kaçış, çarpma, sersemleme, toz, konfeti), sentez sesler
- Canlar, ipucu, yıldızlar, kayıt, günün bulmacası ve seri
- Test reklam akışı (ödüllü reklam ve geçiş reklamı)
- Capacitor Android projesi (yalnızca dikey ekran)

## ✅ v0.2: Sonsuz zorluk ve reklam anları
- **Sonsuz seviye:** zorluk sınırsız artıyor. Tahta 9×11'e kadar büyüyor, sonra "zincir" derinliği ve süre baskısı artmaya devam ediyor. Seviye 1.000.000 de üretilebiliyor.
- **Testere dişi zorluk:** her 10 seviye normal ×3, zor, normal ×2, zor, normal, kolay (nefes), boss şeklinde gidiyor.
- **Süre:** 25. seviyeden itibaren zor ve boss seviyelerde, 150. seviyeden itibaren tüm seviyelerde. Zamanla sıkılaşıyor, kedi başına en az ~1.7 sn kalıyor.
- **Ödüllü reklam anları:** +1 can, +30 sn, +2 ipucu, boss sonrası "3 katı ipucu", zor/boss seviyede 2 başarısızlıktan sonra "seviyeyi geç"
- **Geçiş reklamı düzeni** (`src/platform/monetization.ts`):
  - 10. seviyeden sonra başlıyor.
  - 40. seviyeye kadar 3 seviyede bir, sonra 2 seviyede bir. Baştan başlamalar da sayılıyor.
  - İki geçiş reklamı arasında en az 45 sn oluyor.
  - Ödüllü reklam izleyene 60 sn boyunca geçiş reklamı gösterilmiyor.

## ⏭ v0.3: Mağazaya hazırlık
- [ ] **AdMob:** `@capacitor-community/admob` eklentisi. `src/platform/ads.ts` içinde aynı arayüzü kullanan bir `AdMobAds` sınıfı yazılacak. Önce test ID'leri, sonra gerçek ID'ler. GDPR onayı için UMP kullanılacak.
- [ ] **"Reklamsız" satın alma:** Google Play Billing (`@capacitor-community/in-app-purchases` ya da RevenueCat)
- [ ] Android geri tuşu (`@capacitor/app`), titreşim (`@capacitor/haptics`)
- [ ] Uygulama ikonu ve açılış ekranı (`@capacitor/assets`)
- [ ] Seviye haritası ekranı ve oda (tema) geçişinde kısa bir kutlama
- [ ] Yeni öğeler: kutu (engel), uyuyan kedi (iki dokunuş), turuncu kedi (iki kare zıplar)
- [ ] Analitik: seviye başlama/bitirme/kaybetme olayları (Firebase Analytics). D1/D7 tutma oranını ölçmek için gerekli.

## 🚀 Yayın
1. Google Play Console hesabı ($25, tek seferlik). Yeni kişisel hesaplarda yayından önce **12 test kullanıcısıyla 14 gün kapalı test** zorunlu.
2. Gizlilik politikası sayfası (reklam olduğu için zorunlu)
3. Mağaza görselleri: 512px ikon, 1024×500 tanıtım görseli, en az 2 telefon ekran görüntüsü, 30 saniyelik oynanış videosu
4. İngilizce mağaza sayfası ile global yayın, ayrıca Türkçe yerelleştirme
5. Web sürümünü Poki / CrazyGames'e gönderme (ek gelir)
6. TikTok/Shorts için 15-30 saniyelik "%99 bunu çözemez" tarzı oynanış videoları
7. D1 > %35 ise yayıncılara CPI testi için gönderme (Voodoo, Homa, Azur, Supersonic)
