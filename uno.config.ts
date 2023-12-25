import { defineConfig, presetUno, transformerDirectives } from 'unocss'

export default defineConfig({
  presets: [presetUno],
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