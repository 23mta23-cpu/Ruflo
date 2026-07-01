// Dynamic config so CI can inject baseUrl for GitHub Pages subpath (/Ruflo/)
// without breaking local development (where baseUrl must be empty).
// app.json stays the single source of truth for all static config (plugins,
// permissions, privacy manifests, usage strings) — this file only injects
// the build-time baseUrl on top of it. A hand-duplicated partial copy here
// previously dropped the Stripe plugin, Android permissions, and iOS privacy
// manifests during native builds.
const { expo } = require('./app.json');

const baseUrl = process.env.EXPO_BASE_URL ?? '';

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  ...expo,
  experiments: {
    ...expo.experiments,
    baseUrl,
  },
};
