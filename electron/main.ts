/**
 * Webatar Electron Main Process
 *
 * Manages the application window, system tray, global shortcuts,
 * and virtual camera output for streaming.
 *
 * Architecture:
 *   - BrowserWindow loads the existing React app
 *   - IPC bridge exposes electron APIs to the renderer
 *   - System tray provides always-on-top toggle and tracking controls
 *   - Global shortcuts: Ctrl+Shift+T to toggle tracking
 *   - Virtual camera: captures canvas frames and pipes to v4l2loopback
 */

import { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, nativeImage, screen } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

// ─── Configuration ─────────────────────────────────────────────────────────────

const IS_DEV = !app.isPackaged
const WINDOW_TITLE = 'Webatar'
const WINDOW_WIDTH = 1280
const WINDOW_HEIGHT = 800
const MIN_WIDTH = 640
const MIN_HEIGHT = 480

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isAlwaysOnTop = false
let isTracking = false

// ─── Window Management ────────────────────────────────────────────────────────

function createWindow(): BrowserWindow {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize

  const win = new BrowserWindow({
    width: Math.min(WINDOW_WIDTH, screenWidth),
    height: Math.min(WINDOW_HEIGHT, screenHeight),
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: WINDOW_TITLE,
    backgroundColor: '#141311', // Warm dark background matches the design system
    show: false, // Show after ready-to-show to avoid flash
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Needed for IPC
    },
    // Frame configuration for clean editorial look
    titleBarStyle: 'default',
    trafficLightPosition: { x: 16, y: 16 },
  })

  // Load the app
  if (IS_DEV) {
    win.loadURL('http://localhost:3000')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Show window when content is ready
  win.once('ready-to-show', () => {
    win.show()
  })

  win.on('closed', () => {
    mainWindow = null
  })

  return win
}

// ─── System Tray ──────────────────────────────────────────────────────────────

function createTray(): Tray {
  // Create a simple tray icon (16x16 green circle for "tracking active")
  const icon = createTrayIcon(false)
  const trayInstance = new Tray(icon)
  trayInstance.setToolTip(WINDOW_TITLE)

  updateTrayMenu(trayInstance)

  return trayInstance
}

function createTrayIcon(active: boolean): Electron.NativeImage {
  // 16x16 pixel art icon - emerald dot when tracking, gray when idle
  const size = 16
  const buffer = Buffer.alloc(size * size * 4)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      // Simple circle mask
      const cx = x - size / 2 + 0.5
      const cy = y - size / 2 + 0.5
      const dist = Math.sqrt(cx * cx + cy * cy)

      if (dist < size / 2 - 1) {
        // Inner fill
        if (active) {
          // Emerald (#10b981)
          buffer[idx] = 0x10
          buffer[idx + 1] = 0xb9
          buffer[idx + 2] = 0x81
          buffer[idx + 3] = 0xff
        } else {
          // Gray (#8a8a90)
          buffer[idx] = 0x8a
          buffer[idx + 1] = 0x8a
          buffer[idx + 2] = 0x90
          buffer[idx + 3] = 0xff
        }
      } else if (dist < size / 2) {
        // Anti-aliased edge
        const alpha = Math.max(0, 1 - (dist - (size / 2 - 1)))
        if (active) {
          buffer[idx] = Math.round(0x10 * alpha)
          buffer[idx + 1] = Math.round(0xb9 * alpha)
          buffer[idx + 2] = Math.round(0x81 * alpha)
          buffer[idx + 3] = Math.round(0xff * alpha)
        } else {
          buffer[idx] = Math.round(0x8a * alpha)
          buffer[idx + 1] = Math.round(0x8a * alpha)
          buffer[idx + 2] = Math.round(0x90 * alpha)
          buffer[idx + 3] = Math.round(0xff * alpha)
        }
      } else {
        // Transparent
        buffer[idx] = 0
        buffer[idx + 1] = 0
        buffer[idx + 2] = 0
        buffer[idx + 3] = 0
      }
    }
  }

  return nativeImage.createFromBuffer(buffer, { width: size, height: size })
}

function updateTrayMenu(trayInstance: Tray): void {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Window',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      },
    },
    { type: 'separator' },
    {
      label: isTracking ? '⏹ Stop Tracking' : '▶ Start Tracking',
      click: () => {
        toggleTracking()
      },
    },
    {
      label: isAlwaysOnTop ? '📌 Unpin from Top' : '📌 Pin to Top',
      click: () => {
        toggleAlwaysOnTop()
      },
    },
    { type: 'separator' },
    {
      label: '🍿 Picture-in-Picture',
      click: () => {
        enterPiPMode()
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Webatar',
      click: () => {
        app.quit()
      },
    },
  ])

  trayInstance.setContextMenu(contextMenu)
}

function toggleTracking(): void {
  isTracking = !isTracking
  if (tray) {
    tray.setImage(createTrayIcon(isTracking))
    updateTrayMenu(tray)
  }
  if (mainWindow) {
    mainWindow.webContents.send('tracking-toggle', isTracking)
  }
}

function toggleAlwaysOnTop(): void {
  isAlwaysOnTop = !isAlwaysOnTop
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(isAlwaysOnTop, 'floating')
  }
  if (tray) {
    updateTrayMenu(tray)
  }
}

function enterPiPMode(): void {
  if (!mainWindow) return

  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize
  const pipWidth = 400
  const pipHeight = 500

  mainWindow.setBounds({
    x: screenWidth - pipWidth - 20,
    y: 20,
    width: pipWidth,
    height: pipHeight,
  })
  mainWindow.setAlwaysOnTop(true, 'floating')
  mainWindow.setResizable(true)
  isAlwaysOnTop = true
  if (tray) updateTrayMenu(tray)
}

// ─── Global Shortcuts ─────────────────────────────────────────────────────────

function registerShortcuts(): void {
  // Ctrl+Shift+T: Toggle tracking
  globalShortcut.register('CommandOrControl+Shift+T', () => {
    toggleTracking()
  })

  // Ctrl+Shift+P: Toggle always-on-top
  globalShortcut.register('CommandOrControl+Shift+P', () => {
    toggleAlwaysOnTop()
  })
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

function setupIPC(): void {
  // Renderer → Main: request always-on-top state
  ipcMain.handle('get-always-on-top', () => isAlwaysOnTop)

  // Renderer → Main: set always-on-top
  ipcMain.handle('set-always-on-top', (_event, pin: boolean) => {
    if (pin !== isAlwaysOnTop) {
      toggleAlwaysOnTop()
    }
  })

  // Renderer → Main: enter PiP mode
  ipcMain.on('enter-pip', () => {
    enterPiPMode()
  })

  // Renderer → Main: tracking state changed from renderer
  ipcMain.on('tracking-state-changed', (_event, state: boolean) => {
    isTracking = state
    if (tray) {
      tray.setImage(createTrayIcon(isTracking))
      updateTrayMenu(tray)
    }
  })

  // Renderer → Main: get platform info
  ipcMain.handle('get-platform', () => process.platform)

  // Renderer → Main: get app version
  ipcMain.handle('get-app-version', () => app.getVersion())
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  mainWindow = createWindow()
  tray = createTray()
  setupIPC()
  registerShortcuts()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    } else if (mainWindow) {
      mainWindow.show()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})