/**
 * Workbox config for PWA service worker - PRD: Service Worker for offline functionality.
 * Run after: npx expo export -p web
 */
module.exports = {
  globDirectory: 'dist/',
  globPatterns: [
    '**/*.{js,css,html,ico,png,json,ttf,woff,woff2,svg}',
    'index.html',
    'manifest.json',
  ],
  swDest: 'dist/sw.js',
  clientsClaim: true,
  skipWaiting: true,
};
