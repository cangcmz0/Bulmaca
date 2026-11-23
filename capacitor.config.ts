import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Change before the first Play Store upload; it can never change afterwards.
  appId: 'com.kedikacisi.game',
  appName: 'Kedi Kaçışı',
  webDir: 'dist',
  android: { backgroundColor: '#ffd2b3' },
};

export default config;
