import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PredictionRecord } from '@/types'

interface SettingsState {
  sidebarCollapsed: boolean
  pollInterval: number
  mockMode: boolean
  predictions: PredictionRecord[]
  selectedPrediction: PredictionRecord | null
  toggleSidebar: () => void
  setPollInterval: (ms: number) => void
  setMockMode: (enabled: boolean) => void
  addPrediction: (p: PredictionRecord) => void
  addPredictions: (p: PredictionRecord[]) => void
  selectPrediction: (p: PredictionRecord | null) => void
  clearPredictions: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      pollInterval: 5000,
      mockMode: false,
      predictions: [],
      selectedPrediction: null,

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setPollInterval: (ms) => set({ pollInterval: ms }),
      setMockMode: (enabled) => set({ mockMode: enabled }),
      addPrediction: (prediction) =>
        set((state) => ({
          predictions: [prediction, ...state.predictions].slice(0, 500),
        })),
      addPredictions: (predictions) =>
        set((state) => ({
          predictions: [...predictions, ...state.predictions].slice(0, 500),
        })),
      selectPrediction: (prediction) => set({ selectedPrediction: prediction }),
      clearPredictions: () => set({ predictions: [], selectedPrediction: null }),
    }),
    {
      name: 'sentinel-settings',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        pollInterval: state.pollInterval,
        mockMode: state.mockMode,
        predictions: state.predictions.slice(0, 100),
      }),
    }
  )
)