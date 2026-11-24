# Play Store'a yükleme rehberi

Oyun teknik olarak hazır. Bu rehber, Play Console'da senin yapman gereken adımları sırasıyla anlatıyor.

## Hazır olanlar

| | Durum |
|---|---|
| Hedef API | Android 16 (API 36), Play'in şu anki kuralı |
| Paket | `release/KediKacisi-1.0.0.aab`, yükleme anahtarıyla imzalı |
| Paket adı | `com.kedikacisi.game` (ilk yüklemeden sonra **asla değişmez**) |
| Sürüm | 1.0.0 (versionCode 10) |
| Reklam | AdMob ödüllü ve geçiş reklamları, Google'ın AB onay formuyla birlikte. **Şimdilik test kimlikleriyle geliyor.** |
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
1. `docs/privacy-policy.html` dosyasında `[E-POSTA ADRESİNİZ]` ve `[YOUR EMAIL ADDRESS]` yerine iletişim e-postanı yaz.
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

## 4. Uygulamayı oluştur
Play Console → **Uygulama oluştur**:
- Uygulama adı: `Cat Escape: Logic Puzzle`
- Varsayılan dil: English (United States)
- Uygulama mı oyun mu: **Oyun**
- Ücretsiz mi ücretli mi: **Ücretsiz**

Sonra **Kontrol paneli → Uygulamanızı ayarlayın** listesini doldur:

| Bölüm | Cevap |
|---|---|
| Uygulama erişimi | Tüm işlevler kısıtlama olmadan kullanılabilir (giriş yok) |
| Reklamlar | **Evet, uygulamam reklam içeriyor** |
| İçerik derecelendirmesi | Anket: kategori **Oyun**. Şiddet, korku, kumar, kullanıcı etkileşimi, konum paylaşımı, dijital satın alma: **hepsi Hayır**. Beklenen sonuç: PEGI 3 / Everyone |
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

## 5. Kapalı test (14 günlük sayaç)
1. **Test → Kapalı test → Kanal oluştur**.
2. Test kullanıcıları: en az **12 kişinin** Gmail adresini ekle (aile, arkadaş, test grupları).
3. **Yeni sürüm oluştur → `release/KediKacisi-1.0.0.aab` dosyasını yükle**.
   - İlk yüklemede **Play Uygulama İmzalama**'yı kabul et (önerilen). Google son imzayı kendisi atar, bizim anahtarımız yükleme anahtarı olarak kalır.
   - Sürüm notu: "İlk test sürümü / First test build".
4. İncelemeye gönder. Onay gelince test kullanıcılarına katılım linkini gönder. **12 kişi katılıp 14 gün boyunca kalmalı.** Arada oynamaları ve geri bildirim vermeleri iyi olur, Google etkileşime de bakıyor.
5. 14 gün dolunca **Production erişimi için başvur**.

## 6. Production
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

1. `android/app/build.gradle` içinde `versionCode`'u 1 artır (10 → 11), `versionName`'i güncelle.
2. `npm run release` komutunu çalıştır.
3. Çıktılar:
   - `android/app/build/outputs/bundle/release/app-release.aab` (Play'e yüklenecek olan)
   - `android/app/build/outputs/apk/release/app-release.apk` (telefona doğrudan kurmak için)
