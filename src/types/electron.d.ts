/**
 * Type declarations for Electron APIs exposed via contextBridge.
 * Only available when running in the Electron shell.
 */
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