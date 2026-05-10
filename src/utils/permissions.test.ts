import { describe, it, expect, vi } from 'vitest'
import { stopStream, type CameraInfo, type PermissionState } from './permissions'

describe('permissions', () => {
  describe('stopStream', () => {
    it('stops all tracks in a stream', () => {
      const track1 = { stop: vi.fn(), kind: 'video', id: '1', label: '', enabled: true, muted: false, onmute: null, onunmute: null, onended: null, readyState: 'live' as MediaStreamTrackState, getSettings: () => ({}) }
      const track2 = { stop: vi.fn(), kind: 'video', id: '2', label: '', enabled: true, muted: false, onmute: null, onunmute: null, onended: null, readyState: 'live' as MediaStreamTrackState, getSettings: () => ({}) }
      const stream = { getTracks: () => [track1, track2], getAudioTracks: () => [], getVideoTracks: () => [track1, track2], active: true, id: 'stream-1', onaddtrack: null, onremovetrack: null } as unknown as MediaStream

      stopStream(stream)

      expect(track1.stop).toHaveBeenCalled()
      expect(track2.stop).toHaveBeenCalled()
    })
  })

  describe('CameraInfo type', () => {
    it('has required fields', () => {
      const info: CameraInfo = {
        deviceId: 'cam-1',
        label: 'Front Camera',
        kind: 'videoinput',
      }

      expect(info.deviceId).toBe('cam-1')
      expect(info.label).toBe('Front Camera')
      expect(info.kind).toBe('videoinput')
    })
  })

  describe('PermissionState type', () => {
    it('accepts valid states', () => {
      const states: PermissionState[] = ['granted', 'denied', 'prompt', 'unavailable']
      expect(states).toHaveLength(4)
    })
  })

  // Note: requestCameraPermission, listCameras, and checkCameraPermission
  // require browser APIs (navigator.mediaDevices) and are tested
  // in integration tests with Playwright, not in unit tests.
  // The pure logic (stopStream, type definitions) is tested here.
})