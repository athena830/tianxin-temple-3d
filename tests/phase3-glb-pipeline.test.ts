import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { readFileSync, existsSync } from 'node:fs'
import { Assets } from '../src/engine/assets'

describe('Phase 3 Stage 1.5 GLB Asset Pipeline Verification', () => {
  it('verifies test.glb exists and has valid glTF 2.0 binary header', () => {
    const glbPath = 'public/assets/models/test.glb'
    expect(existsSync(glbPath)).toBe(true)

    const buffer = readFileSync(glbPath)
    expect(buffer.length).toBeGreaterThan(1000)

    // Check glTF binary header: magic 0x46546C67 ("glTF" in ASCII), version 2
    const magic = buffer.readUInt32LE(0)
    const version = buffer.readUInt32LE(4)
    const length = buffer.readUInt32LE(8)

    expect(magic).toBe(0x46546c67) // 'glTF'
    expect(version).toBe(2)
    expect(length).toBe(buffer.length)
  })

  it('verifies Assets class gltf() memoization cache and error clearing', async () => {
    const assets = new Assets()

    // Mock gltfLoader.loadAsync
    let loadCallCount = 0
    const mockGltf = { scene: new THREE.Group() } as any
    ;(assets as any).gltfLoader.loadAsync = async (url: string) => {
      loadCallCount++
      if (url.includes('fail')) throw new Error('File not found')
      return mockGltf
    }

    // Call 1
    const p1 = assets.gltf('/assets/models/test.glb')
    // Call 2 (identical URL)
    const p2 = assets.gltf('/assets/models/test.glb')

    expect(p1).toBe(p2) // Same promise instance
    const res1 = await p1
    const res2 = await p2
    expect(res1).toBe(mockGltf)
    expect(res2).toBe(mockGltf)
    expect(loadCallCount).toBe(1) // LoadAsync called only once

    // Failure case: error should clear cache to allow retry
    let failed = false
    try {
      await assets.gltf('fail.glb')
    } catch {
      failed = true
    }
    expect(failed).toBe(true)
    expect((assets as any).cache.has('fail.glb')).toBe(false)
  })

  it('verifies model cloning, symmetrical mirroring (scale.x = -1), and deep resource disposal', () => {
    // Construct sample hierarchy simulating GLTF scene
    const root = new THREE.Group()
    const geo1 = new THREE.BoxGeometry(1, 1, 1)
    const mat1 = new THREE.MeshStandardMaterial({ color: 0xc83828, metalness: 0.35, roughness: 0.25 })
    const mesh1 = new THREE.Mesh(geo1, mat1)
    root.add(mesh1)

    // Test cloning
    const clone = root.clone(true)
    expect(clone.children.length).toBe(1)

    // Test mirroring for dragon symmetry
    clone.scale.set(-1, 1, 1)
    expect(clone.scale.x).toBe(-1)
    expect(clone.scale.y).toBe(1)
    expect(clone.scale.z).toBe(1)

    // Test clean disposal
    let disposedGeos = 0
    let disposedMats = 0
    geo1.addEventListener('dispose', () => { disposedGeos++ })
    mat1.addEventListener('dispose', () => { disposedMats++ })

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
        if (m.material) {
          if (Array.isArray(m.material)) m.material.forEach(mat => mat.dispose())
          else m.material.dispose()
        }
      }
    })

    expect(disposedGeos).toBe(1)
    expect(disposedMats).toBe(1)
  })
})
