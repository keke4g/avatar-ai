import type { CapacitorConfig } from '@capacitor/cli';

const appUrl = process.env.CAPACITOR_SERVER_URL?.trim() || 'https://towersmexico.com';

const config: CapacitorConfig = {
  appId: 'com.towersmexico.app',
  appName: 'Towers México',
  webDir: 'mobile-shell',
  appendUserAgent: ' TowersMexicoApp/0.1.5',
  backgroundColor: '#071827',
  loggingBehavior: 'debug',
  server: {
    // Temporary delivery architecture: the current Next.js application needs
    // its Vercel runtime, dynamic routes, and server-side API handlers.
    url: appUrl,
    cleartext: appUrl.startsWith('http://'),
    errorPath: 'offline.html',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#071827',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['sound', 'alert'],
    },
  },
};

export default config;
