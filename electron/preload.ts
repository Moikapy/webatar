/**
 * Webatar Electron Preload Script
 *
 * Safe IPC bridge between the renderer (React app) and the main process.
 * Only exposes specific APIs via contextBridge — no direct Node.js access.
 */

import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  getAlwaysOnTop: () => Promise<boolean>
  setAlwaysOnTop: (pin: boolean) => Promise<void>
  enterPip: () => void
  onTrackingToggle: (callback: (tracking: boolean) => void) => () => void
  notifyTrackingStateChanged: (tracking: boolean) => void
  getPlatform: () => Promise<string>
  getAppVersion: () => Promise<string>
}

const electronAPI: ElectronAPI = {
  getAlwaysOnTop: () => ipcRenderer.invoke('get-always-on-top'),
  setAlwaysOnTop: (pin: boolean) => ipcRenderer.invoke('set-always-on-top', pin),
  enterPip: () => ipcRenderer.send('enter-pip'),
  onTrackingToggle: (callback: (tracking: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, tracking: boolean) => callback(tracking)
    ipcRenderer.on('tracking-toggle', handler)
    return () => ipcRenderer.removeListener('tracking-toggle', handler)
  },
  notifyTrackingStateChanged: (tracking: boolean) => {
    ipcRenderer.send('tracking-state-changed', tracking)
  },
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)