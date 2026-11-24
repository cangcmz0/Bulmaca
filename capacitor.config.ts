import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // The Play Store package name. It can never change after the first upload.
  appId: 'com.kedikacisi.game',
  appName: 'Cat Escape',
  webDir: 'dist',
  android: { backgroundColor: '#ffd2b3' },
  plugins: {
    // Edge-to-edge (required from Android 15): Capacitor passes the system bar sizes to CSS.
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover' },
  },
};

export default config;
