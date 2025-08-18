import { createStartHandler } from '@tanstack/start/server'
import { router } from './router'

export default createStartHandler({ router })