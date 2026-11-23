# Yol haritası

## ✅ v0.1: Oynanabilir çekirdek
- Seviye üretici ve çözücü (sonsuz, her zaman çözülebilir seviyeler, zorluk eğrisi, şekilli tahtalar)
- Kedi çizimleri, animasyonlar (kaçış, çarpma, sersemleme, toz, konfeti), sentez sesler
- Canlar, ipucu, yıldızlar, kayıt, günün bulmacası ve seri
- Test reklam akışı (ödüllü reklam ve geçiş reklamı)
- Capacitor Android projesi (yalnızca dikey ekran)

## ⏭ v0.2: Mağazaya hazırlık
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
