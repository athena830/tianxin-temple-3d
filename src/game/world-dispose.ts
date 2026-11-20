import * as THREE from 'three'

/** Release GPU-side resources owned by a world before its scene is discarded. */
export function disposeWorldScene(scene: THREE.Scene): void {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()

  const collectMaterial = (material: THREE.Material): void => {
    materials.add(material)
    for (const value of Object.values(material)) {
      if (value instanceof THREE.Texture) textures.add(value)
    }
  }

  scene.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
      geometries.add(object.geometry)
      const material = object.material
      for (const entry of Array.isArray(material) ? material : [material]) collectMaterial(entry)
    }
  })

  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) material.dispose()
  for (const texture of textures) texture.dispose()
  scene.clear()
}
