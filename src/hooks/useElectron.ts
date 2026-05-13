/**
 * useElectron — React hook for accessing Electron APIs.
 *
 * Returns null when running in the browser (no Electron).
 * Returns the full ElectronAPI when running in Electron.
 *
 * Usage:
 *   const electron = useElectron()
 *   if (electron) {
 *     // We're in Electron
 *     await electron.setAlwaysOnTop(true)
 *   }
 */

import { useState, useEffect } from 'react'

export interface ElectronAPI {
  getAlwaysOnTop: () => Promise<boolean>
  setAlwaysOnTop: (pin: boolean) => Promise<void>
  enterPip: () => void
  onTrackingToggle: (callback: (tracking: boolean) => void) => () => void
  notifyTrackingStateChanged: (tracking: boolean) => void
  getPlatform: () => Promise<string>
  getAppVersion: () => Promise<string>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export function useElectron(): ElectronAPI | null {
  const [api, setApi] = useState<ElectronAPI | null>(null)

  useEffect(() => {
    if (window.electronAPI) {
      setApi(window.electronAPI)
    }
  }, [])

  return api
}