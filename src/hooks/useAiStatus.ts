import { useEffect, useState } from 'react'

import { api } from '../lib/api'

export type AiStatus = { configured: boolean; model: string; message: string }

let cache: AiStatus | null = null
let pending: Promise<AiStatus> | null = null

async function load(): Promise<AiStatus> {
  if (cache) return cache
  if (!pending) {
    pending = api
      .get<AiStatus>('/ai/status')
      .then((status) => {
        cache = status
        return status
      })
      .catch(() => {
        const fallback = { configured: false, model: '', message: 'Could not check AI availability.' }
        return fallback
      })
      .finally(() => {
        pending = null
      })
  }
  return pending
}

export function useAiStatus() {
  const [status, setStatus] = useState<AiStatus | null>(cache)
  useEffect(() => {
    let active = true
    void load().then((s) => {
      if (active) setStatus(s)
    })
    return () => {
      active = false
    }
  }, [])
  return status
}
