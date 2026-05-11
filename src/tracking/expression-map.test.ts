import { describe, it, expect } from 'vitest'
import {
  ARKIT_TO_VRM,
  computeVRMExpressions,
  computeCompositeExpressions,
  filterNoise,
  EXPRESSION_THRESHOLD,
} from './expression-map'

describe('expression-map', () => {
  describe('ARKIT_TO_VRM mapping table', () => {
    it('maps all 52 ARKit blend shapes', () => {
      expect(Object.keys(ARKIT_TO_VRM)).toHaveLength(52)
    })

    it('maps blink expressions to VRM presets', () => {
      expect(ARKIT_TO_VRM.eyeBlinkLeft).toBe('blinkLeft')
      expect(ARKIT_TO_VRM.eyeBlinkRight).toBe('blinkRight')
    })

    it('maps gaze expressions to VRM look presets', () => {
      expect(ARKIT_TO_VRM.eyeLookDownLeft).toBe('lookDown')
      expect(ARKIT_TO_VRM.eyeLookDownRight).toBe('lookDown')
      // Inner gaze = toward nose: left eye inward = looking Right
      expect(ARKIT_TO_VRM.eyeLookInLeft).toBe('lookRight')
      expect(ARKIT_TO_VRM.eyeLookInRight).toBe('lookLeft')
    })

    it('maps jaw open to aa viseme', () => {
      expect(ARKIT_TO_VRM.jawOpen).toBe('aa')
    })

    it('maps smile to happy', () => {
      expect(ARKIT_TO_VRM.mouthSmileLeft).toBe('happy')
      expect(ARKIT_TO_VRM.mouthSmileRight).toBe('happy')
    })

    it('leaves composite-only blend shapes as empty string', () => {
      expect(ARKIT_TO_VRM.browInnerUp).toBe('')
      expect(ARKIT_TO_VRM.eyeWideLeft).toBe('')
      expect(ARKIT_TO_VRM.browOuterUpLeft).toBe('')
    })
  })

  describe('computeVRMExpressions', () => {
    it('maps a single blend shape directly', () => {
      const result = computeVRMExpressions({ eyeBlinkLeft: 0.8 })
      expect(result.blinkLeft).toBe(0.8)
    })

    it('accumulates multiple ARKit inputs into one VRM expression', () => {
      // Both mouthSmileLeft and mouthSmileRight map to 'happy'
      const result = computeVRMExpressions({
        mouthSmileLeft: 0.6,
        mouthSmileRight: 0.6,
      })
      // happy = 0.6 + 0.6 = 1.2, clamped to 1
      expect(result.happy).toBe(1)
    })

    it('computes surprised expression from composite inputs', () => {
      const result = computeVRMExpressions({
        browInnerUp: 0.5,
        jawOpen: 0.4,
        eyeWideLeft: 0.3,
        eyeWideRight: 0.3,
      })
      // surprised = 0.5*0.3 + 0.4*0.3 + 0.3*0.2 + 0.3*0.2 = 0.15 + 0.12 + 0.06 + 0.06 = 0.39
      expect(result.surprised).toBeCloseTo(0.39, 2)
    })

    it('computes relaxed expression from composite inputs', () => {
      const result = computeVRMExpressions({
        browOuterUpLeft: 0.5,
        browOuterUpRight: 0.5,
        eyeBlinkLeft: 0.1,
        eyeBlinkRight: 0.1,
      })
      // From composite: relaxed = 0.5*0.8 + (1-0.1)*0.1 + (1-0.1)*0.1 = 0.4 + 0.09 + 0.09 = 0.58
      expect(result.relaxed).toBeCloseTo(0.58, 2)
    })

    it('filters out noise below threshold', () => {
      const result = computeVRMExpressions({
        eyeBlinkLeft: 0.001, // Below threshold
        mouthSmileLeft: 0.05, // Above threshold
      })
      expect(result).not.toHaveProperty('blinkLeft')
      expect(result.happy).toBe(0.05)
    })

    it('clamps accumulated weights to 1', () => {
      const result = computeVRMExpressions({
        mouthSmileLeft: 0.8,
        mouthSmileRight: 0.8,
      })
      // happy = 0.8 + 0.8 = 1.6, clamped to 1
      expect(result.happy).toBe(1)
    })

    it('returns empty object for empty input', () => {
      const result = computeVRMExpressions({})
      expect(Object.keys(result)).toHaveLength(0)
    })

    it('returns empty object for all-zero input', () => {
      const result = computeVRMExpressions({
        eyeBlinkLeft: 0,
        jawOpen: 0,
        mouthSmileLeft: 0,
      })
      expect(Object.keys(result)).toHaveLength(0)
    })

    it('maps frown to sad', () => {
      const result = computeVRMExpressions({ mouthFrownLeft: 0.5 })
      expect(result.sad).toBe(0.5)
    })

    it('maps angry from brow down', () => {
      const result = computeVRMExpressions({ browDownLeft: 0.7 })
      expect(result.angry).toBe(0.7)
    })

    it('maps funnel to ou viseme', () => {
      const result = computeVRMExpressions({ mouthFunnel: 0.6 })
      expect(result.ou).toBe(0.6)
    })

    it('handles angry accumulated from nose sneer', () => {
      const result = computeVRMExpressions({
        noseSneerLeft: 0.4,
        noseSneerRight: 0.4,
      })
      expect(result.angry).toBe(0.8)
    })
  })

  describe('computeCompositeExpressions', () => {
    it('computes surprised from browInnerUp, jawOpen, eyeWide', () => {
      const result = computeCompositeExpressions({
        browInnerUp: 0.5,
        jawOpen: 0.5,
        eyeWideLeft: 0.5,
        eyeWideRight: 0.5,
      })
      // surprised = 0.5*0.3 + 0.5*0.3 + 0.5*0.2 + 0.5*0.2 = 0.15+0.15+0.1+0.1 = 0.5
      expect(result.surprised).toBeCloseTo(0.5, 2)
    })

    it('computes relaxed from browOuterUp and inverse blink', () => {
      const result = computeCompositeExpressions({
        browOuterUpLeft: 0.5,
        browOuterUpRight: 0.5,
        eyeBlinkLeft: 0.0,
        eyeBlinkRight: 0.0,
      })
      // browOuterUp = (0.5+0.5)/2 = 0.5 > 0, so:
      // relaxed = 0.5*0.8 + (1-0)*0.1 + (1-0)*0.1 = 0.4 + 0.1 + 0.1 = 0.6
      expect(result.relaxed).toBeCloseTo(0.6, 2)
    })

    it('returns zero for both composites when all inputs are zero', () => {
      const result = computeCompositeExpressions({})
      expect(result.surprised).toBe(0)
      expect(result.relaxed).toBe(0)
    })
  })

  describe('gaze mapping direction correctness', () => {
    it('maps eyeLookInLeft to lookRight (inner gaze toward nose = right look)', () => {
      expect(ARKIT_TO_VRM.eyeLookInLeft).toBe('lookRight')
    })

    it('maps eyeLookInRight to lookLeft (inner gaze toward nose = left look)', () => {
      expect(ARKIT_TO_VRM.eyeLookInRight).toBe('lookLeft')
    })

    it('maps eyeLookOutLeft to lookLeft (outer gaze away from nose = left look)', () => {
      expect(ARKIT_TO_VRM.eyeLookOutLeft).toBe('lookLeft')
    })

    it('maps eyeLookOutRight to lookRight (outer gaze away from nose = right look)', () => {
      expect(ARKIT_TO_VRM.eyeLookOutRight).toBe('lookRight')
    })
  })

  describe('missing blend shape mappings', () => {
    it('maps mouthWideLeft to happy', () => {
      const result = computeVRMExpressions({ mouthWideLeft: 0.5 })
      expect(result.happy).toBeDefined()
      expect(result.happy!).toBeGreaterThan(0)
    })

    it('maps mouthWideRight to happy', () => {
      const result = computeVRMExpressions({ mouthWideRight: 0.5 })
      expect(result.happy).toBeDefined()
      expect(result.happy!).toBeGreaterThan(0)
    })
  })

  describe('relaxed expression does not leak at neutral', () => {
    it('returns zero relaxed when all inputs are zero', () => {
      const result = computeVRMExpressions({})
      // relaxed should never appear from zero inputs
      expect(result.relaxed).toBeUndefined()
    })

    it('returns zero relaxed when only blink is present (no brow raise)', () => {
      const result = computeVRMExpressions({ eyeBlinkLeft: 0.3, eyeBlinkRight: 0.3 })
      // With eyes closed but no brow raise, relaxed should not activate
      expect(result.relaxed).toBeUndefined()
    })

    it('returns relaxed when brow is actually raised', () => {
      const result = computeVRMExpressions({ browOuterUpLeft: 0.5, browOuterUpRight: 0.5 })
      expect(result.relaxed).toBeGreaterThan(0)
    })
  })

  describe('filterNoise', () => {
    it('removes values below default threshold', () => {
      const result = filterNoise({ happy: 0.5, sad: 0.01, angry: 0.03 })
      expect(result.happy).toBe(0.5)
      expect(result).not.toHaveProperty('sad')
      expect(result.angry).toBe(0.03)
    })

    it('removes values below custom threshold', () => {
      const result = filterNoise({ happy: 0.1, sad: 0.05 }, 0.06)
      expect(result.happy).toBe(0.1)
      expect(result).not.toHaveProperty('sad')
    })

    it('returns empty for all-noise input', () => {
      const result = filterNoise({ a: 0.001, b: 0.005, c: 0.015 })
      expect(Object.keys(result)).toHaveLength(0)
    })

    it('preserves exact threshold values', () => {
      const result = filterNoise({ happy: EXPRESSION_THRESHOLD })
      expect(result.happy).toBe(EXPRESSION_THRESHOLD)
    })
  })
})