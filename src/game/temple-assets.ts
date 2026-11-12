const CDN = {
  avatar: '/manus-storage/game/sha256/ab97fd4f6f1e1badaa0ef779d51e772bd795d188d6ed43f37ec65e74dad54dad.glb',
  guanyin: '/manus-storage/game/sha256/5bf8007b9397f6c782006f4d7ffbdb7609c11c1101ac1f1641b7a125b050d9a4.glb',
} as const

// The sandbox dev server does not proxy project Storage; it serves the restored local copies instead.
const LOCAL = { avatar: '/assets/models/pilgrim-avatar.glb', guanyin: '/assets/models/guanyin-statue.glb' } as const

export const TEMPLE_MODEL_URLS: Record<keyof typeof CDN, string> = import.meta.env.DEV ? LOCAL : CDN
