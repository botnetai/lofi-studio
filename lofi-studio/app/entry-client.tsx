import { hydrateRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/start'
import { router } from './router'

hydrateRoot(document.getElementById('root')!, <StartClient router={router} />)