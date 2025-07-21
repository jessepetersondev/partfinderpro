import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  console.log('🔧 Vite Config Debug:')
  console.log('Command:', command)
  console.log('Mode:', mode)
  console.log('Actual Mode:', 'production')
  console.log('NODE_ENV:', 'production')
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // GitHub Pages configuration - use root path for custom domain
    base: '/',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false
    },
    // Environment directory
    envDir: '.',
    // Environment file prefix
    envPrefix: ['VITE_', 'NODE_'],
  }
})

