import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Generates the PWA icons (192/512/maskable/apple) from public/favicon.svg:  npm run icons
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#0f1015' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#0f1015' } },
  },
  images: ['public/favicon.svg'],
});
