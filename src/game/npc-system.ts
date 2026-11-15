import * as THREE from 'three'
import { Chibi } from './chibi'

export type NpcDialogueSet = {
  idle: string[]
  worship: string[]
  approach: string[]
}

export type NpcConfig = {
  id: string
  name: string
  title: string
  palette: string
  startPos: THREE.Vector3
  startHeading: number
  homeZone: 'courtyard' | 'sanctuary' | 'wanderer'
  dialogues: NpcDialogueSet
}

export type TempleWaypoint = {
  name: string
  zone: 'courtyard' | 'sanctuary'
  pos: THREE.Vector3
  isWorship: boolean
  worshipTarget?: THREE.Vector3
}

export const TEMPLE_WAYPOINTS: TempleWaypoint[] = [
  // 1. 觀音大殿殿前（中門前）
  { name: '主殿大門', zone: 'courtyard', pos: new THREE.Vector3(0, 0, 1.2), isWorship: true, worshipTarget: new THREE.Vector3(0, 0, -6.0) },
  // 3. 觀音大殿龍邊前
  { name: '主殿龍邊', zone: 'courtyard', pos: new THREE.Vector3(4.5, 0, 1.2), isWorship: true, worshipTarget: new THREE.Vector3(4.5, 0, -4.5) },
  // 4. 觀音大殿虎邊前
  { name: '主殿虎邊', zone: 'courtyard', pos: new THREE.Vector3(-4.5, 0, 1.2), isWorship: true, worshipTarget: new THREE.Vector3(-4.5, 0, -4.5) },
  // 5. 蓮花許願池
  { name: '許願池', zone: 'courtyard', pos: new THREE.Vector3(-5.8, 0, 39.5), isWorship: true, worshipTarget: new THREE.Vector3(-9.5, 0, 39.5) },
  // 6. 八角金亭
  { name: '八角金亭', zone: 'courtyard', pos: new THREE.Vector3(-16.0, 0, 38.0), isWorship: true, worshipTarget: new THREE.Vector3(-19.5, 0, 38.0) },
  // 7. 天心仙姑問事亭
  { name: '問事亭', zone: 'courtyard', pos: new THREE.Vector3(-9.8, 0, 29.5), isWorship: true, worshipTarget: new THREE.Vector3(-12.0, 0, 30.0) },
  // 8. 前庭中軸石道
  { name: '前庭中道', zone: 'courtyard', pos: new THREE.Vector3(0, 0, 22.0), isWorship: false },
  // 9. 牌樓內庭廣場
  { name: '牌樓前庭', zone: 'courtyard', pos: new THREE.Vector3(0, 0, 44.0), isWorship: false },
  // 10. 西側昇龍聖境牌坊門內
  { name: '聖境牌坊東側', zone: 'courtyard', pos: new THREE.Vector3(-24.0, 0, 31.0), isWorship: false },
  // 11. 昇龍觀音青銅香爐（大平台參拜點）
  { name: '昇龍觀音香爐', zone: 'sanctuary', pos: new THREE.Vector3(-62.5, 0, 31.0), isWorship: true, worshipTarget: new THREE.Vector3(-68.0, 0, 31.0) },
  // 12. 昇龍觀音大平台北側瞻仰點
  { name: '觀音大平台北側', zone: 'sanctuary', pos: new THREE.Vector3(-68.0, 0, 37.5), isWorship: true, worshipTarget: new THREE.Vector3(-68.0, 0, 31.0) },
  // 13. 昇龍觀音大平台南側瞻仰點
  { name: '觀音大平台南側', zone: 'sanctuary', pos: new THREE.Vector3(-68.0, 0, 24.5), isWorship: true, worshipTarget: new THREE.Vector3(-68.0, 0, 31.0) },
  // 14. 昇龍觀音大平台東門步道階梯
  { name: '大平台東門階梯', zone: 'sanctuary', pos: new THREE.Vector3(-57.5, 0, 31.0), isWorship: false },
]

export const NPC_DEFINITIONS: NpcConfig[] = [
  {
    id: 'chen-auntie',
    name: '陳阿姨',
    title: '虔誠信女',
    palette: 'lavender',
    startPos: new THREE.Vector3(4.5, 0, 26.5),
    startHeading: Math.PI * 0.8,
    homeZone: 'courtyard',
    dialogues: {
      idle: [
        '大殿香火真鼎盛，心裡好安寧。',
        '誠心向觀世音菩薩、玉皇上帝祈求，平安是福。',
        '門神秦叔寶跟尉遲恭畫得真威風！',
        '今天廟裡好熱鬧，神聖祥和。',
      ],
      worship: [
        '求玉皇上帝、觀世音菩薩保佑全家老幼平安順遂。',
        '信女誠心禮拜，願家宅安康、吉星高照。',
        '合掌虔誠，有拜有保庇。',
      ],
      approach: [
        '施主您好呀！也是趁早來參拜的嗎？',
        '心誠則靈，菩薩定會庇佑您的。',
      ],
    },
  },
  {
    id: 'youth-lin',
    name: '小林',
    title: '求籤青年',
    palette: 'scholar',
    startPos: new THREE.Vector3(-5.2, 0, 38.5),
    startHeading: -Math.PI * 0.5,
    homeZone: 'wanderer',
    dialogues: {
      idle: [
        '聽說天心宮的籤詩很靈驗，待會來抽一支。',
        '這條松樹步道走起來好舒服，有淡淡清香～',
        '五層樓高的昇龍觀音好雄偉，氣勢非凡！',
        '漫步在宮廟裡，心情整個放鬆了。',
      ],
      worship: [
        '求今日籤詩指點迷津，祈願學業事業順遂。',
        '投入一枚銅錢到許願池，願心想事成！',
        '仰望五層樓乘龍觀音大士，誠心祈求好運。',
      ],
      approach: [
        '嗨！這裡的松樹小徑好清涼，超推薦去走走！',
        '您好！今天天氣真好，拍起照來每處都漂亮。',
      ],
    },
  },
  {
    id: 'tourist-ming',
    name: '遊客小明',
    title: '參拜遊客',
    palette: 'vermillion',
    startPos: new THREE.Vector3(-64.5, 0, 27.5),
    startHeading: 0,
    homeZone: 'sanctuary',
    dialogues: {
      idle: [
        '哇！這座昇龍觀音真的有五層樓高，乘龍騰雲太帥了！',
        '穿過那道【昇龍聖境】牌坊，好像走進世外仙境。',
        '漢白玉大平台四周的通天石燈台好有古典美。',
        '抬頭仰望觀音菩薩，好有震撼立體感！',
      ],
      worship: [
        '虔心仰望昇龍觀音金身，祈求福氣滿滿、平安吉祥。',
        '觀音菩薩慈眉善目，乘金龍踏祥雲，神威赫赫！',
        '在九龍青銅香爐前敬拜，願諸事圓滿。',
      ],
      approach: [
        '你好！你有去大平台看那尊巨型昇龍觀音了嗎？超宏偉的！',
        '這座宮廟處處都是驚喜，視野好棒！',
      ],
    },
  },
  {
    id: 'volunteer-zhang',
    name: '張居士',
    title: '宮廟義工',
    palette: 'amber',
    startPos: new THREE.Vector3(0, 0, 16.0),
    startHeading: Math.PI,
    homeZone: 'courtyard',
    dialogues: {
      idle: [
        '香火裊裊，天公祖慈悲庇佑十方善信。',
        '後殿是宏偉的凌霄寶殿，也可以順道去朝拜玉皇上帝喔。',
        '西側宮牆新開闢了林蔭小徑，直通昇龍觀音聖境。',
        '晨鐘暮鼓，收攝心念，處處皆是修行好境。',
      ],
      worship: [
        '祈願國泰民安、風調雨順、善信皆獲福澤。',
        '虔敬禮拜三寶，福德無量，功德圓滿。',
        '朝拜玉皇大天尊，沐浴天恩浩蕩。',
      ],
      approach: [
        '善信您好！歡迎蒞臨天心宮，心誠則靈！',
        '阿彌陀佛！願您今日福慧增長、法喜充滿。',
      ],
    },
  },
  {
    id: 'lady-lin',
    name: '林小姐',
    title: '問事信女',
    palette: 'peach',
    startPos: new THREE.Vector3(-10.2, 0, 28.5),
    startHeading: -Math.PI * 0.4,
    homeZone: 'courtyard',
    dialogues: {
      idle: [
        '天心仙姑的象棋卜卦好特別，等一下來問事指點。',
        '微風輕輕吹過，在廟裡漫步讓人忘掉所有煩惱。',
        '八角金爐看起來古色古香，雕工好精緻。',
        '點一盞平安燈，燈火長明，心願定能成就。',
      ],
      worship: [
        '恭請天心仙姑指點迷津，解惑化吉。',
        '虔敬向仙姑合掌敬拜，願善緣永續、吉祥如意。',
        '祈願家庭和睦、平安健康。',
      ],
      approach: [
        '您好！天心仙姑問事亭就在前面，可以去看看喔。',
        '您也是來問事求福的嗎？仙姑很親切呢～',
      ],
    },
  },
]

/**
 * 2.5D 精緻對話泡泡文字（Speech Bubble Billboard）
 * 100% 在世界空間運作，永遠平行垂直面向玩家螢幕視角，徹底根除傾斜與透視失真！
 * 配備 1024x440 2x Retina 級解析度、純白底色、粗金彩邊框與大字號純黑清晰排版。
 */
export class NpcSpeechBubble {
  readonly mesh: THREE.Mesh
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly texture: THREE.CanvasTexture
  private timer = 0
  private currentScale = 0
  private targetScale = 0

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = 1024
    this.canvas.height = 440
    this.ctx = this.canvas.getContext('2d')!
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.generateMipmaps = true
    this.texture.minFilter = THREE.LinearMipmapLinearFilter
    this.texture.magFilter = THREE.LinearFilter

    const mat = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    // 3.3m x 1.42m 平面，大氣清晰，正常相機遠距下一目了然
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 1.42), mat)
    this.mesh.scale.set(0, 0, 0)
    this.mesh.visible = false
  }

  show(speaker: string, text: string, duration = 5.2): void {
    this.timer = duration
    this.targetScale = 1.0
    this.mesh.visible = true
    this.renderCanvas(speaker, text)
  }

  hide(): void {
    this.timer = 0
    this.targetScale = 0
  }

  private renderCanvas(speaker: string, text: string): void {
    const ctx = this.ctx
    ctx.clearRect(0, 0, 1024, 440)

    const x = 30
    const y = 24
    const w = 964
    const h = 310
    const r = 36
    const tailX = 512
    const tailY = 415

    // 1. 柔和深色陰影
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
    ctx.shadowBlur = 20
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 8

    // 2. 圓角對話框主體與向下的倒三角箭頭
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(tailX + 36, y + h)
    ctx.lineTo(tailX, tailY)
    ctx.lineTo(tailX - 36, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()

    // 純白明亮底色（高對比度，徹底擺脫背景遮擋與灰暗感）
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.restore()

    // 3. 粗黑/金色彩邊框 (極致清晰)
    ctx.strokeStyle = '#c88f28'
    ctx.lineWidth = 7
    ctx.stroke()
    ctx.strokeStyle = '#fbf0cd'
    ctx.lineWidth = 2.5
    ctx.stroke()

    // 4. 發言人名牌徽章 (如 【 陳阿姨 】)
    ctx.fillStyle = '#a9281a'
    ctx.beginPath()
    ctx.roundRect(60, 45, 230, 56, 14)
    ctx.fill()
    ctx.strokeStyle = '#ffdf88'
    ctx.lineWidth = 2.5
    ctx.stroke()

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 30px "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(speaker, 175, 73)

    // 5. 說話對話內容（純黑粗體，極高對比，一眼看清）
    ctx.fillStyle = '#0a0503'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'

    if (text.length <= 13) {
      ctx.font = 'bold 46px "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif'
      ctx.fillText(text, 68, 205)
    } else {
      const splitIdx = Math.ceil(text.length / 2)
      const line1 = text.slice(0, splitIdx)
      const line2 = text.slice(splitIdx)
      ctx.font = 'bold 38px "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif'
      ctx.fillText(line1, 68, 168)
      ctx.fillText(line2, 68, 242)
    }

    this.texture.needsUpdate = true
  }

  update(worldPos: THREE.Vector3, dt: number, time: number, camera?: THREE.Camera): void {
    if (this.timer > 0) {
      this.timer -= dt
      if (this.timer <= 0) {
        this.targetScale = 0
      }
    }

    this.currentScale = THREE.MathUtils.damp(this.currentScale, this.targetScale, 10, dt)
    this.mesh.scale.setScalar(this.currentScale)

    if (this.currentScale > 0.005) {
      this.mesh.visible = true
      // 世界坐標懸浮於 NPC 頭頂上方 2.25 米處，平滑呼吸上下浮動
      this.mesh.position.set(worldPos.x, worldPos.y + 2.25 + Math.sin(time * 2.8) * 0.04, worldPos.z)
      // 在世界空間中直接拷貝攝影機四元數，100% 永遠垂直面向鏡頭，絕對無任何傾斜或透視失真！
      if (camera) {
        this.mesh.quaternion.copy(camera.quaternion)
      }
    } else {
      this.mesh.visible = false
    }
  }

  get isSpeaking(): boolean {
    return this.timer > 0 || this.currentScale > 0.1
  }
}

/**
 * 獨立 NPC 實例：擁有 Chibi 模型身軀、狀態機（閒逛、走動、合掌參拜）、尋路與頭頂對話泡泡。
 */
export class NpcInstance {
  readonly root = new THREE.Group()
  readonly chibi = new Chibi()
  readonly bubble = new NpcSpeechBubble()
  readonly config: NpcConfig

  onSpeak?: (speaker: string, text: string) => void

  private state: 'idle' | 'walk' | 'worship' = 'idle'
  private stateTimer = 2.0
  private pos = new THREE.Vector3()
  private heading = 0
  private targetHeading = 0
  private pathWaypoints: THREE.Vector3[] = []
  private currentWaypoint: TempleWaypoint | null = null
  private walkSpeed = 1.8
  private totalWorshipTime = 6.0
  private worshipSaid = false
  private speechCooldown = 5.0
  private approachCooldown = 8.0
  private lastPlayerPos = new THREE.Vector3()

  constructor(config: NpcConfig) {
    this.config = config
    this.pos.copy(config.startPos)
    this.heading = config.startHeading
    this.targetHeading = config.startHeading

    this.chibi.setPalette(config.palette)
    this.root.add(this.chibi.root)

    this.root.position.copy(this.pos)
    this.root.rotation.y = this.heading

    this.stateTimer = 2.0 + Math.random() * 4.0
    this.speechCooldown = 3.0 + Math.random() * 6.0
  }

  /** 規劃跨區導航路徑（確保穿越西側月亮門牌坊，沿小徑前行絕不穿牆） */
  private planPath(start: THREE.Vector3, dest: THREE.Vector3): THREE.Vector3[] {
    const isStartCourtyard = start.x > -28.0
    const isDestCourtyard = dest.x > -28.0
    const isStartSanctuary = start.x < -54.0
    const isDestSanctuary = dest.x < -54.0

    // 1. 同在前庭或同在聖境大平台，直接走直線
    if ((isStartCourtyard && isDestCourtyard) || (isStartSanctuary && isDestSanctuary)) {
      return [dest.clone()]
    }

    // 2. 前庭 -> 聖境大平台：循序經由月亮門與松林小徑
    if (isStartCourtyard && isDestSanctuary) {
      return [
        new THREE.Vector3(-24.0, 0, 31.0),
        new THREE.Vector3(-29.6, 0, 31.0),
        new THREE.Vector3(-42.0, 0, 31.0),
        new THREE.Vector3(-55.5, 0, 31.0),
        dest.clone(),
      ]
    }

    // 3. 聖境大平台 -> 前庭：循序穿過小徑回到前庭
    if (isStartSanctuary && isDestCourtyard) {
      return [
        new THREE.Vector3(-55.5, 0, 31.0),
        new THREE.Vector3(-42.0, 0, 31.0),
        new THREE.Vector3(-29.6, 0, 31.0),
        new THREE.Vector3(-24.0, 0, 31.0),
        dest.clone(),
      ]
    }

    return [dest.clone()]
  }

  private pickNextDestination(): void {
    let pool = TEMPLE_WAYPOINTS.slice()
    if (this.config.homeZone === 'courtyard') {
      if (Math.random() < 0.8) {
        pool = pool.filter(w => w.zone === 'courtyard')
      }
    } else if (this.config.homeZone === 'sanctuary') {
      if (Math.random() < 0.8) {
        pool = pool.filter(w => w.zone === 'sanctuary')
      }
    }

    // 排除當前離自身過近的點
    const candidates = pool.filter(w => this.pos.distanceTo(w.pos) > 3.0)
    if (candidates.length === 0) {
      this.stateTimer = 3.0
      return
    }

    const next = candidates[Math.floor(Math.random() * candidates.length)]
    this.currentWaypoint = next

    // 增加適度隨機偏移，防止 NPC 重疊聚集在同一點
    const targetPos = next.pos.clone()
    if (!next.isWorship) {
      targetPos.x += (Math.random() - 0.5) * 2.2
      targetPos.z += (Math.random() - 0.5) * 2.2
    } else {
      targetPos.x += (Math.random() - 0.5) * 1.4
    }

    this.pathWaypoints = this.planPath(this.pos, targetPos)
    this.walkSpeed = 1.5 + Math.random() * 0.4
    this.state = 'walk'
  }

  say(category: 'idle' | 'worship' | 'approach', force = false): void {
    if (!force && this.bubble.isSpeaking) return
    const lines = this.config.dialogues[category]
    if (!lines || lines.length === 0) return
    const line = lines[Math.floor(Math.random() * lines.length)]
    this.bubble.show(this.config.name, line, 5.0)
    this.speechCooldown = 12.0 + Math.random() * 10.0

    // 若玩家在聽覺範圍內 (18 米內)，同步播報至螢幕底部高清晰字幕列
    if (this.pos.distanceTo(this.lastPlayerPos) <= 18.0) {
      this.onSpeak?.(this.config.name, line)
    }
  }

  update(dt: number, time: number, playerPos: THREE.Vector3, camera?: THREE.Camera): void {
    this.lastPlayerPos.copy(playerPos)
    this.bubble.update(this.pos, dt, time, camera)

    if (this.speechCooldown > 0) this.speechCooldown -= dt
    if (this.approachCooldown > 0) this.approachCooldown -= dt

    // 1. 善信玩家靠近問候機制 (Proximity Interaction)
    const distToPlayer = this.pos.distanceTo(playerPos)
    if (distToPlayer < 3.2 && this.approachCooldown <= 0 && !this.bubble.isSpeaking && this.state !== 'worship') {
      this.say('approach')
      this.approachCooldown = 22.0
    }

    // 2. 狀態機處理
    if (this.state === 'idle') {
      this.chibi.animate(dt, time, 0, false, 0)
      this.stateTimer -= dt

      if (this.speechCooldown <= 0 && Math.random() < 0.008) {
        this.say('idle')
      }

      if (this.stateTimer <= 0) {
        this.pickNextDestination()
      }
    } else if (this.state === 'walk') {
      if (this.pathWaypoints.length === 0) {
        if (this.currentWaypoint?.isWorship) {
          this.state = 'worship'
          this.totalWorshipTime = 6.0 + Math.random() * 2.5
          this.stateTimer = this.totalWorshipTime
          this.worshipSaid = false
          if (this.currentWaypoint.worshipTarget) {
            const wt = this.currentWaypoint.worshipTarget
            this.targetHeading = Math.atan2(wt.x - this.pos.x, wt.z - this.pos.z)
          }
        } else {
          this.state = 'idle'
          this.stateTimer = 3.5 + Math.random() * 5.0
        }
        return
      }

      const target = this.pathWaypoints[0]
      const dx = target.x - this.pos.x
      const dz = target.z - this.pos.z
      const dist = Math.hypot(dx, dz)

      if (dist < 0.3) {
        this.pathWaypoints.shift()
      } else {
        const moveHeading = Math.atan2(dx, dz)
        this.heading = THREE.MathUtils.damp(this.heading, moveHeading, 9, dt)
        this.root.rotation.y = this.heading

        const step = Math.min(this.walkSpeed * dt, dist)
        this.pos.x += Math.sin(this.heading) * step
        this.pos.z += Math.cos(this.heading) * step
        this.root.position.copy(this.pos)

        this.chibi.animate(dt, time, this.walkSpeed, false, 0)
      }
    } else if (this.state === 'worship') {
      this.heading = THREE.MathUtils.damp(this.heading, this.targetHeading, 7, dt)
      this.root.rotation.y = this.heading

      this.stateTimer -= dt
      const k = 1 - Math.max(0, this.stateTimer / this.totalWorshipTime)
      this.chibi.animate(dt, time, 0, false, k)

      if (!this.worshipSaid && k > 0.12) {
        this.worshipSaid = true
        this.say('worship', true)
      }

      if (this.stateTimer <= 0) {
        this.state = 'idle'
        this.stateTimer = 3.0 + Math.random() * 4.0
      }
    }
  }
}

/**
 * NPC 總管理器：管理整個宮廟世界的所有活躍 NPC，負責生命週期與逐幀驅動。
 */
export class NpcManager {
  readonly npcs: NpcInstance[] = []
  onSpeak?: (speaker: string, text: string) => void

  constructor(private readonly scene: THREE.Scene) {
    for (const def of NPC_DEFINITIONS) {
      const npc = new NpcInstance(def)
      npc.onSpeak = (speaker, text) => this.onSpeak?.(speaker, text)
      this.npcs.push(npc)
      this.scene.add(npc.root)
      // 關鍵修復：將泡泡網格直接加入場景世界空間，避免受 NPC 父節點 Y 軸轉向影響而產生傾斜與透視失真！
      this.scene.add(npc.bubble.mesh)
    }
  }

  update(dt: number, time: number, playerPos: THREE.Vector3, camera?: THREE.Camera): void {
    for (const npc of this.npcs) {
      npc.update(dt, time, playerPos, camera)
    }
  }
}
