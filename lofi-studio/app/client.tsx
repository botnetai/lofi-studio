import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/start'
import { router } from './router'
import './styles/globals.css'

hydrateRoot(
  document,
  <StrictMode>
    <StartClient router={router} />
  </StrictMode>
)