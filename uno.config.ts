import { defineConfig, presetUno, presetIcons, transformerDirectives } from 'unocss'

export default defineConfig({
  presets: [
    presetUno,
    presetIcons({
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
        'width': '1.2em',
        'height': '1.2em',
      },
      collections: {
        mdi: () => import('@iconify-json/mdi/icons.json').then(i => i.default),
        ob: () => import('./src/icons/index.cjs') as any,
      },
    }),
  ],
  transformers: [transformerDirectives()],
  content: {
    filesystem: [
      '!dist',
      '!node_modules',
      '**/*.ts',
      '**/*.tsx',
      '**/*.html',
    ],
  },
})
