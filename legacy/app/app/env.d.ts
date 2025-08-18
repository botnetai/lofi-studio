/// <reference types="@cloudflare/workers-types" />

declare global {
  interface Env {
    R2: R2Bucket
    AI: any
    GOAPI_KEY: string
    UDIOAPI_KEY: string
  }
}

export {}