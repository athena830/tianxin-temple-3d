import * as THREE from 'three'
import { CONFIG } from './config'

/**
 * 共用場景比例與相機基準設定（玉皇宮 × 靈光市集）。
 * 以主場景「玉皇宮」的實際角色身高與鏡頭視覺比例為唯一基準，
 * 確保跨場景切換時，人物與建築在螢幕上的像素比例 100% 一致。
 */

/** 玉皇宮主場景 Q 版行者（Chibi）實測 BoundingBox 實際高度（公尺） */
export const PLAYER_TARGET_HEIGHT = 1.42

/** 靈光市集單層攤位與小屋目標高度：人物身高的 2.3 倍（約 3.266 公尺） */
export const MARKET_STALL_HEIGHT_RATIO = 2.3
export const MARKET_STALL_TARGET_HEIGHT = PLAYER_TARGET_HEIGHT * MARKET_STALL_HEIGHT_RATIO

/** 靈光市集除錯用整體建築比例拉桿預設與範圍 */
export const MARKET_BUILDING_SCALE_DEFAULT = 1.0
export const MARKET_BUILDING_SCALE_MIN = 0.7
export const MARKET_BUILDING_SCALE_MAX = 1.5

/** 玉皇宮主場景預設相機基準參數（來源：TempleGame & CONFIG.camera） */
export const TEMPLE_CAMERA_REFERENCE = {
  fovDeg: CONFIG.camera.fov, // 62°
  distance: 4.6, // TempleGame 預設鏡頭距離
  pitch: 0.32, // TempleGame 預設俯視仰角（radians）
  lookHeight: 1.25, // TempleGame 預設注視高度
} as const

/**
 * 依據玉皇宮 PerspectiveCamera 在角色平面（distance = 4.6m, fov = 62°）的實際可視高度，
 * 換算為等效 OrthographicCamera 參數，讓靈光市集與玉皇宮的人物螢幕像素高度 100% 一致。
 *
 * frustumSize = 2 * distance * tan(fov / 2) ≈ 5.528m（半高 ≈ 2.764m）
 */
const TEMPLE_EQUIVALENT_FRUSTUM_SIZE =
  2 * TEMPLE_CAMERA_REFERENCE.distance * Math.tan(THREE.MathUtils.degToRad(TEMPLE_CAMERA_REFERENCE.fovDeg / 2))

export const SHARED_ORTHO_CAMERA_CONFIG = {
  /** 等效垂直可視範圍（世界單位公尺），確保角色在螢幕佔比與玉皇宮完全一致 */
  frustumSize: Number(TEMPLE_EQUIVALENT_FRUSTUM_SIZE.toFixed(3)), // ≈ 5.528
  /** 正交鏡頭預設縮放倍率（1.0 = 與玉皇宮 1:1 像素比例一致） */
  zoom: 1.0,
  /** 滾輪縮放倍率範圍（可拉近特寫或拉遠俯瞰整條市集與天空之城） */
  minZoom: 0.34,
  maxZoom: 1.45,
  /** 俯視角度偏移量（對齊玉皇宮預設 pitch = 0.32 rad） */
  defaultElevation: TEMPLE_CAMERA_REFERENCE.pitch,
  /** 預設水平視角偏移量 */
  defaultAzimuth: 0.12,
  /** 正面平視攤位仰角 */
  eyeLevelElevation: 0.06,
  /** 俯視全景仰角與縮放 */
  overviewElevation: 0.64,
  overviewZoom: 0.56,
  /** 俯仰角限制 */
  minElevation: 0.02,
  maxElevation: 1.2,
  /** 正交鏡頭與目標點距離（僅影響近遠裁切與陰影深度，不影響正交大小） */
  distance: 28,
  /** 鏡頭注視點高度偏移（對齊玉皇宮 LOOK_HEIGHT） */
  lookHeight: TEMPLE_CAMERA_REFERENCE.lookHeight,
  /** 近遠裁切面 */
  near: -40,
  far: 140,
} as const

export interface NormalizeScaleResult {
  scaleFactor: number
  originalHeight: number
  finalHeight: number
}

/**
 * 計算物件內所有 Mesh 的世界座標 BoundingBox（自動排除 Sprite 光暈與燈光，避免發光特效干擾實體高度量測）。
 */
function computeMeshBoundingBox(object: THREE.Object3D): THREE.Box3 {
  object.updateMatrixWorld(true)
  const box = new THREE.Box3()
  const meshBox = new THREE.Box3()
  let hasMesh = false

  object.traverse(child => {
    if (child instanceof THREE.Mesh && child.geometry) {
      if (!child.geometry.boundingBox) {
        child.geometry.computeBoundingBox()
      }
      if (child.geometry.boundingBox) {
        meshBox.copy(child.geometry.boundingBox).applyMatrix4(child.matrixWorld)
        box.union(meshBox)
        hasMesh = true
      }
    }
  })

  if (!hasMesh) {
    box.setFromObject(object)
  }
  return box
}

/**
 * 自動等比例縮放函式（使用 THREE.Box3）：
 * 僅計算物件的 BoundingBox 高度並進行等比例縮放（scale），
 * 最後將物件底部精準貼齊指定地面高度 groundY（預設 y = 0），
 * 絕不修改物件內部的材質、貼圖、顏色或幾何結構。
 */
export function normalizeScaleToHeight(
  object: THREE.Object3D,
  targetHeight: number,
  groundY = 0,
): NormalizeScaleResult {
  const initialBox = computeMeshBoundingBox(object)
  const size = new THREE.Vector3()
  initialBox.getSize(size)

  if (!Number.isFinite(size.y) || size.y <= 1e-4) {
    return { scaleFactor: 1, originalHeight: size.y, finalHeight: size.y }
  }

  const scaleFactor = targetHeight / size.y
  object.scale.multiplyScalar(scaleFactor)

  const scaledBox = computeMeshBoundingBox(object)
  if (Number.isFinite(scaledBox.min.y)) {
    object.position.y += groundY - scaledBox.min.y
  }
  object.updateMatrixWorld(true)

  return {
    scaleFactor,
    originalHeight: size.y,
    finalHeight: targetHeight,
  }
}
