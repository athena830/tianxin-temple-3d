import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { writeFileSync, mkdirSync } from 'node:fs'

// Polyfill FileReader for Node.js
class PolyfillFileReader {
  async readAsArrayBuffer(blob) {
    const buf = await blob.arrayBuffer()
    this.result = buf
    if (this.onload) this.onload({ target: this })
    if (this.onloadend) this.onloadend({ target: this })
  }
}
globalThis.FileReader = PolyfillFileReader

async function generate() {
  try {
    const exporter = new GLTFExporter()
    const group = new THREE.Group()
    group.name = 'Test_Suzanne_Model'

    // Create a stylized Suzanne/monkey-like organic test sculpt
    const mat = new THREE.MeshStandardMaterial({
      color: 0xc83828,
      metalness: 0.35,
      roughness: 0.25,
      name: 'Suzanne_PBR_Material'
    })

    // Head / cranium
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.0, 24, 18), mat)
    head.name = 'Head'
    head.scale.set(1.0, 1.1, 0.95)
    group.add(head)

    // Muzzle / snout
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 0.65, 16), mat)
    snout.name = 'Snout'
    snout.rotation.x = Math.PI / 2
    snout.position.set(0, -0.22, 0.85)
    group.add(snout)

    // Brow ridge
    const brow = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.12, 12, 20, Math.PI), mat)
    brow.name = 'Brow'
    brow.position.set(0, 0.28, 0.72)
    group.add(brow)

    // Eyes
    const eyeGoldMat = new THREE.MeshStandardMaterial({ color: 0xf5c242, metalness: 0.8, roughness: 0.2, name: 'Eye_Gold_PBR' })
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), eyeGoldMat)
      eye.name = side === -1 ? 'Eye_Left' : 'Eye_Right'
      eye.position.set(side * 0.38, 0.22, 0.75)
      group.add(eye)

      // Ears
      const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 16), mat)
      ear.name = side === -1 ? 'Ear_Left' : 'Ear_Right'
      ear.rotation.z = Math.PI / 2
      ear.rotation.y = side * 0.35
      ear.position.set(side * 1.15, 0.15, -0.15)
      group.add(ear)
    }

    mkdirSync('public/assets/models', { recursive: true })

    console.log('Starting GLTF export...')
    const gltf = await exporter.parseAsync(group, { binary: true })
    const buffer = Buffer.from(gltf)
    writeFileSync('public/assets/models/test.glb', buffer)
    console.log('Successfully wrote public/assets/models/test.glb, size:', buffer.length, 'bytes')
  } catch (err) {
    console.error('Error generating GLB:', err)
  }
}

generate()
