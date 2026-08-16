import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kairosphere.app',
  appName: 'Kairosphere',
  webDir: 'dist',
  server: {
    // Allow loading external resources (map tiles, APIs, images)
    androidScheme: 'https',
  },
  plugins: {
    StatusBar: {
      // Transparent status bar for edge-to-edge rendering
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#00000000',
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#050505',
      showSpinner: false,
    },
  },
};

export default config;
