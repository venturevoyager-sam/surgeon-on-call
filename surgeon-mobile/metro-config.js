// surgeon-on-call/surgeon-mobile/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable package.json exports resolution — required for @supabase/supabase-js
// See: https://expo.dev/changelog/sdk-53 (known incompatibility)
config.resolver.unstable_enablePackageExports = false;

module.exports = config;