# Play Store'a yükleme rehberi

Oyun teknik olarak hazır. Bu rehber, Play Console'da senin yapman gereken adımları sırasıyla anlatıyor.

## Hazır olanlar

| | Durum |
|---|---|
| Hedef API | Android 16 (API 36), Play'in şu anki kuralı |
| Paket | `release/Patikac-1.3.0.aab`, yükleme anahtarıyla imzalı |
| Paket adı | `com.patikac.game` (ilk yüklemeden sonra **asla değişmez**) |
| Sürüm | 1.3.0 (versionCode 15) |
| Reklam | AdMob ödüllü ve geçiş reklamları, Google'ın AB onay formuyla birlikte. **Şimdilik test kimlikleriyle geliyor.** |
| Satın alma | Google Play Billing 9.1: 5 ürün, oyun içi mağaza ve satın alımların geri yüklenmesi |
| Simge, açılış ekranı, mağaza görselleri | `store/` klasöründe |
| Mağaza metinleri | `store/listing.md` (Türkçe ve İngilizce) |
| Gizlilik politikası | `docs/privacy-policy.html` |

> ⚠️ **Yükleme anahtarı:** `release/upload-keystore.jks` ve `release/KEYSTORE-BILGILERI.txt` git'te yok, sana ayrıca verildi. İkisini güvenli bir yere yedekle.

---

## 1. Geliştirici hesabı
1. https://play.google.com/console adresinden hesap aç (tek seferlik 25$).
2. Kimlik doğrulamasını tamamla (kimlik ve adres, birkaç gün sürebilir).
3. **Kişisel hesaplarda kural:** Production'a çıkmadan önce **en az 12 test kullanıcısıyla, aralıksız 14 gün kapalı test** zorunlu. Bu yüzden kapalı teste hemen başla (5. adım).

## 2. Gizlilik politikasını yayına al (GitHub Pages, ücretsiz)
1. İletişim e-postası (Gocmez@outlook.com.tr) gizlilik politikasına yazıldı. Play Console'daki iletişim e-postası da bununla aynı olmalı.
2. GitHub'da **cangcmz0/Bulmaca → Settings → Pages** sayfasını aç.
3. Source: **Deploy from a branch**. Branch olarak bu çalışmanın dalını (ya da `main`'e birleştirdiysen `main`'i) ve klasör olarak **/docs** seç, Save'e bas.
4. Birkaç dakika sonra adres hazır olur: `https://cangcmz0.github.io/Bulmaca/privacy-policy.html`
   Oyundaki **Ayarlar → Gizlilik politikası** butonu zaten bu adresi açıyor.

## 3. AdMob (gerçek reklam geliri için)
1. https://admob.google.com adresinden hesap aç, ödeme bilgilerini gir.
2. **Uygulamalar → Uygulama ekle → Android**. "Mağazada yayınlandı mı?" sorusuna şimdilik **Hayır** de, yayından sonra Play ile bağlarsın.
3. İki reklam birimi oluştur:
   - **Ödüllü (Rewarded)**: adı "rewarded" olabilir.
   - **Geçiş (Interstitial)**: adı "interstitial" olabilir.
4. **Gizlilik ve mesajlaşma → GDPR**: AB onay mesajı oluşturup bu uygulamaya bağla. Oyundaki onay formu buradan beslenir.
5. Kimlikleri oyuna tek komutla gir:
   ```bash
   npm run set-admob -- ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY ca-app-pub-XXXXXXXXXXXXXXXX/RRRRRRRRRR ca-app-pub-XXXXXXXXXXXXXXXX/IIIIIIIIII
   ```
   Sıra: uygulama kimliği (`~` içerir), ödüllü birim, geçiş birimi.
6. Yeni paketi derle (bunu ben de yapabilirim, kimlikleri göndermen yeter).
7. **Kendi reklamlarına asla tıklama.** AdMob hesabı kapanabilir. Test için telefonunu AdMob'da "test cihazı" olarak ekle.

> Test kimlikleriyle yayınlanan sürüm sadece "Test Ad" gösterir ve **para kazandırmaz.** Kapalı test için sorun değil. Production'dan önce gerçek kimliklerle yeniden derle.

## 4. Uygulama içi ürünler ve fiyatlar
Play Console → **Para kazanma → Ürünler → Uygulama içi ürünler → Ürün oluştur**. Bu menü, ilk AAB yüklendikten sonra açılır. Ürün kimlikleri koddakiyle **birebir aynı** olmalı:

| Ürün kimliği | Ad | Tür | Varsayılan fiyat (USD) | Türkiye fiyatı (elle gir) |
|---|---|---|---|---|
| `starter_pack` | Başlangıç Paketi: Reklamsız + 60 ipucu | Tek seferlik | **$3.99** | **₺99,99** |
| `remove_ads` | Reklamsız + 10 ipucu | Tek seferlik | **$2.99** | **₺79,99** |
| `hints_15` | 15 ipucu | Tek seferlik (oyun tekrar tekrar alınmasını sağlar) | **$0.99** | **₺24,99** |
| `hints_60` | 60 ipucu (en popüler) | Tek seferlik | **$2.99** | **₺69,99** |
| `hints_200` | 200 ipucu (en avantajlı) | Tek seferlik | **$6.99** | **₺159,99** |

**Nasıl girilir:**
1. Her ürün için varsayılan fiyatı **USD** olarak gir ve **"Döviz kurlarına göre diğer ülkelerin fiyatlarını ayarla"** seçeneğini kullan. Play diğer ülkeleri yerel alım gücüne göre otomatik fiyatlandırır.
2. Ardından **Türkiye** satırını bulup tablodaki TL fiyatını elle yaz. Otomatik çeviri kura bakar (~$1 = ₺50), bu da Türkiye için pahalı kalır.
3. Ürünü **Etkin** yap.

**Fiyatlar neden böyle:**
- **Reklamsız $2.99:** Türün ortası. Rakip bulmaca oyunlarında 2,99-4,99 $ arası en yaygın fiyat.
- **İpucu merdiveni:** Her paket bir öncekinden belirgin derecede ucuz (ipucu başına ~6,6 → 5,0 → 3,5 cent). Bu yüzden ortadaki "en popüler" paket doğal tercih oluyor.
- **Başlangıç paketi:** Reklamsız ve 60 ipucu ayrı ayrı $5.98 ediyor, pakette $3.99 (%33 indirim). Sadece en az 12 seviye geçmiş oyunculara, en fazla 3 günde bir, iki seviye arasında gösteriliyor.
- **Türkiye fiyatları:** Kurla çevrilmiş değerin yaklaşık yarısı. Örnek: $2.99 kurla ₺150 eder, biz ₺79,99 koyduk. Türk oyuncuların gerçekten ödediği seviye bu.
- **Tahmini net gelir:** Google ilk 1 milyon $'da %15 alır, Türkiye fiyatlarına %20 KDV dahildir. Yani ₺79,99'luk bir satıştan sana yaklaşık ₺56 kalır, ABD'deki $2.99'luk satıştan yaklaşık $2.54.
- **İpuçlarının değeri:** İpucu oyunda para gibi kullanılıyor: ipucu 1, geri alma 1, +1 can 1, +30 sn 1, hepsini uyandır 1, seviye geçme 3. Böylece paketlerin gerçek bir karşılığı var. Bedava kaynaklar da (günlük hediye, boss ödülü, ödüllü reklam) sürüyor, oyun parasız da oynanabiliyor.

> Fiyatı sonradan değiştirmek kolay ve uygulama güncellemesi gerektirmiyor. İlk birkaç haftanın satış verisine bakıp gerekirse ayarlarız.

## 5. Uygulamayı oluştur
Play Console → **Uygulama oluştur**:
- Uygulama adı: `Patikaç: Kedi Bulmacası` (Türkçe varsayılan) ya da `Patikaç: Cat Puzzle`
- Varsayılan dil: Türkçe (tr-TR). İngilizce'yi mağaza girişinde çeviri olarak ekle.
- Uygulama mı oyun mu: **Oyun**
- Ücretsiz mi ücretli mi: **Ücretsiz**

Sonra **Kontrol paneli → Uygulamanızı ayarlayın** listesini doldur:

| Bölüm | Cevap |
|---|---|
| Uygulama erişimi | Tüm işlevler kısıtlama olmadan kullanılabilir (giriş yok) |
| Reklamlar | **Evet, uygulamam reklam içeriyor** |
| İçerik derecelendirmesi | Anket: kategori **Oyun**. Şiddet, korku, kumar, kullanıcı etkileşimi, konum paylaşımı: **Hayır**. **Dijital ürün satın alma: Evet.** Beklenen sonuç: PEGI 3 / Everyone ("Uygulama içi satın alma" etiketiyle) |
| Hedef kitle | **13-15, 16-17, 18+** seç (13 yaş altını seçme, aksi halde Aile programının ek kuralları devreye girer). "Çocuklara istemeden hitap edebilir mi?" sorusunu dürüstçe cevapla. |
| Haber uygulaması | Hayır |
| Devlet uygulaması / sağlık / finans | Hayır |
| Veri güvenliği | Aşağıdaki tablo |
| Gizlilik politikası | 2. adımdaki URL |

### Veri güvenliği formu
Oyunun kendisi veri toplamıyor, ilerleme sadece cihazda duruyor. Ama **AdMob SDK veri topluyor**, o yüzden şunları beyan et:

- Veri topluyor veya paylaşıyor musunuz? **Evet**
- Aktarım sırasında şifreleniyor mu? **Evet**
- Kullanıcı veri silinmesini isteyebilir mi? Hesap olmadığı için: oyunu kaldırınca veriler silinir, reklam kimliği Android ayarlarından sıfırlanır.

| Veri türü | Toplanıyor | Paylaşılıyor | Amaç |
|---|---|---|---|
| Konum → Yaklaşık konum (IP'den) | Evet | Evet | Reklam, Analiz, Dolandırıcılık önleme |
| Uygulama etkinliği → Uygulama etkileşimleri | Evet | Evet | Reklam, Analiz |
| Uygulama bilgisi ve performans → Kilitlenme günlükleri, Teşhis | Evet | Evet | Analiz, Dolandırıcılık önleme |
| Cihaz veya diğer kimlikler (reklam kimliği) | Evet | Evet | Reklam, Analiz, Dolandırıcılık önleme |

Google'ın güncel resmi listesiyle karşılaştır: https://developers.google.com/admob/android/privacy/play-data-disclosure

Satın alımları Google Play kendisi işliyor. Oyun satın alma bilgisini bir sunucuya göndermiyor, sadece cihazda okuyor. Bu yüzden "Finansal bilgiler → Satın alma geçmişi" maddesi **toplanmıyor** olarak işaretlenir.

## 6. Kapalı test (14 günlük sayaç)
1. **Test → Kapalı test → Kanal oluştur**.
2. Test kullanıcıları: en az **12 kişinin** Gmail adresini ekle (aile, arkadaş, test grupları).
3. **Yeni sürüm oluştur → `release/Patikac-1.3.0.aab` dosyasını yükle**.
   - İlk yüklemede **Play Uygulama İmzalama**'yı kabul et (önerilen). Google son imzayı kendisi atar, bizim anahtarımız yükleme anahtarı olarak kalır.
   - Sürüm notu: "İlk test sürümü / First test build".
4. İncelemeye gönder. Onay gelince test kullanıcılarına katılım linkini gönder. **12 kişi katılıp 14 gün boyunca kalmalı.** Arada oynamaları ve geri bildirim vermeleri iyi olur, Google etkileşime de bakıyor.
5. 14 gün dolunca **Production erişimi için başvur**.

## 7. Production
1. Gerçek AdMob kimlikleriyle derlenmiş, versionCode'u artırılmış yeni AAB'yi yükle.
2. Mağaza girişini `store/listing.md` dosyasındaki metin ve görsellerle doldur.
3. Ülkeler: tüm ülkeler.
4. İncelemeye gönder (genelde 1-7 gün sürer).
5. Yayına çıkınca AdMob'da uygulamayı Play mağaza kaydıyla bağla.

---

## Yeni sürüm nasıl derlenir
Gereken: JDK 21, Android SDK (36), ve `android/keystore.properties` dosyası (şablon aşağıda). `release/` klasörünü projenin köküne koy.

```
storeFile=../../release/upload-keystore.jks
storePassword=<KEYSTORE-BILGILERI.txt içindeki şifre>
keyAlias=upload
keyPassword=<aynı şifre>
```

1. `android/app/build.gradle` içinde `versionCode`'u 1 artır (15 → 16), `versionName`'i güncelle.
2. `npm run release` komutunu çalıştır.
3. Çıktılar:
   - `android/app/build/outputs/bundle/release/app-release.aab` (Play'e yüklenecek olan)
   - `android/app/build/outputs/apk/release/app-release.apk` (telefona doğrudan kurmak için)
