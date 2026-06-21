// Dynamic config so CI can inject baseUrl for GitHub Pages subpath (/Ruflo/)
// without breaking local development (where baseUrl must be empty).
const baseUrl = process.env.EXPO_BASE_URL ?? '';

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  name: 'WERKR',
  slug: 'werkr',
  version: '1.0.0',
  sdkVersion: '56.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'werkr',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#F5F4F0',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'de.werkr.app',
    infoPlist: {
      NSCameraUsageDescription:
        'WERKR benötigt Kamerazugriff für Fotos deiner Leistungen.',
      NSPhotoLibraryUsageDescription:
        'WERKR benötigt Zugriff auf deine Fotos für Profilbild und Auftragsdokumentation.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
      backgroundColor: '#F5F4F0',
    },
    predictiveBackGestureEnabled: false,
    allowBackup: false,
    package: 'de.werkr.app',
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/favicon.png',
    lang: 'de',
    backgroundColor: '#F5F4F0',
    meta: {
      description: 'WERKR — die Plattform für lokale Handwerksleistungen',
      'og:title': 'WERKR',
      'og:description': 'Handwerker finden & beauftragen — schnell, fair, rechtssicher.',
    },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-notifications',
      {
        icon: './assets/android-icon-monochrome.png',
        color: '#1C6B45',
        sounds: [],
        mode: 'production',
      },
    ],
  ],
  experiments: {
    baseUrl,
  },
  extra: {
    eas: {
      projectId: 'werkr-placeholder-replace-with-real-eas-id',
    },
  },
};
