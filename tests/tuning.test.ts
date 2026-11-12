import { describe, expect, it } from 'vitest'
import { CONFIG } from '../src/game/config'
import { tuning } from '../src/game/tuning'

describe('temple tuning', () => {
  it('exposes walking and view controls only', () => {
    expect(tuning.controls.map(c => c.id)).toEqual(['player.walkSpeed', 'player.sprintSpeed', 'camera.fov'])
  })
  it('applies live values and rejects walk faster than brisk walk', () => {
    tuning.apply({ 'camera.fov': 70 })
    expect(CONFIG.camera.fov).toBe(70)
    expect(() => tuning.apply({ 'player.walkSpeed': 9 })).toThrow()
    tuning.apply({ 'camera.fov': 62 })
  })
})
