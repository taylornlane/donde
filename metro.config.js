const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drizzle emits migrations as .sql files that babel-plugin-inline-import inlines
// into the bundle, so Metro has to treat them as source rather than ignore them.
config.resolver.sourceExts.push('sql');

// The prebuilt catalogue and the country polygons ship as binary assets rather than
// as importable modules: MapLibre parses the GeoJSON natively from a file URI, which
// keeps a megabyte of geometry out of the JS bundle and off the startup path.
config.resolver.assetExts.push('db', 'geojson');

module.exports = config;
