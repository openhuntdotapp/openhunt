import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    cssCodeSplit: false,
    target: 'es2020',
    minify: 'esbuild',
    rollupOptions: {
      input: './src/main.tsx',
      output: {
        format: 'iife',
        entryFileNames: 'assets/index.js',
        assetFileNames: 'assets/index.[ext]',
        inlineDynamicImports: true
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
