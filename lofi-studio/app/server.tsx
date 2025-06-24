import { createStartHandler, defaultStreamHandler } from '@tanstack/start/server'
import { getRouterManifest } from '@tanstack/start/router-manifest'
import { router } from './router'
import type { Env } from '../worker'

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return createStartHandler({
      router,
      request,
      context: { env, ctx }
    })(request, env)
  }
}

declare module '@tanstack/react-router' {
  interface RouterContext {
    env: Env
    ctx: ExecutionContext
  }
}