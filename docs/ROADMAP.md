# Yol haritası

## ✅ v0.1: Oynanabilir çekirdek
- Seviye üretici ve çözücü (sonsuz, her zaman çözülebilir seviyeler, zorluk eğrisi, şekilli tahtalar)
- Kedi çizimleri, animasyonlar (kaçış, çarpma, sersemleme, toz, konfeti), sentez sesler
- Canlar, ipucu, yıldızlar, kayıt, günün bulmacası ve seri
- Test reklam akışı (ödüllü reklam ve geçiş reklamı)
- Capacitor Android projesi (yalnızca dikey ekran)

## ✅ v0.2: Sonsuz zorluk ve reklam anları
- **8000 seviye** (v0.5'te 40.000 oldu): zorluk 8000. seviyeye kadar kesintisiz artıyor. Tahta ~150. seviyede 9×11'e ulaşıyor, sonra "zincir" derinliği (0.40 → 0.72) ve süre baskısı (kedi başına 4.2 sn → 1.6 sn) 8000'e kadar artıyor. 8000. seviye son boss.
- **Usta Modu:** 8000'i bitirene final ekranı çıkıyor, sonrasında seviyeler en yüksek zorlukta sonsuza dek devam ediyor.
- **Testere dişi zorluk:** her 10 seviye normal ×3, zor, normal ×2, zor, normal, kolay (nefes), boss şeklinde gidiyor.
- **Süre:** 25. seviyeden itibaren zor ve boss seviyelerde, 150. seviyeden itibaren tüm seviyelerde. Zamanla sıkılaşıyor, kedi başına en az ~1.7 sn kalıyor.
- **Ödüllü reklam anları:** +1 can, +30 sn, +2 ipucu, boss sonrası "3 katı ipucu", zor/boss seviyede 2 başarısızlıktan sonra "seviyeyi geç"
- **Geçiş reklamı düzeni** (`src/platform/monetization.ts`):
  - 10. seviyeden sonra başlıyor.
  - 40. seviyeye kadar 3 seviyede bir, sonra 2 seviyede bir. Baştan başlamalar da sayılıyor.
  - İki geçiş reklamı arasında en az 45 sn oluyor.
  - Ödüllü reklam izleyene 60 sn boyunca geçiş reklamı gösterilmiyor.

## ✅ v0.3: Kafa karıştıran kediler ve bitirme hissi
- 😴 **Uykucu kedi** (31. seviyeden): yönü gizli, dokununca bedavaya uyanır. Hafıza ister.
- 😰 **Korkak kedi** (51. seviyeden): baktığı yönün tersine kaçar.
- 🌀 **Fırıldak kedi** (81. seviyeden): her ~1.8 sn'de 90° döner (8000'e doğru ~1 sn'ye iner). Doğru anı yakalamak gerekir.
- Bu kedilerin oranı 8000'e kadar yavaş yavaş artıyor. Hiçbiri çözülebilir bir tahtayı çözülemez yapamıyor (testli).
- Her yeni kedi ilk çıktığında bir tanıtım kartı gösteriliyor.
- Yeni ödüllü reklam anı: "Hepsini uyandır"
- **Bitirme hissi:** "Süper/Muhteşem/Efsane xN" kombo yazıları, "Kusursuz!" ekranı (çift melodi, ekran parlaması, büyük konfeti), süre ve hata istatistiği

## ✅ v0.4: Daha iyi bulmacalar, nazik reklamlar, canlı giriş ekranı
- **Bulmaca kalitesi puanı:** başta çıkabilen kedi az, uzaktan gelen engeller çok. 3. seviyeden itibaren her tahta sertleştiriliyor. Test, 3-60 arasında hiçbir tahtanın kedilerinin %35'inden fazlasının başta çıkabilir olmadığını kontrol ediyor.
- Özel kediler daha erken geliyor: uykucu 12, korkak 22, fırıldak 35. Sertleştirmeden önce ekleniyorlar, böylece zinciri kısaltmıyorlar.
- Süre 20. seviyeden itibaren zor ve boss seviyelerde.
- **Reklamlar:**
  - Geçiş reklamı sadece kazandıktan sonra çıkıyor (kaybettikten sonra asla), 15. seviyeden itibaren.
  - 60. seviyeye kadar 4 kazanmada bir, sonra 3'te bir. İki geçiş reklamı arasında en az 2 dk oluyor.
  - Ödüllü reklam izleyen 3 dk boyunca geçiş reklamı görmüyor.
- Yeni isteğe bağlı reklam anları: günlük hediye (1 ipucu, reklamla 3), her 3 kazanmada bir "+1 ipucu"
- **Giriş ekranı:** dokunulabilir canlı kedi sahnesi (zıplama, kalpler, uyanan uykucu), boss'a kalan seviye çubuğu, yıldız sayacı, günlük hediye

## ✅ v0.5: Sıranın önemli olduğu gerçek bulmaca, 40.000 seviye
- **Sorun:** önü açık kediyi kaçırmak her zaman doğru hamleydi, yani hiç plan gerekmiyordu ve oyuncu hiçbir zaman sıkışmıyordu.
- **Çözüm:** 🌀 fırıldak kedi artık **herhangi bir kedi kaçtığında** 90° dönüyor. Yanlış sıra fırıldakları duvara çevirip oyuncuyu sıkıştırıyor. 8. seviyeden itibaren geliyor.
- Üretici her seviyede en az bir kazanan sıra kalmasını sağlıyor: o sıra kurulumdan geliyor ve çözücü de doğruluyor. Fırıldaklar, başka kedilerin yolunu en çok kapatan kedilerden seçiliyor.
- **Zorluk ölçüsü:** rastgele dokunan bir oyuncunun sıkışma oranı. Başta ~%20-30, 1000. seviyede ~%60-70, sonlara doğru %80-90.
- Çözücü (derinlik öncelikli arama, başarısız konumları hatırlıyor) ipucu verirken kazanan bir hamle buluyor. Oyun artık kazanılamayacak durumdaysa ipucu harcamak yerine bunu söylüyor.
- **Sıkışınca:** "Reklam izle, geri al". Oyun tek reklamla tekrar çözülebilir bir konuma geri dönüyor.
- **40.000 seviye**, zorluk eğrisi 40.000'e kadar yayıldı. Sonrasında Usta Modu var.

## ✅ v1.0.0: Play Store'a hazır
- Capacitor 8, Android 16 (API 36) hedefi (Play'in şu anki kuralı), edge-to-edge desteği
- Gerçek AdMob (ödüllü ve geçiş reklamları) ve Google UMP onay formu. Şimdilik test kimlikleriyle, gerçekleri `npm run set-admob` ile giriliyor.
- Simge, adaptif simge, açılış ekranı, mağaza görselleri ve ekran görüntüleri (TR/EN), hepsi oyunun kendi çiziminden üretildi
- Ayarlar: ses, titreşim, reklam gizlilik seçenekleri, gizlilik politikası, sürüm
- Android geri tuşu, yerel titreşim, arka plana alınınca sesin durması
- İmzalı AAB/APK, gizlilik politikası, mağaza metinleri, Play Console rehberi (`docs/PLAY-STORE.md`)

## ✅ v1.1.0: Uygulama içi satın alma
- Google Play Billing 9.1 (Play'in 8+ kuralını karşılıyor), `@capgo/native-purchases`
- 5 ürün: başlangıç paketi $3.99/₺99,99, reklamsız $2.99/₺79,99, ipucu paketleri $0.99-6.99 / ₺24,99-159,99
- Oyun içi mağaza, ipucuyla geri alma, can, süre, uyandırma ve seviye geçme, iki seviye arasında başlangıç paketi teklifi
- Reklamsız sürüm yeni telefonda veya yeniden kurulumda otomatik geri yükleniyor

## ✅ v1.2.0: Sesler, müzik, tanıtım videoları
- Her kedinin kendi sesi var: kaçarken mutlu miyav (kombolarda incelir), çarpınca somurtkan "mrrr" (formant sentezi, ses dosyası yok)
- Sakin lo-fi arka plan müziği (pad, bas, kalimba, shaker), her bölümde yeni melodi, ayarlarda ayrı açma/kapama
- Kombo yazıları ekran kenarından taşmıyor
- Tanıtım videoları (TR/EN, 1080×1920): `node scripts/make-videos.cjs`, ayrıntılar `store/VIDEOLAR.md`

## ✅ v1.2.1: Ses ayarı
- Dokununca sert "pıt" yerine hafif bir pati sesi var, miyav kedi tahtadan çıkarken duyuluyor
- Miyavlar daha doğal (açılıp kapanan ağız filtresi, yumuşak ses kaynağı, akıcı perde eğrisi), çarpma sesi yumuşadı
- Müzik daha sakin: 68 BPM, davul ve shaker yok, seyrek melodi ve hafif yankı, öncekinden ~8 dB kısık

## ✅ v1.3.0: Yeni isim ve yayın öncesi son inceleme
- **İsim: Patikaç** (paket: `com.patikac.game`). "Cat Escape" ve "Kedi Kaçışı" adları başka oyunlarda kullanılıyordu, Patikaç için aramada eşleşme çıkmadı.
- Reklam veya Google Play ödeme ekranı açıkken bölüm saati ve fırıldaklar duruyor
- Oyun sırasında satın alma yapılınca tema değişmiyor
- Bölüm bittikten hemen sonra çıkılınca geç gelen kazanma kartı çıkmıyor
- Gizlilik politikasına iletişim e-postası ve satın alma bölümü eklendi
- Mağaza görselleri, ekran görüntüleri ve videolar yeni isimle yeniden üretildi

## ⏭ Sonraki
- Analitik (Firebase): D1/D7 tutma oranı, seviye bazında takılma noktaları
- Uygulama içi değerlendirme isteği (In-App Review)
- Yerel bildirim: günlük hediye ve seri hatırlatması

## (eski) v0.6: Mağazaya hazırlık
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
