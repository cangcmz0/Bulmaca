# Kedi Kaçışı (Cat Escape)

A cute puzzle game for Android and the web. Each cat faces one direction. Tap a cat and it runs that way. If another cat is in the way it bumps and you lose a life, so you have to free the cats in the right order.

- **8000 levels, harder all the way:** a generator makes them and a solver checks every board is solvable. The same level number always gives the same board. Past 8000, Master Mode keeps generating at peak difficulty.
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

You need Android Studio (JDK 17 + Android SDK).

```bash
npm run android    # build, sync into android/, open Android Studio
```

In Android Studio, use **Build > Generate Signed App Bundle** to make the `.aab` for the Play Console.

## Project layout

| Path | What |
|---|---|
| `src/core/` | Pure game logic: level generator, solver, rules (unit tested) |
| `src/render/` | Canvas renderer, cat drawing, themes |
| `src/platform/` | Ads, audio, save data, the platform-specific parts |
| `src/main.ts` | Screens and game flow |
| `android/` | Capacitor Android project |

The steps to reach the Play Store are in [docs/ROADMAP.md](docs/ROADMAP.md).
