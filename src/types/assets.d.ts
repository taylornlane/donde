/**
 * Metro resolves these at bundle time; TypeScript needs telling they exist.
 * `.geojson` and `.db` are registered as asset extensions in metro.config.js and
 * resolve to a module id that expo-asset turns into a local file URI.
 */
declare module '*.css';
declare module '*.geojson' {
  const asset: number;
  export default asset;
}
declare module '*.db' {
  const asset: number;
  export default asset;
}
