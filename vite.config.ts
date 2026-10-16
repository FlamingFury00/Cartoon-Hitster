/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// `base` is relative so the very same build works on GitHub Pages (sub-path), inside the
// Android WebView (local assets) and when opened from any static file server.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      disable: mode === 'android',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        id: './',
        name: 'Sigle in Fila',
        short_name: 'Sigle in Fila',
        description: 'Il gioco musicale delle sigle dei cartoni animati: ascolta, indovina l\'anno, mettile in fila!',
        lang: 'it',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#24135f',
        theme_color: '#24135f',
        categories: ['games', 'music', 'entertainment'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Audio previews are streamed from the music services and must never be cached here.
        runtimeCaching: [],
      },
    }),
  ],
  build: {
    target: 'es2020',
    cssTarget: 'chrome80',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 800,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
}));
