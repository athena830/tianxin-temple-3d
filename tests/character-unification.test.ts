import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createCharacter, CHIBI_PALETTES } from '../src/game/createCharacter'
import { PLAYER_TARGET_HEIGHT } from '../src/game/sceneConfig'

describe('Character Unification (createCharacter module)', () => {
  it('creates character matching PLAYER_TARGET_HEIGHT and grounded at y = 0', () => {
    const chibi = createCharacter({ palette: 'jade', targetHeight: PLAYER_TARGET_HEIGHT, groundY: 0 })
    expect(chibi).toBeDefined()
    expect(chibi.root).toBeDefined()

    chibi.root.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(chibi.root)
    const height = box.max.y - box.min.y

    expect(height).toBeCloseTo(PLAYER_TARGET_HEIGHT, 2)
    expect(box.min.y).toBeCloseTo(0, 2)
  })

  it('supports palette switching matching TempleWorld palettes', () => {
    const chibi = createCharacter({ palette: 'vermillion' })
    chibi.setPalette('moon')
    chibi.setPalette('scholar')
    chibi.setPalette('monk')
    expect(CHIBI_PALETTES.scholar).toBeDefined()
    expect(CHIBI_PALETTES.scholar.robe).toBe('#4e7284')
  })

  it('animates walking and idle without throwing errors', () => {
    const chibi = createCharacter()
    expect(() => {
      chibi.animate(0.016, 1.0, 0, false, 0)
      chibi.animate(0.016, 1.016, 2.5, false, 0)
      chibi.animate(0.016, 1.032, 0, false, 0.5)
    }).not.toThrow()
  })
})
