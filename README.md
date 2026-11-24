# Kedi Kaçışı (Cat Escape)

A cute puzzle game for Android and the web. Each cat faces one direction. Tap a cat and it runs that way. If another cat is in the way it bumps and you lose a life, so you have to free the cats in the right order.

- **40,000 levels, harder all the way:** a generator makes them and a solver checks every board is solvable. The same level number always gives the same board. Past 40,000, Master Mode keeps generating at peak difficulty.
- **No art or audio files:** the cats are drawn in code and the sounds are synthesised with WebAudio.
- **Monetisation is already in the game flow:** a rewarded ad gives a life or hints, and interstitials appear after level 10, at most every 3 levels. In the web build, ads are a test overlay.
- **Daily puzzle with streaks.** UI in Turkish and English, picked automatically.

## Development

```bash
npm install
npm run dev        # http://localhost:5173  (?level=37 jumps to a level, ?lang=en forces English)
npm test           # generator + rules tests
npm run build      # production web build in dist/
```

## Android

You need JDK 21 and the Android SDK (platform 36). The app targets Android 16 (API 36).

```bash
npm run android    # build, sync into android/, open Android Studio
npm run release    # signed release .aab + .apk (needs android/keystore.properties)
npm run set-admob -- <APP_ID> <REWARDED_ID> <INTERSTITIAL_ID>   # real AdMob IDs
```

Publishing steps (Play Console, AdMob, privacy policy, data safety) are in [docs/PLAY-STORE.md](docs/PLAY-STORE.md); store texts and graphics are in [store/](store/).

## Project layout

| Path | What |
|---|---|
| `src/core/` | Pure game logic: level generator, solver, rules (unit tested) |
| `src/render/` | Canvas renderer, cat drawing, themes |
| `src/platform/` | Ads, audio, save data, the platform-specific parts |
| `src/main.ts` | Screens and game flow |
| `android/` | Capacitor Android project |

The steps to reach the Play Store are in [docs/ROADMAP.md](docs/ROADMAP.md).
