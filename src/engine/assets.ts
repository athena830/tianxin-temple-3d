import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * Cached asset loading with one progress stream for the boot screen.
 *
 * The starter builds its world procedurally, so nothing is required here at boot. When adding
 * models or textures, put the files in `public/assets/` and preload them in `main.ts` with
 * `assets.gltf('assets/hero.glb')` before `game.start()` so the loading bar covers them.
 */
export interface SharedInstanceStats {
  activeInstances: number
  sharedGeometries: number
  sharedMaterials: number
  disposedGeometries: number
  disposedMaterials: number
}

interface ManagedGltfEntry {
  instances: Set<THREE.Object3D>
  geometries: Set<THREE.BufferGeometry>
  materials: Set<THREE.Material>
  disposedGeometries: number
  disposedMaterials: number
}

export class Assets {
  private readonly manager = new THREE.LoadingManager()
  private readonly gltfLoader = new GLTFLoader(this.manager)
  private readonly textureLoader = new THREE.TextureLoader(this.manager)
  private readonly cache = new Map<string, Promise<unknown>>()
  private readonly managedGltfs = new Map<string, ManagedGltfEntry>()
  private listeners = new Set<(progress: number) => void>()

  constructor() {
    this.manager.onProgress = (_url, loaded, total) => {
      const progress = total > 0 ? loaded / total : 1
      for (const fn of this.listeners) fn(progress)
    }
  }

  onProgress(fn: (progress: number) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  gltf(url: string): Promise<GLTF> {
    return this.memo(url, () => this.gltfLoader.loadAsync(url))
  }

  /**
   * Acquires a cloned instance of a cached GLTF model that shares underlying
   * BufferGeometry and Material references, tracked via reference counting.
   */
  async acquireGltfInstance(url: string): Promise<THREE.Group> {
    const gltf = await this.gltf(url)
    let entry = this.managedGltfs.get(url)
    if (!entry) {
      const geometries = new Set<THREE.BufferGeometry>()
      const materials = new Set<THREE.Material>()
      gltf.scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh
          if (mesh.geometry) geometries.add(mesh.geometry)
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m && materials.add(m))
          } else if (mesh.material) {
            materials.add(mesh.material)
          }
        }
      })
      entry = {
        instances: new Set(),
        geometries,
        materials,
        disposedGeometries: 0,
        disposedMaterials: 0,
      }
      this.managedGltfs.set(url, entry)
    }

    const instance = gltf.scene.clone(true)
    entry.instances.add(instance)
    return instance
  }

  /**
   * Releases a cloned instance of a GLTF model.
   * Shared geometries and materials are kept alive as long as at least one active instance remains.
   * When the last active instance is released, all shared geometries, materials, and cache entries are disposed.
   */
  releaseGltfInstance(url: string, instance: THREE.Object3D): SharedInstanceStats {
    if (instance.parent) {
      instance.parent.remove(instance)
    }
    const entry = this.managedGltfs.get(url)
    if (!entry) {
      return {
        activeInstances: 0,
        sharedGeometries: 0,
        sharedMaterials: 0,
        disposedGeometries: 0,
        disposedMaterials: 0,
      }
    }

    entry.instances.delete(instance)

    if (entry.instances.size === 0) {
      for (const geo of entry.geometries) {
        geo.dispose()
        entry.disposedGeometries++
      }
      for (const mat of entry.materials) {
        mat.dispose()
        entry.disposedMaterials++
      }
      this.cache.delete(url)
      this.managedGltfs.delete(url)
    }

    return {
      activeInstances: entry.instances.size,
      sharedGeometries: entry.geometries.size,
      sharedMaterials: entry.materials.size,
      disposedGeometries: entry.disposedGeometries,
      disposedMaterials: entry.disposedMaterials,
    }
  }

  getSharedStats(url: string): SharedInstanceStats {
    const entry = this.managedGltfs.get(url)
    if (!entry) {
      return {
        activeInstances: 0,
        sharedGeometries: 0,
        sharedMaterials: 0,
        disposedGeometries: 0,
        disposedMaterials: 0,
      }
    }
    return {
      activeInstances: entry.instances.size,
      sharedGeometries: entry.geometries.size,
      sharedMaterials: entry.materials.size,
      disposedGeometries: entry.disposedGeometries,
      disposedMaterials: entry.disposedMaterials,
    }
  }

  /** Color textures are tagged sRGB; pass `color: false` for normal/roughness maps. */
  texture(url: string, { color = true, repeat }: { color?: boolean; repeat?: number } = {}): Promise<THREE.Texture> {
    return this.memo(`${url}#${color}#${repeat ?? 1}`, async () => {
      const tex = await this.textureLoader.loadAsync(url)
      if (color) tex.colorSpace = THREE.SRGBColorSpace
      if (repeat) {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping
        tex.repeat.set(repeat, repeat)
      }
      return tex
    })
  }

  private memo<T>(key: string, load: () => Promise<T>): Promise<T> {
    let pending = this.cache.get(key) as Promise<T> | undefined
    if (!pending) {
      pending = load()
      this.cache.set(key, pending)
      pending.catch(() => this.cache.delete(key))
    }
    return pending
  }
}
