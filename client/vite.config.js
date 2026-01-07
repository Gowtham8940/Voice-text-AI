import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const fixOnnxRuntimeWeb = () => ({
  name: 'fix-onnxruntime-web',
  resolveId(id) {
    if (id === 'onnxruntime-web/wasm') {
      return path.resolve(__dirname, 'node_modules/onnxruntime-web/dist/ort.wasm.min.mjs')
    }
    if (id === 'onnxruntime-web') {
      return path.resolve(__dirname, 'node_modules/onnxruntime-web/dist/ort.min.mjs')
    }
    return null
  }
})

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: false,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  optimizeDeps: {
    exclude: ['@ricky0123/vad-react', 'onnxruntime-web']
  }
})
