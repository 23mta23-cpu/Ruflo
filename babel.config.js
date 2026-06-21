// babel.config.js — Expo SDK 56
// https://docs.expo.dev/versions/v56.0.0/config/babel/
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
