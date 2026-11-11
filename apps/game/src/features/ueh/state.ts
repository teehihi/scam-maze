// ORBITA · Reality Rewrite — máy trạng thái trung tâm (độc lập với store gốc, tích hợp an toàn).
import { useSyncExternalStore } from 'react'
import type { TrackId } from './tracks'

export type RPhase = 'idle' | 'ignite' | 'sweep' | 'active' | 'retract'

export interface RState {
  phase: RPhase
  track: TrackId | null
  switchSeq: number
  demo: boolean
  setPhase: (p: RPhase) => void
  set: (p: Partial<RState>) => void
}

let currentState: RState = {
  phase: 'active',
  track: 'mua-ha',
  switchSeq: 0,
  demo: true,
  setPhase: (phase: RPhase) => updateState({ phase }),
  set: (p: Partial<RState>) => updateState(p),
}

const listeners = new Set<() => void>()

function updateState(partial: Partial<RState>) {
  currentState = { ...currentState, ...partial }
  listeners.forEach((l) => l())
}

export function useReality<T = RState>(selector?: (s: RState) => T): T {
  const state = useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange)
      return () => {
        listeners.delete(onStoreChange)
      }
    },
    () => currentState,
    () => currentState
  )
  return selector ? selector(state) : (state as unknown as T)
}

useReality.getState = () => currentState

// dữ liệu thay đổi từng khung hình (không gây re-render React)
export const rt = {
  front: 999, // Mở hoàn toàn toàn bộ khuôn viên ngay từ đầu
  ignite: 0,
  flash: 0,
  presence: 0,
  grade: 0,
  rain: 0,
  wetness: 0,
  blossom: 0.5,
  wind: 0.25,
  suppressAutoPlay: false,
  t: 0,
  maxDt: 0.05,
  dbg: null as number | null,
}

export function requestReality(id: TrackId) {
  const s = useReality.getState()
  if (s.phase === 'ignite' || s.phase === 'retract') return
  if (s.phase === 'idle') {
    s.set({ track: id, phase: 'active' })
  } else if (s.track !== id) {
    s.set({ track: id, switchSeq: s.switchSeq + 1 })
  }
}

export function dismissReality() {
  const s = useReality.getState()
  if (s.phase === 'sweep' || s.phase === 'active') s.set({ phase: 'retract' })
}

if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__orbitaReality = { requestReality, dismissReality, rt, useReality }
}
