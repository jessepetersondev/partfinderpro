import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load env variables based on mode
  const env = loadEnv(mode, process.cwd(), '')
  console.log('🔧 Vite Config Debug:')
  console.log('Command:', command)
  console.log('Mode:', mode)
  console.log('Actual Mode:', env.NODE_ENV)
  console.log('VITE_OPENAI_API_KEY exists:', !!env.VITE_OPENAI_API_KEY)
  console.log('VITE_GOOGLE_PLACES_API_KEY exists:', !!env.VITE_GOOGLE_PLACES_API_KEY)
  
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

