import { createStartHandler, defaultStreamHandler } from '@tanstack/start/server'
import { getRouterManifest } from '@tanstack/start/router-manifest'

import { router } from './router'

export default createStartHandler({
  router,
  getRouterManifest,
})(defaultStreamHandler)