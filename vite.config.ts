import solidPlugin from 'vite-plugin-solid';
import { VitePWA } from 'vite-plugin-pwa'
import devtools from 'solid-devtools/vite'
import UnoCSS from 'unocss/vite'
import monacoEditorPlugin from 'vite-plugin-monaco-editor';
import { defineConfig } from "vite";

const MonacoPlugin = (monacoEditorPlugin as any).default as typeof monacoEditorPlugin

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
      },
      includeAssets: ['favicon.png'],
      manifest: {
        name: 'OneBox',
        description: 'Draft book for Developers',
        theme_color: '#333333',
        icons: [{ src: "./favicon.png", sizes: '512x512', type: 'image/png' }],
      },
    }),
    devtools({
      autoname: true, // e.g. enable autoname
    }),
    solidPlugin({}),
    UnoCSS(),
    MonacoPlugin({}),
  ],
  resolve: {
    alias: {
      '~/': __dirname + '/src/',
      'path': 'path-browserify',
    },
  },
  define: {
    'process.cwd': '(()=>"/")',
  },
});
