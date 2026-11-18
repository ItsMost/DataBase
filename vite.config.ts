import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // A production build without the Supabase settings would ship an app that cannot sync.
  // Fail the build instead, so the version that is already live stays online.
  if (command === 'build') {
    const env = { ...process.env, ...loadEnv(mode, process.cwd(), 'VITE_') };
    const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter(k => !env[k]);
    if (missing.length > 0) {
      throw new Error(
        `Missing environment variables: ${missing.join(', ')}. ` +
          'Add them in Vercel (Project → Settings → Environment Variables) or in .env.local. See README.',
      );
    }
  }

  return {
    plugins: [
      react(),
      VitePWA({
        // New versions wait until the coach taps "تحديث" (no reload in the middle of work)
        registerType: 'prompt',
        includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
        manifest: {
          name: 'Gym Solo - حسابات المدرب',
          short_name: 'Gym Solo',
          description: 'حسابات المدرب: اللاعيبة والاشتراكات والفلوس، وبيشتغل من غير نت',
          lang: 'ar',
          dir: 'rtl',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#0f1015',
          theme_color: '#0f1015',
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // App files are stored on the phone so it opens without internet
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
          navigateFallback: '/index.html',
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              // Arabic font (Cairo)
              urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts',
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
          // Supabase calls are never cached: data lives in Dexie on the phone
        },
      }),
    ],
  };
});
