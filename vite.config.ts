import solidPlugin from 'vite-plugin-solid';
import devtools from 'solid-devtools/vite'
import UnoCSS from 'unocss/vite'
import monacoEditorPlugin from 'vite-plugin-monaco-editor';
import { defineConfig } from "vite";

const MonacoPlugin = (monacoEditorPlugin as any).default as typeof monacoEditorPlugin

export default defineConfig({
  base: './',
  plugins: [
    devtools({
      autoname: true, // e.g. enable autoname
    }),
    solidPlugin({}),
    UnoCSS(),
    MonacoPlugin({})
  ],
  resolve: {
    alias: {
      '~/': __dirname + '/src/'
    }
  }
});
