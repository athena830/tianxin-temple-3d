import * as THREE from 'three'
import { Chibi, CHIBI_PALETTES, type ChibiPalette } from './chibi'
import { PLAYER_TARGET_HEIGHT, normalizeScaleToHeight } from './sceneConfig'

export { Chibi, CHIBI_PALETTES }
export type { ChibiPalette }

export interface CharacterCreationOptions {
  /** 色盤 ID（參見 CHIBI_PALETTES，預設 'jade'） */
  palette?: string
  /** 目標身高校正（預設 PLAYER_TARGET_HEIGHT，與玉皇宮 100% 一致） */
  targetHeight?: number
  /** 腳底貼齊之地面 Y 座標（預設 0） */
  groundY?: number
  /** 是否開啟陰影投射與接收（預設 true） */
  castShadow?: boolean
  receiveShadow?: boolean
}

/**
 * 【共用角色建立模組】
 * 統一玉皇宮主場景與靈光市集的人物生成邏輯：
 * - 正統 2 頭身黃金萌系比例、大頭短萌身體、圓潤手捏黏土手辦質感
 * - 精緻萌系手繪五官：水滴大眼、靈動高光閃爍白點、蜜桃粉嫩腮紅、治癒微笑小嘴、手作髮包金簪
 * - 全面採用消光溫潤 MeshLambertMaterial 啞光黏土材質，無刺眼金屬光
 * - 自動依據 PLAYER_TARGET_HEIGHT 進行高度等比例縮放與地面 y = 0 貼齊
 * - 內建自訂 3D 模型 (.glb / .gltf) 一鍵切換與載入接口
 */
export function createCharacter(options: CharacterCreationOptions = {}): Chibi {
  const chibi = new Chibi()
  const palette = options.palette ?? 'jade'
  chibi.setPalette(palette)

  const targetHeight = options.targetHeight ?? PLAYER_TARGET_HEIGHT
  const groundY = options.groundY ?? 0
  normalizeScaleToHeight(chibi.root, targetHeight, groundY)

  const castShadow = options.castShadow ?? true
  const receiveShadow = options.receiveShadow ?? true
  chibi.root.traverse(child => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = castShadow
      child.receiveShadow = receiveShadow
    }
  })

  return chibi
}
