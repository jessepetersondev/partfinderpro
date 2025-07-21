import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

export default defineConfig(({ command, mode }) => {
  // Load env variables
  const env = loadEnv(mode, process.cwd(), '')

  // Log for debug
  console.log('🔧 Vite Config Debug:')
  console.log('Command:', command)
  console.log('Mode:', mode)
  console.log('VITE_OPENAI_API_KEY exists:', !!env.VITE_OPENAI_API_KEY)
  console.log('VITE_GOOGLE_PLACES_API_KEY exists:', !!env.VITE_GOOGLE_PLACES_API_KEY)

  // Convert env variables into proper define entries
  const defineEnv = {}
  for (const key of Object.keys(env)) {
    if (key.startsWith('VITE_')) {
      defineEnv[`import.meta.env.${key}`] = JSON.stringify(env[key])
    }
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    base: '/',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false
    },
    envDir: '.',
    envPrefix: ['VITE_', 'NODE_'],
    define: defineEnv,  // <--- This injects the variables properly!
  }
})
