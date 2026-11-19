import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { planGuidePath } from '../src/game/temple-game'

describe('參拜指引自動行走路徑規劃 (planGuidePath)', () => {
  it('同在前庭近距離直接前往目的地', () => {
    const start = new THREE.Vector3(0, 0, 20)
    const dest = new THREE.Vector3(-10.4, 0, 30)
    const path = planGuidePath(start, dest)
    expect(path.length).toBe(1)
    expect(path[0].x).toBeCloseTo(dest.x)
    expect(path[0].z).toBeCloseTo(dest.z)
  })

  it('前庭前往昇龍觀音聖境會經由月亮門與松林小徑登階', () => {
    const start = new THREE.Vector3(0, 0, 24)
    const dest = new THREE.Vector3(-63.2, 0.545, 31)
    const path = planGuidePath(start, dest)
    expect(path.length).toBeGreaterThan(3)
    expect(path.some(p => Math.abs(p.x - -29.6) < 0.1 && Math.abs(p.z - 31) < 0.1)).toBe(true)
    expect(path.some(p => Math.abs(p.x - -55.5) < 0.1 && Math.abs(p.z - 31) < 0.1)).toBe(true)
    expect(path[path.length - 1].x).toBeCloseTo(dest.x)
  })

  it('前庭前往後殿凌霄寶殿會經由正殿與過水迴廊', () => {
    const start = new THREE.Vector3(2, 0, 20)
    const dest = new THREE.Vector3(0, 0, -23.5)
    const path = planGuidePath(start, dest)
    expect(path.some(p => Math.abs(Math.abs(p.x) - 5.85) < 0.1 && Math.abs(p.z - -14.55) < 0.1)).toBe(true)
    expect(path[path.length - 1].z).toBeCloseTo(-23.5)
  })

  it('後殿凌霄寶殿返回前庭會反向經由過水迴廊', () => {
    const start = new THREE.Vector3(-2, 0.28, -23.5)
    const dest = new THREE.Vector3(-10.4, 0, 30)
    const path = planGuidePath(start, dest)
    expect(path.some(p => Math.abs(p.x - -5.85) < 0.1 && Math.abs(p.z - -14.55) < 0.1)).toBe(true)
    expect(path[path.length - 1].x).toBeCloseTo(dest.x)
    expect(path[path.length - 1].z).toBeCloseTo(dest.z)
  })
})
