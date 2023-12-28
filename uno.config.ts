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
        ob: () => import('./src/icons/index.cjs')
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