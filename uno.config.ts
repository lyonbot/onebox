import { defineConfig, presetUno, presetIcons, transformerDirectives } from 'unocss'

export default defineConfig({
  presets: [
    presetUno,
    presetIcons({
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
      collections: {
        mdi: () => import('@iconify-json/mdi/icons.json').then(i => i.default),
      }
    })
  ],
  transformers: [transformerDirectives()],
  content: {
    filesystem: [
      'src/**/*.tsx',
      'src/**/*.css',
      'src/**/*.scss',
      'public/*.html',
    ]
  }
})