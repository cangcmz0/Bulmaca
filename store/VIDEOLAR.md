# Tanıtım videoları

`node scripts/make-videos.cjs` ile oyunun kendisinden kaydedilir (1080×1920, 30 fps, H.264 + AAC). Çıktılar `store/videos/` klasörüne yazılır, git'te tutulmaz.

| Video | Süre | Fikir | Nerede kullanılır |
|---|---|---|---|
| `*-cornered.mp4` | ~17 sn | "Bunu çözebilir misin?" kancası, dikkatsiz hamleler, **Kıstırıldın!**, "Sen daha iyisini yapabilir misin?" meydan okuması | TikTok, Reels, Shorts reklamları (en iyi kanca) |
| `*-satisfying.mp4` | ~22 sn | Hızlı ve hatasız çözüm, yükselen kombolar, "Kusursuz!" | Organik paylaşım, "tatmin edici" içerik |
| `*-cats.mp4` | ~24 sn | Üç özel kedi tek tek: fırıldak, uykucu, korkak | Play mağaza tanıtım videosu, nasıl oynanır |

Her videonun Türkçe (`tr-`) ve İngilizce (`en-`) sürümü var. Ses: oyunun kendi müziği ve kedi sesleri, telif sorunu yok.

**İpuçları**
- **Play mağaza videosu:** Play doğrudan video dosyası kabul etmiyor, YouTube bağlantısı istiyor. `*-cats.mp4` dosyasını YouTube'a "Liste dışı" ya da herkese açık olarak yükleyip linkini mağaza girişine ekle.
- **TikTok/Reels:** İlk 2 saniye her şeydir. `cornered` videosu doğrudan soruyla açılıyor. Yayınlarken TikTok'un trend seslerinden birini de altına ekleyebilirsin.
- **Reklam politikası:** Videolarda uydurma istatistik yok ("%99 çözemez" gibi). Reklam platformları yanıltıcı iddiaları reddediyor.
