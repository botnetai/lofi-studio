import { defineConfig } from '@tanstack/start/config'
import { TanStackRouterVite } from '@tanstack/router-vite-plugin'

export default defineConfig({
  vite: {
    plugins: [
      TanStackRouterVite({
        routesDirectory: './app/routes',
        generatedRouteTree: './app/routeTree.gen.ts',
      }),
    ]
  },
  routers: {
    ssr: {
      entry: './app/ssr.tsx'
    },
    client: {
      entry: './app/client.tsx'
    }
  },
  server: {
    preset: 'static',
    output: {
      dir: './dist'
    }
  }
})