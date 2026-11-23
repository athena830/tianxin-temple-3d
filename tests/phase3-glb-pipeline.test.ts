import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { readFileSync, existsSync } from 'node:fs'
import { Assets } from '../src/engine/assets'

describe('Phase 3 Stage 1.5 GLB Asset Pipeline & Shared Resource Disposal Verification', () => {
  it('verifies test_blender.glb exists, has valid glTF 2.0 binary header, and embeds Khronos glTF Blender I/O generator metadata', () => {
    const glbPath = 'public/assets/models/test_blender.glb'
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

    // Parse JSON chunk (Chunk 0) to verify genuine Blender export signature
    const jsonChunkLength = buffer.readUInt32LE(12)
    const jsonChunkType = buffer.readUInt32LE(16)
    expect(jsonChunkType).toBe(0x4e4f534a) // 'JSON' in ASCII
    const jsonText = buffer.subarray(20, 20 + jsonChunkLength).toString('utf8')
    const gltfJson = JSON.parse(jsonText)

    expect(gltfJson.asset?.version).toBe('2.0')
    expect(gltfJson.asset?.generator).toMatch(/Blender/i)
  })

  it('verifies Assets class gltf() memoization cache and error clearing', async () => {
    const assets = new Assets()

    let loadCallCount = 0
    const mockGltf = { scene: new THREE.Group() } as unknown
    ;(assets as unknown as { gltfLoader: { loadAsync: (u: string) => Promise<unknown> } }).gltfLoader.loadAsync = async (url: string) => {
      loadCallCount++
      if (url.includes('fail')) throw new Error('File not found')
      return mockGltf
    }

    const p1 = assets.gltf('/assets/models/test.glb')
    const p2 = assets.gltf('/assets/models/test.glb')

    expect(p1).toBe(p2)
    const res1 = await p1
    const res2 = await p2
    expect(res1).toBe(mockGltf)
    expect(res2).toBe(mockGltf)
    expect(loadCallCount).toBe(1)

    let failed = false
    try {
      await assets.gltf('fail.glb')
    } catch {
      failed = true
    }
    expect(failed).toBe(true)
    expect((assets as unknown as { cache: Map<string, unknown> }).cache.has('fail.glb')).toBe(false)
  })

  it('verifies multi-instance shared resources: unloading instance 1 keeps instance 2 alive, unloading all disposes shared resources', async () => {
    const assets = new Assets()

    // Build mock GLTF scene with 2 meshes sharing 1 material and 2 geometries
    const templateScene = new THREE.Group()
    const sharedGeo1 = new THREE.BoxGeometry(1, 1, 1)
    const sharedGeo2 = new THREE.SphereGeometry(0.5, 12, 12)
    const sharedMat = new THREE.MeshStandardMaterial({ color: 0xc83828, metalness: 0.35, roughness: 0.25 })

    const meshA = new THREE.Mesh(sharedGeo1, sharedMat)
    meshA.name = 'Head'
    const meshB = new THREE.Mesh(sharedGeo2, sharedMat)
    meshB.name = 'Snout'
    templateScene.add(meshA, meshB)

    let disposedGeos = 0
    let disposedMats = 0
    sharedGeo1.addEventListener('dispose', () => { disposedGeos++ })
    sharedGeo2.addEventListener('dispose', () => { disposedGeos++ })
    sharedMat.addEventListener('dispose', () => { disposedMats++ })

    ;(assets as unknown as { gltfLoader: { loadAsync: () => Promise<unknown> } }).gltfLoader.loadAsync = async () => ({
      scene: templateScene,
    })

    const url = '/assets/models/shared_dragon_test.glb'
    const scene = new THREE.Scene()

    // 1. Acquire two instances sharing underlying BufferGeometries and Material
    const instance1 = await assets.acquireGltfInstance(url)
    const instance2 = await assets.acquireGltfInstance(url)
    instance2.scale.set(-1, 1, 1) // Mirrored instance
    scene.add(instance1, instance2)

    const inst1MeshA = instance1.children[0] as THREE.Mesh
    const inst2MeshA = instance2.children[0] as THREE.Mesh
    expect(inst1MeshA.geometry).toBe(inst2MeshA.geometry)
    expect(inst1MeshA.material).toBe(inst2MeshA.material)

    const initialStats = assets.getSharedStats(url)
    expect(initialStats.activeInstances).toBe(2)
    expect(initialStats.sharedGeometries).toBe(2)
    expect(initialStats.sharedMaterials).toBe(1)

    // 2. Unload Instance 1 — Instance 2 must remain in scene and shared resources MUST NOT be disposed
    const afterFirstRelease = assets.releaseGltfInstance(url, instance1)
    expect(afterFirstRelease.activeInstances).toBe(1)
    expect(afterFirstRelease.disposedGeometries).toBe(0)
    expect(afterFirstRelease.disposedMaterials).toBe(0)
    expect(disposedGeos).toBe(0)
    expect(disposedMats).toBe(0)

    // Verify Instance 1 removed from scene, Instance 2 still in scene with valid geometry attributes
    expect(scene.children.includes(instance1)).toBe(false)
    expect(scene.children.includes(instance2)).toBe(true)
    expect(inst2MeshA.geometry.attributes.position.count).toBeGreaterThan(0)

    // 3. Unload Instance 2 — All instances now unloaded, shared geometries & materials MUST be disposed
    const afterSecondRelease = assets.releaseGltfInstance(url, instance2)
    expect(afterSecondRelease.activeInstances).toBe(0)
    expect(afterSecondRelease.disposedGeometries).toBe(2)
    expect(afterSecondRelease.disposedMaterials).toBe(1)
    expect(disposedGeos).toBe(2)
    expect(disposedMats).toBe(1)
    expect(scene.children.includes(instance2)).toBe(false)
  })
})
