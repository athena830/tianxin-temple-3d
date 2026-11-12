import * as THREE from 'three'

/**
 * Procedural placeholder chibi visitor used until the stage-5 modular character lands.
 * Front faces local +Z. Total height is about 1.45 m with the feet at y = 0.
 */
export type ChibiPalette = { robe: string; sash: string; hair: string }

export const CHIBI_PALETTES: Record<string, ChibiPalette> = {
  jade: { robe: '#d9c79a', sash: '#7d9a7a', hair: '#2c211b' },
  vermillion: { robe: '#b0473a', sash: '#e2b864', hair: '#251a16' },
  moon: { robe: '#a9bcb1', sash: '#f1ead8', hair: '#3a2f2a' },
}

const std = (color: string, roughness = 0.75) => new THREE.MeshStandardMaterial({ color, roughness })

export class Chibi {
  readonly root = new THREE.Group()
  private readonly body = new THREE.Group()
  private readonly head = new THREE.Group()
  private readonly legL = new THREE.Group()
  private readonly legR = new THREE.Group()
  private readonly armL = new THREE.Group()
  private readonly armR = new THREE.Group()
  private readonly robeMat = std('#d9c79a')
  private readonly sleeveMat = std('#d9c79a')
  private readonly sashMat = std('#7d9a7a')
  private readonly hairMat = std('#2c211b', 0.6)
  private phase = 0
  private walk = 0

  constructor() {
    const skin = std('#f3d9bf', 0.6)
    const dark = std('#2a1d17', 0.4)
    const shoe = std('#3b2b22')
    this.root.add(this.body)

    for (const [leg, x] of [[this.legL, -0.11], [this.legR, 0.11]] as const) {
      leg.position.set(x, 0.42, 0)
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.34, 10), this.robeMat)
      shin.position.y = -0.2
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), shoe)
      foot.scale.set(1, 0.55, 1.35)
      foot.position.set(0, -0.38, 0.03)
      leg.add(shin, foot)
      this.body.add(leg)
    }

    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.33, 0.5, 18), this.robeMat)
    robe.position.y = 0.6
    const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.07, 18), this.sashMat)
    sash.position.y = 0.72
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 6, 16), this.sashMat)
    collar.rotation.x = Math.PI / 2
    collar.position.y = 0.86
    this.body.add(robe, sash, collar)

    for (const [arm, side] of [[this.armL, -1], [this.armR, 1]] as const) {
      arm.position.set(side * 0.24, 0.82, 0)
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.095, 0.32, 10), this.sleeveMat)
      sleeve.position.y = -0.15
      sleeve.rotation.z = side * 0.16
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), skin)
      hand.position.set(side * 0.03, -0.33, 0)
      arm.add(sleeve, hand)
      this.body.add(arm)
    }

    this.head.position.y = 1.12
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.27, 24, 18), skin)
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.285, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), this.hairMat)
    hairCap.rotation.x = -0.32
    hairCap.position.set(0, 0.02, -0.02)
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), this.hairMat)
    bun.position.set(0, 0.29, -0.06)
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), std('#d4a64e', 0.4))
    pin.rotation.z = Math.PI / 2
    pin.position.copy(bun.position)
    this.head.add(face, hairCap, bun, pin)
    for (const x of [-0.09, 0.09]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), dark)
      eye.scale.set(1, 1.25, 0.6)
      eye.position.set(x, -0.02, 0.245)
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), new THREE.MeshBasicMaterial({ color: '#f0a99a', transparent: true, opacity: 0.7 }))
      blush.position.set(x * 1.55, -0.09, 0.235)
      blush.rotation.y = x > 0 ? 0.45 : -0.45
      this.head.add(eye, blush)
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 4, 10, Math.PI), dark)
    mouth.rotation.z = Math.PI
    mouth.position.set(0, -0.1, 0.262)
    this.head.add(mouth)
    this.body.add(this.head)

    this.root.traverse(obj => { if (obj instanceof THREE.Mesh) { obj.castShadow = true; obj.receiveShadow = true } })
  }

  setPalette(id: string): void {
    const p = CHIBI_PALETTES[id] ?? CHIBI_PALETTES.jade
    this.robeMat.color.set(p.robe)
    this.sleeveMat.color.set(p.robe).multiplyScalar(0.92)
    this.sashMat.color.set(p.sash)
    this.hairMat.color.set(p.hair)
  }

  /** `speed` is metres per second; drives a simple walk swing or idle breathing. */
  animate(dt: number, time: number, speed: number, reducedMotion: boolean): void {
    const target = THREE.MathUtils.clamp(speed / 3.2, 0, 1)
    this.walk = THREE.MathUtils.damp(this.walk, target, 10, dt)
    this.phase += dt * (4 + speed * 2.4)
    const motion = reducedMotion ? 0.35 : 1
    const swing = Math.sin(this.phase) * 0.7 * this.walk * motion
    this.legL.rotation.x = swing
    this.legR.rotation.x = -swing
    this.armL.rotation.x = -swing * 0.8
    this.armR.rotation.x = swing * 0.8
    const breathe = Math.sin(time * 2.1) * 0.012 * (1 - this.walk) * motion
    const hop = Math.abs(Math.sin(this.phase)) * 0.045 * this.walk * motion
    this.body.position.y = hop
    this.head.position.y = 1.12 + breathe
    this.head.rotation.z = Math.sin(this.phase * 0.5) * 0.05 * this.walk * motion
    this.body.scale.set(1, 1 + breathe, 1)
  }
}
