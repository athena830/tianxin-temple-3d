import {
  CHARACTERS,
  LOTS,
  MAX_RECORDS,
  TempleStore,
  exportTempleBackupJson,
  formatCrossGuaShareText,
  formatRecordDate,
  formatRecordsAsText,
  type CharacterId,
  type LampId,
  type OfferingId,
  type WishCategory,
  type WishBlessing,
} from '../game/temple-data'
import { getLunarPhaseInfo, getRealWorldTimeOfDay, type ShrinePoint, type ShrinePointId, type TimeOfDay, type TimeSetting } from '../game/temple-world'
import type { MarketPoint, MarketVenueId } from '../game/market-world'
import type { ZiweiChart, ZiweiInput } from '../game/ziwei-engine'
import type { HumanDesignChart, HumanDesignInput } from '../game/human-design-engine'
import { listHumanDesignCharts, saveHumanDesignChart, clearHumanDesignCharts } from '../game/human-design-storage'
import { TOPIC_LABELS, drawThreeCards, getDailyCard, type CardTopic, type ThreeCardSpread } from '../game/card-engine'
import { POS_META, type ChessPos } from '../divination'
import { calculateNumerology, NINE_GRID_META, type NumerologyResult } from '../game/numerology-engine'
import type { MusicTrack } from '../engine/audio'
import { APP_VERSION } from '../version'
import {
  LINE_OFFICIAL_URL,
  renderDisclaimerStrip,
  renderLegalModal,
  renderQrLightbox,
  renderServiceModal,
  renderServiceSection,
} from './service-links'
export type PanelId = ShrinePointId | 'consult' | 'bobei'

const esc = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const SAMPLE_WISHES = ['願家人身體健康，平安順遂。', '祈求考試順利，心定不慌。', '願世間少些病苦，多些溫柔。', '新的一年，工作踏實、心安自在。']

function getEffectiveTimeLabel(mode: TimeOfDay): string {
  if (mode === 'night') {
    const lunar = getLunarPhaseInfo()
    return `🌙 ${lunar.name}`
  }
  const labels: Record<TimeOfDay, string> = {
    day: '☀️ 晴空',
    dusk: '🌇 夕陽',
    night: '🌙 夜晚',
    dawn: '🌅 晨曦',
  }
  return labels[mode]
}

export type TempleUiActions = {
  begin(): void
  choose(id: CharacterId): void
  enter(): void
  resume(): void
  closePanel(): void
  openPanel(): void
  ritual(action: string): void
  travel(id: ShrinePointId): void
  enterMarket(): void
  explore(): void
  exitExplore(): void
  cancelGuide(): void
  goHome?(): void
  time(mode: TimeSetting): void
  toggleMusic(): { playing: boolean; track: MusicTrack; chantCount: number }
  isMusicPlaying(): boolean
  getCurrentMusicState?(): { playing: boolean; track: MusicTrack; chantCount: number }
  switchTrack?(track: MusicTrack): void
  toggleMeditationAmbient(): boolean
  stopMeditationAmbient(): void
}

export class TempleUi {
  screen = 'boot'
  private readonly root: HTMLElement
  private toastTimer = 0
  private currentTimeSetting: TimeSetting = 'auto'
  private currentEffectiveTime: TimeOfDay = 'day'
  private lastBobei: { title: string; desc: string; cup1: 'yang' | 'yin'; cup2: 'yang' | 'yin' } | null = null
  selectedWishCategory: WishCategory = 'peace'
  lastWishBlessing: WishBlessing | null = null
  customWishInput = ''
  private ziweiInput: ZiweiInput | null = null
  private ziweiChart: ZiweiChart | null = null
  private ziweiError = ''
  private ziweiSavedCount = 0
  private cardSpread: ThreeCardSpread | null = null
  private cardNoteCount = 0
  private meditationSeconds = 60
  private meditationRunning = false
  private meditationAmbient = false
  private meditationTimer = 0
  private currentMarketVenue: MarketVenueId | null = null
  private birthChartTab: 'ziwei' | 'human-design' = 'ziwei'
  private humanDesignInput: HumanDesignInput | null = null
  private humanDesignChart: HumanDesignChart | null = null
  private humanDesignError = ''
  private humanDesignSavedCount = 0
  private serviceDeskMemo = ''
  private numerologyDate = '1996-08-22'
  private numerologyResult: NumerologyResult | null = null
  private numerologyError = ''

  constructor(private readonly store: TempleStore, private readonly actions: TempleUiActions) {
    const initReal = getRealWorldTimeOfDay().mode
    this.currentTimeSetting = 'auto'
    this.currentEffectiveTime = initReal
    const initialTimeLabel = `⏰ 現實 (${getEffectiveTimeLabel(initReal)})`
    const initMusic = this.actions.getCurrentMusicState?.()
    const isPlaying = initMusic?.playing ?? false
    const initialMusicLabel = isPlaying ? `🎵 綠度母 (${initMusic?.chantCount || 1}/12)` : '🔇 音樂：暫停'

    this.root = document.getElementById('ui')!
    this.root.innerHTML = `
      <div class="app-version-badge" id="app-version">${APP_VERSION}</div>
      <section class="screen boot" data-screen="boot"><img class="boot-icon" src="./favicon.png" alt="" width="72" height="72" /><p>宮門將啟，正在備香⋯</p><div class="bar"><i></i></div></section>
      <section class="screen title" data-screen="title">
        <div class="title-card">
          <div class="seal">玉</div>
          <p class="eyebrow">線上 3D 宮廟</p>
          <h1>玉皇宮</h1>
          <p class="lead">心願有寄，平安相伴。穿過宮門，走進觀世音菩薩主殿，以自己的步伐參拜祈福。</p>
          <button class="btn primary" data-act="begin">入宮祈福</button>
          <p class="title-service-entry">
            <button type="button" class="link-btn" data-act="open-services">LINE 預約解卦・隨喜支持</button>
            <span class="title-entry-sep" aria-hidden="true">｜</span>
            <button type="button" class="link-btn" data-act="open-legal">服務說明與隱私權</button>
          </p>
          <p class="note">祈願與卜卦紀錄僅保存於本機瀏覽器；卜卦內容屬民俗文化參考，不取代醫療、法律或財務專業判斷。</p>
        </div>
      </section>
      <section class="screen select" data-screen="select">
        <div class="select-card">
          <p class="eyebrow">選擇人物</p>
          <h2>今日以何種心境入宮？</h2>
          <div class="chars">${CHARACTERS.map(c => `<button class="char" data-char="${c.id}" style="--c:${c.color}"><i></i><b>${c.name}</b><span>${c.title}</span></button>`).join('')}</div>
          <button class="btn primary" data-act="enter">進入宮門</button>
        </div>
      </section>
      <section class="screen hud" data-screen="hud">
        <header class="hud-top">
          <button type="button" class="badge badge-btn" data-act="go-home" title="返回首頁" aria-label="返回玉皇宮首頁"><span class="seal small">玉</span><div><b>玉皇宮</b><small data-who></small></div></button>
          <button type="button" class="hud-menu-toggle" aria-expanded="true" aria-controls="temple-hud-buttons">收合功能 ▲</button>
          <div class="hud-buttons" id="temple-hud-buttons">
            <button class="chip" data-act="time">${initialTimeLabel}</button>
            <button class="chip music-toggle-btn${isPlaying ? '' : ' is-muted'}" data-act="music" aria-label="切換背景音樂">${initialMusicLabel}</button>
            <button class="chip market-entry" data-act="market-enter" title="天心靈光市集（建構中）">進入市集（建構中）</button>
            <button class="chip unicorn-entry" data-act="unicorn-enter" title="前往月光森林・獨角獸心安宮聖域（建構中）">🦄 獨角獸聖域（建構中）</button>
            <button class="chip" data-act="map">參拜指引</button>
            <button class="chip" data-open="records">祈福紀錄</button>
            <button class="chip" data-open="prayer-wall">祈願牆</button>
          </div>
        </header>
        <nav class="map" hidden>
          <p>選擇目的地，角色將自動前往</p>
          <button data-go="guanyin-dragon">參拜昇龍觀音</button><button data-go="gold-furnace">八角金亭（化金）</button><button data-go="chess">天心仙姑問事亭</button><button data-go="sky-lantern">天燈祈福</button>
          <button data-go="incense">上香祈福</button><button data-go="yuhuang">後殿凌霄寶殿</button><button data-go="prayer">大殿外廣場・寫下心願</button>
          <button data-go="offerings">虛擬供奉</button><button data-go="lamps">祈福燈區</button><button data-go="daily-lot">每日抽籤</button>
          <button data-go="woodfish">敲木魚</button><button data-go="bell">鳴鐘</button><button data-go="drum">鼓樓擊鼓</button>
          <button data-go="wishing-pool">蓮花許願池</button><button data-go="prayer-wall">大殿外廣場・祈願牆</button><button data-go="records">祈福紀錄</button>
          <button data-go="market-portal">天心靈光市集（建構中）</button>
          <button data-go="unicorn-portal">🦄 獨角獸聖域（建構中）</button>
        </nav>
        <div class="prompt" hidden><b data-prompt-title></b><span data-prompt-sub></span><kbd class="key">E</kbd><button class="btn small primary touch-only" data-act="interact" data-prompt-action>互動</button></div>
        <div class="guide" hidden><span>前往</span><b data-guide-name></b><small data-guide-dist></small><button class="guide-x" data-act="guide-cancel" aria-label="取消指引">×</button></div>
        <div class="mode-bar">
          <button class="btn primary" data-act="explore" data-when="browse">開始探索</button>
        </div>
        <p class="help" data-when="browse">滑鼠點擊／WASD 移動・右鍵拖曳 旋轉視角・滾輪 縮放・點擊／E 互動</p>
        <p class="help" data-when="explore">滑鼠點擊／WASD 移動・右鍵拖曳 旋轉視角・滾輪 縮放・點擊／E 互動</p>
        <div class="touch"><div class="touch-stick"><i></i></div></div>
      </section>
      <section class="screen pause" data-screen="pause"><div class="title-card"><h2>暫歇片刻</h2><p class="lead">點擊下方按鈕繼續參拜。</p><button class="btn primary" data-act="resume">繼續參拜</button></div></section>
      <div class="panel-wrap" hidden><article class="panel"><button class="close" data-act="close" aria-label="關閉">×</button><div class="panel-body"></div></article></div>
      ${renderServiceModal()}
      ${renderLegalModal()}
      ${renderQrLightbox()}
      <div class="wish-banner" hidden></div>
      <div class="npc-dialogue-bar" hidden><span class="npc-icon">💬</span><b class="npc-name"></b><span class="npc-text"></span></div>
      <div class="toast" hidden></div>
      <div class="market-ro-hud" hidden>
        <section class="ro-window ro-mini-nav" aria-label="市集快速導覽">
          <header class="ro-win-bar"><span>🏮 攤位導覽</span><small>點擊走動</small></header>
          <div class="ro-nav-grid">
            <button type="button" data-act="market-walk" data-market-target="birth-chart-hall">紫微斗數 Ziwei</button>
            <button type="button" data-act="market-walk" data-market-target="moon-meditation">靈氣療癒 Reiki</button>
            <button type="button" data-act="market-walk" data-market-target="card-house">塔羅占卜 Tarot</button>
            <button type="button" data-act="market-walk" data-market-target="chess-guide">問事／心靈諮詢</button>
            <button type="button" data-act="market-walk" data-market-target="life-numerology">生命靈數 Numerology</button>
            <button type="button" data-act="market-walk" data-market-target="service-desk">市集服務台</button>
            <button type="button" class="ro-return" data-act="market-walk" data-market-target="return-temple">返回天心宮</button>
          </div>
          <div class="ro-nav-grid" style="padding-top:0;grid-template-columns:1fr 1fr;">
            <button type="button" data-act="market-cam" data-market-cam="eye-level" style="border-color:#b84fba;background:linear-gradient(180deg,#fff2fd,#f6d4f3);color:#5d1c5b;font-weight:700;" title="切換為正面平視攤位視角">👁️ 平視攤位</button>
            <button type="button" data-act="market-cam" data-market-cam="overview" style="border-color:#597ea6;background:linear-gradient(180deg,#ffffff,#e3eef9);color:#203b58;font-weight:700;" title="切換為 2.5D 俯視全景">🦅 俯視全景</button>
          </div>
          <div class="ro-nav-grid" style="padding-top:0;grid-template-columns:1fr 1fr 1fr;">
            <button type="button" data-act="market-cam" data-market-cam="left" title="向左旋轉視角">↺ 左轉</button>
            <button type="button" data-act="market-cam" data-market-cam="reset" title="重設視角">◎ 重設</button>
            <button type="button" data-act="market-cam" data-market-cam="right" title="向右旋轉視角">↻ 右轉</button>
          </div>
        </section>
      </div>
      <div class="market-panel-wrap" hidden><section class="market-panel ro-dialog" role="dialog" aria-modal="true" aria-label="市集介紹"><header class="ro-dialog-bar"><span data-market-dialog-title>天心靈光市集・攤位資訊</span><button class="panel-x" data-act="market-panel-close" aria-label="關閉">×</button></header><div class="ro-dialog-body" data-market-panel-content></div></section></div>
      <div class="ziwei-panel-wrap" hidden><section class="ziwei-panel" role="dialog" aria-modal="true" aria-label="紫微斗數排盤"><button class="panel-x" data-act="ziwei-close" aria-label="關閉">×</button><div data-ziwei-panel-content></div></section></div>
      <div class="world-transition" hidden><div><i></i><b data-world-transition>穿越靈光之門⋯</b><small>正在切換獨立世界</small></div></div>`
    const hudToggle = this.root.querySelector<HTMLButtonElement>('.hud-menu-toggle')
    if (hudToggle) {
      hudToggle.addEventListener('click', () => {
        const expanded = hudToggle.getAttribute('aria-expanded') === 'true'
        hudToggle.setAttribute('aria-expanded', String(!expanded))
        hudToggle.textContent = expanded ? '展開功能 ▼' : '收合功能 ▲'
      })
    }
    this.root.addEventListener('click', e => this.onClick(e))
    window.setInterval(() => {
      if (this.currentTimeSetting === 'auto') {
        const cur = getRealWorldTimeOfDay().mode
        if (cur !== this.currentEffectiveTime) {
          this.currentEffectiveTime = cur
          const btn = this.root.querySelector<HTMLElement>('button[data-act="time"]')
          if (btn) btn.textContent = `⏰ 現實 (${getEffectiveTimeLabel(cur)})`
        }
      }
    }, 8000)
    this.root.addEventListener('submit', e => {
      e.preventDefault()
      const form = e.target as HTMLFormElement
      if (form.matches('.ziwei-form')) { void this.generateZiwei(form); return }
      if (form.matches('.hd-form')) { void this.generateHumanDesign(form); return }
      if (form.matches('.num-calc-form')) { this.handleNumerologySubmit(form); return }
      const text = (form.elements.namedItem('wish') as HTMLTextAreaElement).value
      const wish = this.store.submitWish(text)
      if (!wish) { this.toast('請先寫下你的心願'); return }
      this.actions.ritual('wish')
      this.open('prayer-wall', '你的心願已安放在祈願牆。')
    })
    this.root.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return
      const overlay = this.root.querySelector<HTMLElement>('[data-qr-lightbox]:not([hidden]), [data-legal-modal]:not([hidden]), [data-service-modal]:not([hidden])')
      if (overlay) { e.stopPropagation(); overlay.hidden = true; return }
      const marketPanel = this.root.querySelector<HTMLElement>('.market-panel-wrap')
      if (marketPanel && !marketPanel.hidden) {
        e.stopPropagation()
        this.closeMarketPanel()
        window.dispatchEvent(new CustomEvent('market:close-panel'))
        return
      }
      const ziweiPanel = this.root.querySelector<HTMLElement>('.ziwei-panel-wrap')
      if (ziweiPanel && !ziweiPanel.hidden) {
        e.stopPropagation()
        this.closeZiweiPanel()
        window.dispatchEvent(new CustomEvent('market:close-panel'))
        return
      }
      if (!this.panelHidden) { e.stopPropagation(); this.actions.closePanel() }
    })
    window.addEventListener('market:weather', e => {
      const info = (e as CustomEvent<any>).detail
      if (!info) return
      const badge = this.root.querySelector<HTMLElement>('[data-market-weather]')
      if (badge) {
        const icon = info.condition === 'rainy' ? '🌧️' : info.condition === 'cloudy' ? '☁️' : info.isDay ? '☀️' : '🌙'
        badge.textContent = `${icon} 台中：${info.description} ${info.temperature}°C`
      }
      const charMode = this.root.querySelector<HTMLElement>('.ro-char-row span')
      if (charMode) {
        charMode.textContent = `${info.isDay ? '日間' : '夜間'}漫步・${info.description}`
      }
    })
    this.refreshCharacter()
  }

  private get panelHidden(): boolean { return this.root.querySelector<HTMLElement>('.panel-wrap')!.hidden }

  show(screen: string): void {
    this.screen = screen
    for (const el of this.root.querySelectorAll<HTMLElement>('[data-screen]')) el.classList.toggle('on', el.dataset.screen === screen)
  }

  /** Reflect browse/explore mode in the HUD (button, help line, body class for cursor styling). */
  setMode(mode: string): void {
    const hud = this.root.querySelector<HTMLElement>('.hud')!
    hud.dataset.mode = mode
    document.body.dataset.mode = mode
  }

  setWorld(world: 'temple' | 'market'): void {
    document.body.dataset.world = world
    const roHud = this.root.querySelector<HTMLElement>('.market-ro-hud')
    if (roHud) roHud.hidden = world !== 'market'
    const helpText = world === 'market'
      ? '左鍵點擊地面走動／WASD 移動・右鍵拖曳 360° 旋轉（上下微調平視/俯視）・滾輪縮放・點擊右上角「平視攤位」一鍵切換'
      : '滑鼠點擊／WASD 移動・右鍵拖曳 旋轉視角・滾輪 縮放・點擊／E 互動'
    for (const el of this.root.querySelectorAll<HTMLElement>('.help')) el.textContent = helpText
    if (world === 'market') {
      this.closePanel()
      this.guideTo(null, 0)
    } else {
      this.closeMarketPanel()
      this.closeZiweiPanel()
      window.clearInterval(this.meditationTimer)
      this.meditationRunning = false
      this.actions.stopMeditationAmbient()
      this.meditationAmbient = false
    }
  }

  setWorldTransition(active: boolean, message = ''): void {
    const overlay = this.root.querySelector<HTMLElement>('.world-transition')
    if (!overlay) return
    overlay.hidden = !active
    const text = overlay.querySelector<HTMLElement>('[data-world-transition]')
    if (text && message) text.textContent = message
    if (active) {
      this.near(null)
      this.guideTo(null, 0)
    }
  }

  guideTo(point: ShrinePoint | null, distance: number): void {
    const el = this.root.querySelector<HTMLElement>('.guide')!
    el.hidden = !point
    if (!point) return
    el.querySelector('[data-guide-name]')!.textContent = point.title
    el.querySelector('[data-guide-dist]')!.textContent = `約 ${Math.max(1, Math.round(distance))} 公尺`
  }

  get panelOpen(): boolean { return !this.panelHidden }

  setBootProgress(v: number): void {
    const bar = this.root.querySelector<HTMLElement>('.boot .bar i')
    if (bar?.style) bar.style.width = `${Math.round(v * 100)}%`
  }

  refreshCharacter(): void {
    const cur = this.store.data.character
    for (const b of this.root.querySelectorAll<HTMLElement>('[data-char]')) b.classList.toggle('on', b.dataset.char === cur)
    const c = CHARACTERS.find(x => x.id === cur)!
    this.root.querySelector<HTMLElement>('[data-who]')!.textContent = `${c.title}・${c.name}`
  }

  near(point: ShrinePoint | MarketPoint | null): void {
    const el = this.root.querySelector<HTMLElement>('.prompt')!
    const action = el.querySelector<HTMLButtonElement>('[data-prompt-action]')!
    el.hidden = !point
    if (!point) {
      action.classList.remove('portal-entry')
      action.textContent = '互動'
      return
    }
    el.querySelector('[data-prompt-title]')!.textContent = point.title
    el.querySelector('[data-prompt-sub]')!.textContent = point.subtitle
    // A guided destination should never end on a keyboard-only dead end.
    // Both the temple portal and the market return portal expose a clear CTA.
    const id = (point as { id: string }).id
    const isPortal = id === 'market-portal' || id === 'unicorn-portal' || id === 'return-temple'
    const isMarketVenue = ['birth-chart-hall', 'card-house', 'moon-meditation', 'chess-guide', 'service-desk', 'life-numerology'].includes(id)
    action.classList.toggle('portal-entry', isPortal || isMarketVenue)
    action.textContent = id === 'market-portal' ? '進入市集（建構中）' : id === 'unicorn-portal' ? '踏入聖域（建構中）' : id === 'return-temple' ? '返回天心宮' : isMarketVenue ? '進入攤位' : '互動'
  }

  openMarketPanel(id: MarketVenueId): void {
    this.currentMarketVenue = id
    const wrap = this.root.querySelector<HTMLElement>('.market-panel-wrap')!
    wrap.hidden = false
    switch (id) {
      case 'birth-chart-hall':
        void this.openBirthChartExperience()
        break
      case 'card-house':
        void this.openCardExperience()
        break
      case 'moon-meditation':
        this.openMeditationExperience()
        break
      case 'chess-guide':
        this.openMarketChessExperience()
        break
      case 'service-desk':
        this.openServiceDeskExperience()
        break
      case 'life-numerology':
        this.openNumerologyExperience()
        break
    }
  }

  closeMarketPanel(): void {
    const wrap = this.root.querySelector<HTMLElement>('.market-panel-wrap')
    if (wrap) wrap.hidden = true
    this.currentMarketVenue = null
    window.clearInterval(this.meditationTimer)
    this.meditationRunning = false
    if (this.meditationAmbient) this.actions.stopMeditationAmbient()
    this.meditationAmbient = false
  }

  private setMarketDialogTitle(title: string): void {
    const titleEl = this.root.querySelector<HTMLElement>('[data-market-dialog-title]')
    if (titleEl) titleEl.textContent = title
  }

  async openBirthChartExperience(): Promise<void> {
    const { listZiweiCharts } = await import('../game/ziwei-storage')
    this.ziweiSavedCount = listZiweiCharts().length
    this.humanDesignSavedCount = listHumanDesignCharts().length
    this.setMarketDialogTitle('天心靈光市集・命盤探索館')
    this.renderBirthChartExperience()
  }

  private renderBirthChartExperience(): void {
    const content = this.root.querySelector<HTMLElement>('[data-market-panel-content]')!
    content.innerHTML = `
      <p class="eyebrow">命盤探索館・自我導引</p>
      <h2>命盤與身心探索</h2>
      <p class="venue-intro">在靈光市集探索你的星曜軌跡與能量藍圖。出生資料僅於本機運算，不公開、不上傳。</p>
      <div class="ro-tab-bar">
        <button type="button" class="ro-tab-btn ${this.birthChartTab === 'ziwei' ? 'active' : ''}" data-act="market-birth-tab" data-tab="ziwei">紫微斗數排盤</button>
        <button type="button" class="ro-tab-btn ${this.birthChartTab === 'human-design' ? 'active' : ''}" data-act="market-birth-tab" data-tab="human-design">人類圖身心探索</button>
      </div>
      ${this.birthChartTab === 'ziwei' ? this.renderZiweiInner() : this.renderHumanDesignInner()}
      <div class="row" style="margin-top: 14px;">
        <button class="btn" data-act="market-panel-close">繼續探索市集</button>
      </div>
    `
  }

  async openZiweiPanel(): Promise<void> {
    const { listZiweiCharts } = await import('../game/ziwei-storage')
    this.ziweiSavedCount = listZiweiCharts().length
    this.ziweiError = ''
    this.renderZiweiPanel()
    this.root.querySelector<HTMLElement>('.ziwei-panel-wrap')!.hidden = false
  }

  closeZiweiPanel(): void {
    const wrap = this.root.querySelector<HTMLElement>('.ziwei-panel-wrap')
    if (wrap) wrap.hidden = true
  }

  private renderZiweiPanel(): void {
    const content = this.root.querySelector<HTMLElement>('[data-ziwei-panel-content]')!
    content.innerHTML = `
      <p class="eyebrow">命盤探索館・紫微斗數</p><h2>本機紫微斗數排盤</h2>
      ${this.renderZiweiInner()}`
  }

  private renderZiweiInner(): string {
    const chart = this.ziweiChart
    const error = this.ziweiError ? `<p class="ziwei-error" role="alert">${esc(this.ziweiError)}</p>` : ''
    const result = chart ? `
      <section class="ziwei-result">
        <div class="ziwei-summary"><b>十二宮本命盤</b><span>iztro ${esc(chart.engine.version)} ・本機運算</span></div>
        ${chart.precisionNotice ? `<p class="ziwei-warning">${esc(chart.precisionNotice)}</p>` : ''}
        <p class="ziwei-meta">農曆：${esc(chart.lunarDate)} ・時辰：${esc(chart.timeLabel)}（${esc(chart.timeRange)}）・五行局：${esc(chart.fiveElementsClass)}</p>
        <p class="ziwei-meta">命主：${esc(chart.soul)} ・身主：${esc(chart.body)}</p>
        <div class="ziwei-grid">${chart.palaces.map(palace => `<article class="ziwei-palace ${palace.name === '命宮' ? 'life' : ''}"><b>${esc(palace.name)}${palace.isBodyPalace ? '・身宮' : ''}</b><small>${esc(palace.earthlyBranch)}</small><span>${esc(palace.majorStars.join('、') || '—')}</span><em>${esc(palace.minorStars.join('、') || '')}</em></article>`).join('')}</div>
        <p class="ziwei-reflection">${esc(chart.reflection)}</p>
        <p class="ziwei-meta">生年四化：${chart.transformations.length ? chart.transformations.map(item => `${esc(item.star)}化${esc(item.kind)}（${esc(item.palace)}）`).join('、') : '本盤未列出'}</p>
        <div class="row"><button class="btn primary" data-act="ziwei-save">儲存到此裝置</button><button class="btn" data-act="contact">出生時間不確定？洽 LINE</button></div>
      </section>` : ''
    return `
      <p class="ziwei-privacy">出生資料預設只在這次本機運算中使用，不上傳、不公開，也不會寫入祈願牆。只有按「儲存到此裝置」才會保存在這個瀏覽器。</p>
      <form class="ziwei-form">
        <label>識別名稱（選填，最多 20 字）<input name="alias" maxlength="20" autocomplete="off" placeholder="暱稱、代號或計畫名稱" /></label>
        <div class="ziwei-form-grid"><label>出生日期<input name="date" type="date" required value="1995-06-15" /></label><label>排盤性別<select name="gender"><option value="female">女</option><option value="male">男</option></select></label></div>
        <label>出生時間（當地時間）<input name="time" type="time" value="12:00" /></label>
        <label class="ziwei-check"><input name="timeUnknown" type="checkbox" /> 出生時間不確定（將以子時作技術參考並標示低精準度）</label>
        <div class="ziwei-form-grid"><label>出生地：國家／地區<input name="country" required maxlength="40" autocomplete="country-name" value="台灣" /></label><label>出生城市<input name="city" required maxlength="40" autocomplete="address-level2" value="台北市" /></label></div>
        <button class="btn primary big" type="submit">產生十二宮命盤</button>
      </form>
      ${error}${result}
      <div class="ziwei-storage"><span>此裝置已儲存 ${this.ziweiSavedCount} 筆命盤。</span><button class="btn small" data-act="ziwei-clear" ${this.ziweiSavedCount ? '' : 'disabled'}>清除本機紀錄</button></div>
      <p class="ziwei-disclaimer">盤面資料與文字僅供自我理解與民俗文化參考，不構成醫療、法律、財務或任何保證性建議。</p>`
  }

  private renderHumanDesignInner(): string {
    const chart = this.humanDesignChart
    const error = this.humanDesignError ? `<p class="ziwei-error" role="alert">${esc(this.humanDesignError)}</p>` : ''
    const result = chart ? `
      <section class="ro-hd-result">
        <div class="ziwei-summary">
          <b>身心能量天賦設計圖</b>
          <span>astronomy-engine ${esc(chart.engine.astronomyEngineVersion)}・本機推演</span>
        </div>
        ${chart.precisionNotice ? `<p class="ziwei-warning">${esc(chart.precisionNotice)}</p>` : ''}
        
        <div class="ro-hd-cards-grid">
          <div class="ro-hd-card">
            <span class="ro-hd-label">能量類型</span>
            <b class="ro-hd-val">${esc(chart.type)}</b>
          </div>
          <div class="ro-hd-card">
            <span class="ro-hd-label">人生策略</span>
            <b class="ro-hd-val">${esc(chart.strategy)}</b>
          </div>
          <div class="ro-hd-card">
            <span class="ro-hd-label">內在權威</span>
            <b class="ro-hd-val">${esc(chart.authority)}</b>
          </div>
          <div class="ro-hd-card">
            <span class="ro-hd-label">人生角色</span>
            <b class="ro-hd-val">${esc(chart.profile)}</b>
          </div>
        </div>

        <div class="ro-hd-section">
          <h4>九大能量中心（定義狀態）</h4>
          <div class="ro-centers-grid">
            ${chart.centers.map(c => `
              <div class="ro-center-pill ${c.defined ? 'is-defined' : 'is-open'}">
                <span class="center-dot"></span>
                <b>${esc(c.name)}</b>
                <small>${c.defined ? '已定義' : '開放/未定義'}</small>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="ro-hd-section">
          <h4>已接通通道（天賦能量）</h4>
          ${chart.channels.length > 0 ? `
            <ul class="ro-channels-list">
              ${chart.channels.map(ch => `
                <li>
                  <span class="channel-badge">通道 ${ch.gates[0]} - ${ch.gates[1]}</span>
                  <span class="channel-centers">${esc(ch.centers[0])} ↔ ${esc(ch.centers[1])}</span>
                </li>
              `).join('')}
            </ul>
          ` : `<p class="ro-subtext">無完全接通之通道（無固定通道連結中心，屬純開放能量流動）。</p>`}
        </div>

        <div class="ro-hd-section">
          <h4>活化閘門總覽（共 ${chart.gates.length} 個）</h4>
          <div class="ro-gates-tags">
            ${chart.gates.map(g => `<span class="ro-gate-tag">閘門 ${g}</span>`).join('')}
          </div>
        </div>

        <details class="ro-planets-details">
          <summary>查看行星活化對照（個性／黑 vs 設計／紅）</summary>
          <div class="ro-planets-grid">
            <div class="ro-planet-col">
              <h5>個性 Personality（意識／黑）</h5>
              <ul>
                ${chart.personality.map(p => `<li><b>${esc(p.body)}</b><span>閘門 ${p.gate}.${p.line}</span></li>`).join('')}
              </ul>
            </div>
            <div class="ro-planet-col design-col">
              <h5>設計 Design（潛意識／紅）</h5>
              <ul>
                ${chart.design.map(d => `<li><b>${esc(d.body)}</b><span>閘門 ${d.gate}.${d.line}</span></li>`).join('')}
              </ul>
            </div>
          </div>
        </details>

        <p class="ziwei-reflection">💡 核心指引：遵循你的「${esc(chart.strategy)}」人生策略，並以「${esc(chart.authority)}」做重大決定，允許自己回歸自然的身體節奏，放下外在期待的制約。</p>
        <div class="row">
          <button class="btn primary" data-act="hd-save">儲存人類圖到此裝置</button>
          <button class="btn" data-act="contact">預約深度人類圖諮詢</button>
        </div>
      </section>
    ` : ''

    const defaultTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Taipei'

    return `
      <p class="ziwei-privacy">出生資料僅在此裝置由天文演算法即時推算，不上傳雲端，保護個人私隱。只有點選「儲存到此裝置」才會保留。</p>
      <form class="hd-form">
        <label>識別名稱（選填，最多 20 字）<input name="alias" maxlength="20" autocomplete="off" placeholder="代號、暱稱或心靈代稱" /></label>
        <div class="ziwei-form-grid">
          <label>出生日期<input name="date" type="date" required value="1995-06-15" /></label>
          <label>出生時間（當地時間）<input name="time" type="time" value="12:00" /></label>
        </div>
        <label class="ziwei-check"><input name="timeUnknown" type="checkbox" /> 出生時間不確定（將以中午 12:00 作技術參考並標示低精準度）</label>
        <div class="ziwei-form-grid">
          <label>出生國家／地區<input name="country" required maxlength="40" autocomplete="country-name" value="台灣" /></label>
          <label>出生城市<input name="city" required maxlength="40" autocomplete="address-level2" value="台北市" /></label>
        </div>
        <label>IANA 時區（自動偵測）<input name="timeZone" required maxlength="60" value="${esc(defaultTz)}" /></label>
        <button class="btn primary big" type="submit">產生人類圖設計藍圖</button>
      </form>
      ${error}${result}
      <div class="ziwei-storage">
        <span>此裝置已儲存 ${this.humanDesignSavedCount} 筆人類圖。</span>
        <button class="btn small" data-act="hd-clear" ${this.humanDesignSavedCount ? '' : 'disabled'}>清除本機紀錄</button>
      </div>
      <p class="ziwei-disclaimer">人類圖是探索自我覺察、能量模式與決策風格的輔助工具，不取代醫療、心理諮商、法律或財務之專業判斷。</p>
    `
  }

  private async generateZiwei(form: HTMLFormElement): Promise<void> {
    const value = new FormData(form)
    const input: ZiweiInput = {
      alias: String(value.get('alias') ?? '').trim() || undefined,
      date: String(value.get('date') ?? ''),
      time: String(value.get('time') ?? '') || undefined,
      timeUnknown: value.get('timeUnknown') === 'on',
      country: String(value.get('country') ?? '').trim(),
      city: String(value.get('city') ?? '').trim(),
      gender: value.get('gender') === 'male' ? 'male' : 'female',
    }
    try {
      const { createZiweiChart } = await import('../game/ziwei-engine')
      this.ziweiInput = input
      this.ziweiChart = createZiweiChart(input)
      this.ziweiError = ''
    } catch (error) {
      this.ziweiError = (error as Error).message || '排盤失敗，請確認輸入資料。'
    }
    if (this.currentMarketVenue === 'birth-chart-hall') {
      this.renderBirthChartExperience()
    } else {
      this.renderZiweiPanel()
    }
  }

  private async saveZiwei(): Promise<void> {
    if (!this.ziweiInput || !this.ziweiChart) return
    const { saveZiweiChart } = await import('../game/ziwei-storage')
    this.ziweiSavedCount = saveZiweiChart(this.ziweiInput, this.ziweiChart).length
    if (this.currentMarketVenue === 'birth-chart-hall') {
      this.renderBirthChartExperience()
    } else {
      this.renderZiweiPanel()
    }
    this.toast('命盤已依你的指示儲存在此裝置。')
  }

  private async clearZiwei(): Promise<void> {
    const { clearZiweiCharts } = await import('../game/ziwei-storage')
    clearZiweiCharts()
    this.ziweiSavedCount = 0
    if (this.currentMarketVenue === 'birth-chart-hall') {
      this.renderBirthChartExperience()
    } else {
      this.renderZiweiPanel()
    }
    this.toast('已清除這個瀏覽器中的紫微命盤紀錄。')
  }

  private async generateHumanDesign(form: HTMLFormElement): Promise<void> {
    const value = new FormData(form)
    const timeUnknown = value.get('timeUnknown') === 'on'
    const input: HumanDesignInput = {
      alias: String(value.get('alias') ?? '').trim() || undefined,
      date: String(value.get('date') ?? ''),
      time: String(value.get('time') ?? '') || undefined,
      timeUnknown,
      country: String(value.get('country') ?? '').trim(),
      city: String(value.get('city') ?? '').trim(),
      timeZone: String(value.get('timeZone') ?? '').trim() || (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Taipei'),
    }
    try {
      const { createHumanDesignChart } = await import('../game/human-design-engine')
      this.humanDesignInput = input
      this.humanDesignChart = createHumanDesignChart(input)
      this.humanDesignError = ''
    } catch (error) {
      this.humanDesignError = (error as Error).message || '計算失敗，請確認輸入資料。'
    }
    this.renderBirthChartExperience()
  }

  private async saveHumanDesign(): Promise<void> {
    if (!this.humanDesignInput || !this.humanDesignChart) return
    this.humanDesignSavedCount = saveHumanDesignChart(this.humanDesignInput, this.humanDesignChart).length
    this.renderBirthChartExperience()
    this.toast('人類圖設計已依你的指示儲存在此裝置。')
  }

  private async clearHumanDesign(): Promise<void> {
    clearHumanDesignCharts()
    this.humanDesignSavedCount = 0
    this.renderBirthChartExperience()
    this.toast('已清除此裝置中的人類圖紀錄。')
  }

  async openCardExperience(): Promise<void> {
    const { listCardNotes } = await import('../game/card-storage')
    this.cardNoteCount = listCardNotes().length
    this.setMarketDialogTitle('天心靈光市集・牌卡靈感屋')
    this.renderCardExperience()
  }

  private renderCardExperience(): void {
    const content = this.root.querySelector<HTMLElement>('[data-market-panel-content]')!
    const daily = getDailyCard()
    const spread = this.cardSpread
    const card = (item: typeof daily, position?: string) => `<article class="reflection-card" style="--card-color:${item.color}"><i>${item.symbol}</i><small>${position || '今日訊息'}</small><b>${item.name}</b><span>${item.keywords.join('・')}</span><p>${item.reflection}</p><em>${item.question}</em></article>`
    const spreadView = spread ? `<section class="spread-result"><h3>${TOPIC_LABELS[spread.topic]}・三張牌反思</h3><div class="spread-grid">${spread.cards.map((item, index) => card(item, ['過去', '現在', '建議'][index])).join('')}</div><label class="card-note-label">可選本機筆記<textarea class="card-note" maxlength="500" rows="3" placeholder="寫下你想記住的感受或下一步；不會自動儲存。"></textarea></label><div class="row"><button class="btn primary" data-act="card-save-note">儲存筆記到此裝置</button></div></section>` : ''
    content.innerHTML = `<p class="eyebrow">牌卡靈感屋</p><h2>牌卡反思</h2><p>牌卡是整理當下感受的提示，不預測未來，也不替你做醫療、法律、財務或重大人生決定。</p><section class="daily-card"><div><h3>每日一張・${new Date().toLocaleDateString('sv-SE')}</h3><p>同一個本地日期固定同一張牌，不提供同日重抽；隔日會更新。</p></div>${card(daily)}</section><section class="spread-picker"><h3>三張牌問事</h3><p>選擇一個反思主題；位置固定為「過去／現在／建議」。</p><div class="topic-row">${(Object.keys(TOPIC_LABELS) as CardTopic[]).map(topic => `<button class="btn small" data-act="card-draw-spread" data-card-topic="${topic}">${TOPIC_LABELS[topic]}</button>`).join('')}</div></section>${spreadView}<div class="reflection-storage"><span>此裝置已儲存 ${this.cardNoteCount} 則牌卡筆記。</span><button class="btn small" data-act="card-clear-notes" ${this.cardNoteCount ? '' : 'disabled'}>清除本機筆記</button></div><div class="row" style="margin-top: 14px;"><button class="btn" data-act="market-panel-close">繼續探索市集</button></div>`
  }

  private drawCardSpread(topic: CardTopic): void {
    this.cardSpread = drawThreeCards(topic)
    this.renderCardExperience()
  }

  private async saveCardNote(): Promise<void> {
    if (!this.cardSpread) return
    const note = this.root.querySelector<HTMLTextAreaElement>('.card-note')?.value ?? ''
    const { saveCardNote } = await import('../game/card-storage')
    this.cardNoteCount = saveCardNote(this.cardSpread, note).length
    this.renderCardExperience()
    this.toast(note.trim() ? '牌卡筆記已儲存在此裝置。' : '請先寫下想保存的筆記。')
  }

  private async clearCardNotes(): Promise<void> {
    const { clearCardNotes } = await import('../game/card-storage')
    clearCardNotes()
    this.cardNoteCount = 0
    this.renderCardExperience()
    this.toast('已清除這個瀏覽器中的牌卡筆記。')
  }

  openMeditationExperience(): void {
    this.setMarketDialogTitle('天心靈光市集・月光靜心所')
    this.renderMeditationExperience()
  }

  private renderMeditationExperience(): void {
    const content = this.root.querySelector<HTMLElement>('[data-market-panel-content]')!
    const elapsed = 60 - this.meditationSeconds
    const inCycle = elapsed % 12
    const phase = inCycle < 4 ? '吸氣 4 秒' : inCycle < 6 ? '停留 2 秒' : '吐氣 6 秒'
    const detail = this.meditationRunning ? `剩餘 ${this.meditationSeconds} 秒・${phase}` : this.meditationSeconds === 0 ? '60 秒練習完成，感受此刻的呼吸與身體。' : '準備好後，開始 60 秒呼吸練習。'
    content.innerHTML = `<p class="eyebrow">月光靜心所</p><h2>60 秒呼吸靜心</h2><p>找一個舒適姿勢，不必追求完美；只要溫和地把注意力帶回呼吸。</p><section class="breathing-card"><div class="breathing-orb ${this.meditationRunning ? 'active' : ''}"><span>${this.meditationSeconds}</span><small>秒</small></div><b>${detail}</b><p>吸氣時感受空氣進入，吐氣時讓肩膀與下顎慢慢放鬆。</p><div class="row"><button class="btn primary" data-act="meditation-start" ${this.meditationRunning ? 'disabled' : ''}>${this.meditationSeconds === 60 ? '開始 60 秒引導' : '重新開始'}</button><button class="btn" data-act="meditation-stop" ${this.meditationRunning ? '' : 'disabled'}>暫停</button></div></section><section class="meditation-text"><h3>靜心文字</h3><p>此刻不需要解決所有事情。請給自己一分鐘，讓念頭來去；若感到不適，隨時停止並回到熟悉、安全的環境。</p></section><section class="ambient-card"><h3>環境音</h3><p>環境音預設關閉，僅在你按下按鈕後播放。</p><button class="btn ${this.meditationAmbient ? '' : 'primary'}" data-act="meditation-ambient">${this.meditationAmbient ? '停止環境音' : '播放環境音'}</button></section><section class="meditation-text"><h3>靈氣服務與預約</h3><p>服務內容與安排將由宮方確認後公告；此頁不宣稱療效、診斷或可取代醫療與心理專業。</p><button class="btn" data-act="contact">洽 LINE 詢問</button></section><div class="row" style="margin-top: 14px;"><button class="btn" data-act="market-panel-close">繼續探索市集</button></div>`
  }

  private startMeditation(): void {
    window.clearInterval(this.meditationTimer)
    this.meditationSeconds = 60
    this.meditationRunning = true
    this.renderMeditationExperience()
    this.meditationTimer = window.setInterval(() => {
      this.meditationSeconds = Math.max(0, this.meditationSeconds - 1)
      if (this.meditationSeconds === 0) {
        window.clearInterval(this.meditationTimer)
        this.meditationRunning = false
        this.toast('60 秒呼吸練習完成。')
      }
      this.renderMeditationExperience()
    }, 1000)
  }

  private stopMeditation(): void {
    window.clearInterval(this.meditationTimer)
    this.meditationRunning = false
    this.renderMeditationExperience()
  }

  openMarketChessExperience(): void {
    this.setMarketDialogTitle('天心靈光市集・東方問事指引亭')
    this.renderMarketChessExperience()
  }

  private renderMarketChessExperience(): void {
    const content = this.root.querySelector<HTMLElement>('[data-market-panel-content]')!
    const gua = this.store.currentCrossGua ?? this.store.startCrossGua()
    
    const renderSlot = (pos: ChessPos) => {
      const slot = gua.slots[pos]
      const meta = POS_META[pos]
      if (slot.revealed) {
        return `
          <div class="chess-slot-cell ${pos}">
            <span class="slot-pos-label">${meta.label}</span>
            <div class="piece revealed ${slot.piece.color}" title="${meta.label}：${slot.piece.name}">${slot.piece.name}</div>
            <span class="slot-aspect-tag">${meta.aspect}</span>
          </div>
        `
      }
      return `
        <div class="chess-slot-cell ${pos}">
          <span class="slot-pos-label">${meta.label}</span>
          <button type="button" class="piece unrevealed pulse" data-market-flip-pos="${pos}" title="點擊翻開 ${meta.label}">
            <span class="piece-back-inner">仙</span>
          </button>
          <span class="slot-aspect-tag flip-hint">點擊翻開</span>
        </div>
      `
    }

    const levelBadgeClass: Record<string, string> = {
      大吉: 'badge-grand-luck',
      吉: 'badge-luck',
      平: 'badge-fair',
      守中: 'badge-guard',
      需慎: 'badge-caution',
    }
    const badgeClass = levelBadgeClass[gua.level] || 'badge-luck'
    const posIndexNames = ['中宮・主位', '左方・客方', '右方・主方', '上方・天時', '下方・地利']

    const formationsHtml = gua.analysis.formations.length > 0
      ? gua.analysis.formations.map(f => `
          <div class="formation-item">
            <div class="formation-item-title">🔮 ${esc(f.name)}</div>
            <div class="formation-item-desc">${esc(f.description)}</div>
          </div>
        `).join('')
      : `
          <div class="formation-item">
            <div class="formation-item-desc">${esc(gua.summary)}</div>
          </div>
        `

    const recordsHtml = gua.analysis.records.length > 0
      ? `
        <details class="chess-records-details">
          <summary>查看十字吃子捕捉明細（共 ${gua.analysis.records.length} 筆）</summary>
          <div class="records-content">
            <ul class="records-list">
              ${gua.analysis.records.map(r => `
                <li class="${r.isGain ? 'record-gain' : 'record-loss'}">
                  <span class="record-badge">${r.isGain ? '收獲' : '付出'}</span>
                  <b>${posIndexNames[r.attackerPos]} [${esc(r.attacker.character)}]</b> 捕捉 <b>${posIndexNames[r.targetPos]} [${esc(r.target.character)}]</b>
                  <span class="record-score">${r.isGain ? '+' : '-'}${r.score}分</span>
                </li>
              `).join('')}
            </ul>
          </div>
        </details>
      `
      : ''

    const resultCard = gua.allRevealed ? `
      <div class="chess-result-box" style="margin-top: 14px;">
        <div class="result-head">
          <span class="result-level-badge ${badgeClass}">${gua.level}</span>
          <h3 class="result-pattern-name">${esc(gua.patternName)}</h3>
        </div>

        <div class="result-score-bar">
          <div class="score-item score-gain">
            <span class="score-label">收獲</span>
            <b class="score-val">${gua.analysis.gains}</b>
            <span class="score-unit">分</span>
          </div>
          <span class="score-sym">${gua.analysis.compareSymbol}</span>
          <div class="score-item score-loss">
            <span class="score-label">付出</span>
            <b class="score-val">${gua.analysis.losses}</b>
            <span class="score-unit">分</span>
          </div>
        </div>

        <div class="result-formations">${formationsHtml}</div>
        ${recordsHtml}

        <div class="result-summary-section" style="margin: 12px 0; padding: 10px 12px; background: rgba(243,197,122,.12); border-left: 3px solid #d99616; border-radius: 4px;">
          <div class="advice-line"><b>仙姑指點心法：</b>${esc(gua.advice)}</div>
        </div>

        <div class="result-pos-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin: 12px 0;">
          <div class="pos-item center-item" style="grid-column: span 2; padding: 8px 10px; background: #fff; border: 1px solid #cbdbeb; border-radius: 6px;">
            <span class="pos-badge" style="font-weight: 700; color: #b87b14; font-size: 11px;">中宮・本質</span>
            <p style="margin: 3px 0 0; font-size: 12px; color: #243f5a;">${esc(gua.posInterpretations.center)}</p>
          </div>
          <div class="pos-item" style="padding: 8px 10px; background: #fff; border: 1px solid #cbdbeb; border-radius: 6px;">
            <span class="pos-badge" style="font-weight: 700; color: #2e5984; font-size: 11px;">上方・天時</span>
            <p style="margin: 3px 0 0; font-size: 12px; color: #243f5a;">${esc(gua.posInterpretations.top)}</p>
          </div>
          <div class="pos-item" style="padding: 8px 10px; background: #fff; border: 1px solid #cbdbeb; border-radius: 6px;">
            <span class="pos-badge" style="font-weight: 700; color: #2e5984; font-size: 11px;">下方・地利</span>
            <p style="margin: 3px 0 0; font-size: 12px; color: #243f5a;">${esc(gua.posInterpretations.bottom)}</p>
          </div>
          <div class="pos-item" style="padding: 8px 10px; background: #fff; border: 1px solid #cbdbeb; border-radius: 6px;">
            <span class="pos-badge" style="font-weight: 700; color: #2e5984; font-size: 11px;">左方・客方</span>
            <p style="margin: 3px 0 0; font-size: 12px; color: #243f5a;">${esc(gua.posInterpretations.left)}</p>
          </div>
          <div class="pos-item" style="padding: 8px 10px; background: #fff; border: 1px solid #cbdbeb; border-radius: 6px;">
            <span class="pos-badge" style="font-weight: 700; color: #2e5984; font-size: 11px;">右方・主方</span>
            <p style="margin: 3px 0 0; font-size: 12px; color: #243f5a;">${esc(gua.posInterpretations.right)}</p>
          </div>
        </div>

        <div class="row" style="margin-top: 12px; flex-wrap: wrap;">
          <button class="btn primary small" data-act="market-chess-copy">📋 複製分享籤文</button>
          <button class="btn small" data-act="market-chess-restart">🔄 重新排卦</button>
          <button class="btn small" data-travel="chess">⛩️ 傳送回本堂問事亭</button>
          <button class="btn small" data-act="contact">洽 LINE 人工解卦</button>
        </div>
      </div>
    ` : `
      <div class="chess-actions-bar" style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn primary small" data-act="market-chess-flip-all">⚡ 一鍵翻開全部五星</button>
        <button class="btn small" data-act="market-chess-restart">🔄 重新洗牌</button>
      </div>
    `

    content.innerHTML = `
      <p class="eyebrow">天心仙姑問事・市集駐點</p>
      <h2>東方問事指引亭・現場十字五星排卦</h2>
      <p class="venue-intro">在靈光市集現場即刻起卦！心中默念所求之事（事業、感情、抉擇或困惑），依序點擊翻開五方星位，觀測吉凶生剋與格局意象。</p>
      
      <div class="chess-cross-board">
        <div class="cross-row top-row">
          ${renderSlot('top')}
        </div>
        <div class="cross-row mid-row">
          ${renderSlot('left')}
          ${renderSlot('center')}
          ${renderSlot('right')}
        </div>
        <div class="cross-row bottom-row">
          ${renderSlot('bottom')}
        </div>
      </div>

      ${resultCard}

      <div class="row" style="margin-top: 18px;">
        <button class="btn" data-act="market-panel-close">繼續探索市集</button>
      </div>
    `
  }

  private loadServiceDeskMemo(): string {
    try {
      const raw = localStorage.getItem('tianxin.service-desk.memo.v1')
      return typeof raw === 'string' ? raw.slice(0, 600) : ''
    } catch { return '' }
  }

  private saveServiceDeskMemo(text: string): void {
    const safeMemo = typeof text === 'string' ? text.trim().slice(0, 600) : ''
    try {
      localStorage.setItem('tianxin.service-desk.memo.v1', safeMemo)
      this.serviceDeskMemo = safeMemo
      this.toast('旅人提問備忘已儲存在此裝置。')
    } catch { /* storage disabled */ }
  }

  private clearServiceDeskMemo(): void {
    try {
      localStorage.removeItem('tianxin.service-desk.memo.v1')
      this.serviceDeskMemo = ''
      this.toast('已清除此裝置的提問備忘。')
    } catch { /* storage disabled */ }
  }

  private async travelFromMarket(pointId: ShrinePointId): Promise<void> {
    this.closeMarketPanel()
    window.dispatchEvent(new CustomEvent('market:close-panel'))
    window.dispatchEvent(new CustomEvent('market:travel-temple', { detail: pointId }))
  }

  openServiceDeskExperience(): void {
    this.serviceDeskMemo = this.loadServiceDeskMemo()
    this.renderServiceDeskExperience()
  }

  private renderServiceDeskExperience(): void {
    this.setMarketDialogTitle('天心靈光市集・服務台（卡普拉接待所）')
    const content = this.root.querySelector<HTMLElement>('[data-market-panel-content]')!
    content.innerHTML = `
      <p class="eyebrow">市集接待與諮詢總覽</p>
      <h2>服務台（卡普拉接待所）</h2>
      <p class="venue-intro">歡迎蒞臨天心靈光市集！服務台匯整天心仙姑各項神明問事、命理探索、能量療癒與祈福點燈服務，亦提供旅人私密提問備忘與各殿堂快速傳送。</p>
      
      <section class="ro-service-grid">
        <article class="ro-service-card">
          <div class="ro-service-icon">🔮</div>
          <div class="ro-service-body">
            <b>天心象棋十字排卦</b>
            <p>融合三十二子象棋、五行生剋與十字吃子捕捉推演，專注於事業、感情、抉擇與當下瓶頸化解。</p>
            <div class="ro-service-tags"><span>五方星位</span><span>現場解局</span><span>籤詩指引</span></div>
          </div>
        </article>
        <article class="ro-service-card">
          <div class="ro-service-icon">📜</div>
          <div class="ro-service-body">
            <b>紫微斗數命盤解析</b>
            <p>十二宮本命格局、大限流年流月走勢與生年四化引動深入剖析，協助辨識先天優勢與生命課題。</p>
            <div class="ro-service-tags"><span>十二宮位</span><span>四化星情</span><span>本機運算</span></div>
          </div>
        </article>
        <article class="ro-service-card">
          <div class="ro-service-icon">🧭</div>
          <div class="ro-service-body">
            <b>人類圖身心探索</b>
            <p>解析能量類型、人生策略、內在權威、九大能量中心與通道閘門，找回不費力的本質運作軌跡。</p>
            <div class="ro-service-tags"><span>9大中心</span><span>策略權威</span><span>天賦通道</span></div>
          </div>
        </article>
        <article class="ro-service-card">
          <div class="ro-service-icon">🌿</div>
          <div class="ro-service-body">
            <b>臼井靈氣能量療癒</b>
            <p>溫和引導宇宙生命能量，促進深層身心放鬆、脈輪淨化平衡、減緩疲勞與焦慮感，安頓心神。</p>
            <div class="ro-service-tags"><span>深層放鬆</span><span>脈輪調和</span><span>遠距/現場</span></div>
          </div>
        </article>
        <article class="ro-service-card">
          <div class="ro-service-icon">🪔</div>
          <div class="ro-service-body">
            <b>天心宮祈福點燈代辦</b>
            <p>光明燈、太歲燈、文昌燈、財神燈線上登記與代拜疏文，為自己與家人祈求平安祥和、增福添慧。</p>
            <div class="ro-service-tags"><span>光明燈</span><span>太歲安奉</span><span>宮方代拜</span></div>
          </div>
        </article>
      </section>

      <section class="ro-line-cta">
        <div class="ro-line-badge">官方諮詢與預約通道</div>
        <p>如需預約一對一深度問事、解盤或報名點燈，歡迎加入天心仙姑官方 LINE：</p>
        <button class="btn primary big ro-line-btn" data-act="contact">💬 加入 LINE 官方好友預約洽詢</button>
      </section>

      <section class="ro-teleport-section">
        <h3>⛩️ 各殿堂快速傳送</h3>
        <p>點擊可直接返回天心宮並自動導引至指定殿堂：</p>
        <div class="ro-teleport-grid">
          <button class="btn small ro-teleport-btn" data-travel="chess">🔮 天心仙姑問事亭</button>
          <button class="btn small ro-teleport-btn" data-travel="cushion">👑 玉皇殿拜墊祈願</button>
          <button class="btn small ro-teleport-btn" data-travel="statue_yuelao">🌸 月下老人求姻緣</button>
          <button class="btn small ro-teleport-btn" data-travel="statue_caishen">💰 五路財神求財運</button>
          <button class="btn small ro-teleport-btn" data-travel="sky-lantern">🏮 祈福天燈祈願處</button>
          <button class="btn small ro-teleport-btn" data-travel="wishing-pool">🪷 蓮花祈願池投幣</button>
        </div>
      </section>

      <section class="ro-memo-section">
        <h3>📝 旅人私密提問備忘錄</h3>
        <p>在此記下你想向天心仙姑詢問的具體問題或探索心得；僅保存在你目前的裝置瀏覽器中：</p>
        <textarea class="ro-memo-input" rows="4" maxlength="600" placeholder="例如：1. 近期工作轉職是否合適？ 2. 感情對象的相處建議...">${esc(this.serviceDeskMemo)}</textarea>
        <div class="row">
          <button class="btn primary small" data-act="service-memo-save">儲存提問備忘</button>
          <button class="btn small" data-act="service-memo-clear" ${this.serviceDeskMemo ? '' : 'disabled'}>清除備忘</button>
        </div>
      </section>

      <div class="row" style="margin-top: 18px;">
        <button class="btn" data-act="market-panel-close">繼續探索市集</button>
      </div>
    `
  }

  openNumerologyExperience(): void {
    this.setMarketDialogTitle('天心靈光市集・生命靈數館')
    if (!this.numerologyResult && this.numerologyDate) {
      try {
        this.numerologyResult = calculateNumerology(this.numerologyDate)
      } catch {
        // keep null
      }
    }
    this.renderNumerologyExperience()
  }

  private renderNumerologyExperience(): void {
    this.setMarketDialogTitle('天心靈光市集・生命靈數館')
    const content = this.root.querySelector<HTMLElement>('[data-market-panel-content]')!
    const res = this.numerologyResult
    const dateVal = this.numerologyDate || '1996-08-22'

    let matrixHtml = ''
    if (res) {
      matrixHtml = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => {
        const count = res.gridCounts[n] || 0
        const meta = NINE_GRID_META.find(m => m.num === n)
        const isLifePath = n === res.lifePathNumber
        const isTalent = res.talentNumbers.includes(n)
        const activeClass = count > 0 ? 'active' : 'empty'
        const lifeClass = isLifePath ? 'is-lifepath' : ''
        const badge = isLifePath ? '<span class="cell-badge life">主命</span>' : isTalent ? '<span class="cell-badge talent">天賦</span>' : ''
        const dots = count > 0 ? '●'.repeat(count) : '○'
        return `
          <div class="num-grid-cell ${activeClass} ${lifeClass}">
            <div class="cell-head">
              <span class="cell-num">${n}</span>
              ${badge}
            </div>
            <div class="cell-dots">${dots}</div>
            <div class="cell-count">${count > 0 ? `${count} 次` : '缺數'}</div>
            <div class="cell-meta">${meta ? meta.label : ''}</div>
          </div>
        `
      }).join('')
    }

    content.innerHTML = `
      <p class="eyebrow">生命靈數館・畢達哥拉斯密碼</p>
      <h2>生命靈數（Numerology）</h2>
      <p class="venue-intro">在靈光市集探索你的生命主命數、天賦潛能與九宮格能量矩陣。所有出生資料僅於本機運算，不公開、不上傳。</p>

      <form class="num-calc-form ro-form">
        <div class="num-form-row">
          <label class="num-form-label">
            <span>西元出生年月日 (YYYY-MM-DD)</span>
            <input type="date" class="num-date-input" name="birthdate" value="${esc(dateVal)}" required />
          </label>
          <button type="submit" class="btn primary num-submit-btn">開始測算</button>
          <button type="button" class="btn" data-act="num-prefill" data-date="1996-08-22">範例 (1996-08-22)</button>
        </div>
        ${this.numerologyError ? `<div class="num-error">${esc(this.numerologyError)}</div>` : ''}
      </form>

      ${res ? `
        <div class="num-result-box">
          <article class="num-hero-card">
            <div class="num-hero-top">
              <div class="num-badge-circle">${res.lifePathNumber}</div>
              <div class="num-hero-titles">
                <span class="num-archetype">${res.profile.archetype}</span>
                <h3 class="num-hero-title">${res.profile.title}</h3>
                <span class="num-formula-tag">算式：${res.formula}</span>
              </div>
            </div>
            <div class="num-talent-row">
              <span>天賦數：</span>
              <div class="num-talent-badges">
                ${res.talentNumbers.map(tn => `<span class="talent-pill">${tn} 數</span>`).join('')}
              </div>
            </div>
            <div class="num-keywords-wrap">
              ${res.profile.keywords.map(k => `<span class="num-keyword-tag">#${k}</span>`).join('')}
            </div>
          </article>

          <article class="num-section">
            <h4 class="num-section-title">九宮格能量矩陣（1～9 出現頻率）</h4>
            <p class="num-section-desc">數字出現次數代表該特質的能量充沛度；缺數代表此生可溫柔修煉的課題。</p>
            <div class="num-grid-matrix">
              ${matrixHtml}
            </div>
          </article>

          <article class="num-section">
            <h4 class="num-section-title">🌟 天賦特質與優勢</h4>
            <ul class="num-strengths-list">
              ${res.profile.strengths.map(s => `<li>✓ ${s}</li>`).join('')}
            </ul>
            <div class="num-career-callout">
              <b>🌱 適合方向與潛能展現：</b>${res.profile.careerGifts}
            </div>
          </article>

          <article class="num-healing-card">
            <div class="num-healing-header">💖 天心仙姑療癒私語</div>
            <p class="num-healing-text">${res.profile.healingMessage}</p>
          </article>

          <div class="row" style="margin-top: 10px; gap: 10px;">
            <button type="button" class="btn primary" data-act="num-consult">預約深度解讀</button>
            <button type="button" class="btn" data-act="market-panel-close">繼續探索市集</button>
          </div>
        </div>
      ` : `
        <div style="padding: 24px; text-align: center; color: #64748b;">
          <p>請輸入西元出生年月日並點擊「開始測算」，即刻探索您的生命靈數。</p>
        </div>
      `}

      <div class="row" style="margin-top: 14px;">
        <button class="btn" data-act="market-panel-close">返回市集街道</button>
      </div>
    `
  }

  private handleNumerologySubmit(form: HTMLFormElement): void {
    const input = form.elements.namedItem('birthdate') as HTMLInputElement | null
    const val = input ? input.value.trim() : ''
    if (!val) {
      this.numerologyError = '請輸入出生年月日'
      this.renderNumerologyExperience()
      return
    }
    try {
      const result = calculateNumerology(val)
      this.numerologyDate = result.birthDate
      this.numerologyResult = result
      this.numerologyError = ''
      this.toast(`已完成 ${result.birthDate} 生命靈數排盤！`)
    } catch (err: any) {
      this.numerologyError = err?.message || '計算失敗，請確認日期格式'
    }
    this.renderNumerologyExperience()
  }

  private npcDialogueTimer = 0

  showNpcDialogue(speaker: string, text: string, ms = 4800): void {
    const bar = this.root.querySelector<HTMLElement>('.npc-dialogue-bar')
    if (!bar) return
    // 手機觸控或窄螢幕版：徹底關閉 2D 螢幕遮擋條，僅保留世界空間 3D 頭頂對話泡泡
    if (window.innerWidth <= 640 || document.body.classList.contains('has-touch')) {
      bar.hidden = true
      return
    }
    const nameEl = bar.querySelector<HTMLElement>('.npc-name')
    const textEl = bar.querySelector<HTMLElement>('.npc-text')
    if (nameEl) nameEl.textContent = `【${speaker}】`
    if (textEl) textEl.textContent = `「${text}」`
    bar.hidden = false
    clearTimeout(this.npcDialogueTimer)
    this.npcDialogueTimer = window.setTimeout(() => { bar.hidden = true }, ms)
  }

  toast(text: string, ms = 2600): void {
    const el = this.root.querySelector<HTMLElement>('.toast')!
    el.textContent = text
    el.hidden = false
    clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => { el.hidden = true }, ms)
  }

  closePanel(): void {
    const wrap = this.root.querySelector<HTMLElement>('.panel-wrap')
    if (wrap) wrap.hidden = true
  }

  showWishBanner(blessing: WishBlessing, count: number): void {
    const banner = this.root.querySelector<HTMLElement>('.wish-banner')
    if (!banner) return
    banner.innerHTML = `
      <div class="wish-banner-card">
        <button class="wish-banner-close" data-act="wish-close" aria-label="關閉">×</button>
        <div class="wish-banner-head">
          <span class="blessing-badge">【${blessing.categoryName}】祈福圓滿</span>
          <span class="stat-pill">池底願力：<b>${count}</b> 枚</span>
        </div>
        <h3 class="wish-banner-title">${esc(blessing.title)}</h3>
        <p class="wish-banner-prophecy">「${esc(blessing.prophecy)}」</p>
        <div class="wish-banner-actions">
          <button class="btn primary small" data-act="wish-again">🪙 再投一枚</button>
          <button class="btn small" data-act="wish-close">漫步賞蓮</button>
        </div>
      </div>
    `
    banner.hidden = false
  }

  hideWishBanner(): void {
    const banner = this.root.querySelector<HTMLElement>('.wish-banner')
    if (banner) banner.hidden = true
  }

  open(id: PanelId, message = ''): void {
    this.hideWishBanner()
    const wrap = this.root.querySelector<HTMLElement>('.panel-wrap')!
    const body = wrap.querySelector<HTMLElement>('.panel-body')!
    body.innerHTML = this.render(id, message)
    wrap.hidden = false
    this.actions.openPanel()
    body.querySelector<HTMLElement>('textarea, button.primary')?.focus()
  }

  /** 顯示符合玉皇宮視覺風格的「建構中」提示視窗 */
  showUnderConstruction(areaName = '這個區域'): void {
    this.hideWishBanner()
    const wrap = this.root.querySelector<HTMLElement>('.panel-wrap')!
    const body = wrap.querySelector<HTMLElement>('.panel-body')!
    body.innerHTML = `
      <p class="eyebrow">${esc(areaName)}</p>
      <h2>建構中</h2>
      <p class="lead" style="margin:14px 0 16px; font-size:15px; line-height:1.7; color:#503e30;">
        這個區域正在用心整理，暫時不開放參觀。<br>
        歡迎先在玉皇宮走走，敬請期待。
      </p>
      <div class="row" style="margin-top:20px; justify-content:center;">
        <button class="btn primary" data-act="close" style="min-width:120px;">關閉</button>
      </div>
    `
    wrap.hidden = false
    this.actions.openPanel()
    body.querySelector<HTMLElement>('button[data-act="close"]')?.focus()
  }

  /**
   * 檢查是否為網站擁有者於本機環境測試預覽。
   * 僅限於本機 loopback 主機 (localhost, 127.0.0.1, [::1], ::1) 生效。
   * 注意：此機制純為本機開發便利性開關，非伺服器端登入或安全存取控制。
   */
  isOwnerPreviewActive(hostnameOverride?: string): boolean {
    if (typeof window === 'undefined' || !window.location) return false
    const hostname = hostnameOverride ?? window.location.hostname
    const isLocalhost = hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]'

    // 非本機網址一律不允許啟用預覽
    if (!isLocalhost) return false

    let ownerStorage = false
    try {
      ownerStorage = localStorage.getItem('tianxin_owner_preview') === 'true'
    } catch {
      // 瀏覽器禁用 Storage 或無痕模式拋錯時安全容錯，不阻斷應用程式運作
      ownerStorage = false
    }

    let ownerQuery = false
    try {
      ownerQuery = new URLSearchParams(window.location.search).get('owner') === '1'
    } catch {
      ownerQuery = false
    }

    // 本機全域除錯旗標（同樣嚴格受限於 isLocalhost，用途為本機自動化腳本及開發者除錯）
    const devFlag = (window as unknown as { __OWNER_PREVIEW__?: boolean }).__OWNER_PREVIEW__ === true

    return isLocalhost && (ownerStorage || ownerQuery || devFlag)
  }

  private render(id: PanelId, message: string): string {
    const d = this.store.data
    const note = message ? `<p class="result">${esc(message)}</p>` : ''
    switch (id) {
      case 'incense':
        return `<p class="eyebrow">觀世音菩薩主殿</p><h2>上香祈福</h2><p>雙手合十，靜心三息。點燃清香，向觀世音菩薩說出心中的祝願。</p>${note}
          <div class="row"><button class="btn primary" data-ritual="incense">敬上三炷清香</button><button class="btn" data-open="prayer">寫下心願</button></div>`
      case 'prayer':
        return `<p class="eyebrow">大殿外前庭廣場・祈願牆</p><h2>寫下心願</h2><p>心願將懸掛於大殿外前庭廣場祈願牆，也會記入你的祈福紀錄。</p>${note}
          <form class="wish-form"><textarea name="wish" maxlength="120" rows="4" placeholder="例如：願家人平安健康，萬事順心。"></textarea><button class="btn primary" type="submit">送出祈願</button></form>`
      case 'market-portal':
        return `<p class="eyebrow">天心靈光市集</p>
          <h2>建構中</h2>
          <p class="lead" style="margin:14px 0 16px; font-size:15px; line-height:1.7; color:#503e30;">
            這個區域正在用心整理，暫時不開放參觀。<br>
            歡迎先在玉皇宮走走，敬請期待。
          </p>
          <div class="row" style="margin-top:20px; justify-content:center;">
            <button class="btn primary" data-act="close" style="min-width:120px;">關閉</button>
          </div>`
      case 'unicorn-portal':
        return `<p class="eyebrow">月光森林・獨角獸心安宮</p>
          <h2>建構中</h2>
          <p class="lead" style="margin:14px 0 16px; font-size:15px; line-height:1.7; color:#503e30;">
            這個區域正在用心整理，暫時不開放參觀。<br>
            歡迎先在玉皇宮走走，敬請期待。
          </p>
          <div class="row" style="margin-top:20px; justify-content:center;">
            <button class="btn primary" data-act="close" style="min-width:120px;">關閉</button>
          </div>`
      case 'offerings':
        return `<p class="eyebrow">虛擬供奉</p><h2>供花・供果・供茶</h2><p>選擇一份心意，供品會出現在主殿供桌上。</p>${note}
          <div class="tiles">${([['flower', '供花', '清香鮮花，敬表虔心'], ['fruit', '供果', '四時鮮果，感恩豐足'], ['tea', '供茶', '一盞清茶，敬奉清心']] as [OfferingId, string, string][])
            .map(([k, n, s]) => `<button class="tile" data-ritual="offer-${k}"><b>${n}</b><span>${s}</span><small>已供 ${d.offerings[k]} 次</small></button>`).join('')}</div>`
      case 'lamps':
        return `<p class="eyebrow">點燈祈福</p><h2>祈福燈區</h2><p>點亮一盞燈，為自己或家人照亮前路。燈火會在宮中持續亮著。</p>${note}
          <div class="tiles">${([['peace', '平安燈', '闔家平安，出入順遂'], ['wealth', '財神燈', '事業穩健，財源有道'], ['study', '文昌燈', '學業精進，考運亨通']] as [LampId, string, string][])
            .map(([k, n, s]) => `<button class="tile ${d.lamps[k] ? 'lit' : ''}" data-ritual="lamp-${k}" ${d.lamps[k] ? 'disabled' : ''}><b>${n}</b><span>${s}</span><small>${d.lamps[k] ? '燈火已明' : '點此點燈'}</small></button>`).join('')}</div>`
      case 'daily-lot': {
        const today = d.dailyLot
        const lot = today && today.day === new Date().toLocaleDateString('sv-SE') ? today : null
        return `<p class="eyebrow">每日一籤</p><h2>每日抽籤</h2><p>每天可抽一支籤，籤詩僅作心靈參考。共 ${LOTS.length} 支籤。</p>${note}
          ${lot ? this.lotCard(lot) : '<div class="row"><button class="btn primary" data-ritual="lottery">搖籤筒・求今日籤</button><button class="btn" data-open="bobei">先擲筊請示</button></div>'}`
      }
      case 'drum':
        return `<p class="eyebrow">鼓樓・暮鼓閣</p><h2>擊鼓鳴志</h2><p>暮鼓晨鐘，收攝心念。大法鼓沉雄悠遠，擊鼓一聲，心定意寧，宏願堅定，聲震十方。</p>${note}
          <div class="row"><button class="btn primary big" data-ritual="drum">咚・鳴鼓振志</button></div>`
      case 'yuhuang':
        return `<p class="eyebrow">後殿・凌霄寶殿</p><h2>朝拜玉皇上帝</h2><p>玄穹高上玉皇大天尊，統御諸天萬界。走到御前合掌俯首朝拜，心誠則靈，祈求闔家安泰、福澤延綿。</p>${note}
          <div class="row"><button class="btn primary" data-ritual="yuhuang">至誠朝拜禮敬</button><button class="btn" data-open="bobei">擲筊請示</button></div>`
      case 'gold-furnace':
        return `<p class="eyebrow">前庭西側・八角金亭</p><h2>化金祈福・添香油</h2><p>八角金亭香火鼎盛，焚化祈福金銀紙入爐，通達上天。信眾參拜圓滿後，可虔心化金或隨喜添香油。</p>${note}
          <div class="tiles">
            <button class="tile" data-gold="祈福壽金"><b>祈福壽金</b><span>祈求闔家安泰，消災除障增福壽</span><small>點此焚化入金亭</small></button>
            <button class="tile" data-gold="五路發財金"><b>五路發財金</b><span>正財偏財廣進，事業百業繁榮</span><small>點此焚化入金亭</small></button>
            <button class="tile" data-gold="祈安補運金"><b>祈安補運金</b><span>補運解厄，逢凶化吉，行事順利</span><small>點此焚化入金亭</small></button>
            <button class="tile" data-gold="添隨喜香油"><b>隨喜添香油</b><span>廣種福田，護持宮廟，同霑法喜</span><small>點此虔誠添奉</small></button>
          </div>`
      case 'bobei': {
        const b = this.lastBobei
        return `<p class="eyebrow">傳統民俗・跋桮</p><h2>擲筊請示神意</h2>
          <p>在心中默念姓名、生辰、住址與所求之事，再行擲筊。筊杯一平一凸為「聖筊」、兩平為「笑筊」、兩凸為「陰筊」。</p>${note}
          <div class="bobei-box">
            <div class="bobei-cups">
              <div class="bobei-cup ${b ? b.cup1 : 'yang'}">${b ? (b.cup1 === 'yang' ? '平 (陽)' : '凸 (陰)') : '平'}</div>
              <div class="bobei-cup ${b ? b.cup2 : 'yin'}">${b ? (b.cup2 === 'yang' ? '平 (陽)' : '凸 (陰)') : '凸'}</div>
            </div>
            <div class="bobei-title">${b ? esc(b.title) : '雙手合捧筊杯'}</div>
            <p class="bobei-desc">${b ? esc(b.desc) : '靜心冥想請示之事後，點擊下方按鈕擲筊。'}</p>
          </div>
          <div class="row"><button class="btn primary big" data-act="toss-bobei">🤲 虔心擲筊</button><button class="btn" data-open="daily-lot">抽今日籤詩</button></div>`
      }
      case 'tiangong':
        return `<p class="eyebrow">前庭天公爐</p><h2>參拜玉皇上帝</h2><p>立於天公爐前，雙手合十，向玉皇上帝敬拜。人物會面向天公爐合掌鞠躬，完成後即可繼續走動。</p>${note}
          <div class="row"><button class="btn primary" data-ritual="tiangong">合掌敬拜</button></div>`
      case 'guanyin-dragon':
        return `<p class="eyebrow">昇龍聖境大平台・Q 版萌系潮玩手辦風金身</p><h2>參拜昇龍觀音</h2>
          <p>五層樓高 Q 版白衣昇龍觀音菩薩，金角白身祥龍盤繞護持、佛光普照，端坐粉紅蓮花寶台之上，神態慈和萌善。面向法相至誠合掌禮敬，祈求風調雨順、消災降福、吉慶安泰。</p>${note}
          <div class="row"><button class="btn primary big" data-ritual="guanyin-dragon">🙏 至誠朝拜昇龍觀音</button><button class="btn" data-open="bobei">擲筊請示</button></div>`
      case 'consult':
        return `<p class="eyebrow">天心仙姑問事亭</p><h2>問事服務介紹</h2>
          <p>天心仙姑問事亭位於前庭左側，是天心仙姑專屬的象棋卜卦與問事服務空間。</p>
          <ul class="info"><li>象棋卜卦：點擊亭內桌上的棋盤即可開始。</li><li>正式問事：採預約方式進行。</li><li>隱私：個人問事內容與卜卦紀錄僅保存在你自己的瀏覽器，不會顯示在公開場景。</li></ul>
          <div class="row"><button class="btn primary" data-open="chess">返回象棋卜卦</button><button class="btn" data-act="contact">正式問事聯絡入口</button></div>
          ${renderServiceSection()}`
      case 'chess': {
        const gua = this.store.currentCrossGua ?? this.store.startCrossGua()
        const renderSlot = (pos: ChessPos) => {
          const slot = gua.slots[pos]
          const meta = POS_META[pos]
          if (slot.revealed) {
            return `
              <div class="chess-slot-cell ${pos}">
                <span class="slot-pos-label">${meta.label}</span>
                <div class="piece revealed ${slot.piece.color}" title="${meta.label}：${slot.piece.name}">${slot.piece.name}</div>
                <span class="slot-aspect-tag">${meta.aspect}</span>
              </div>
            `
          }
          return `
            <div class="chess-slot-cell ${pos}">
              <span class="slot-pos-label">${meta.label}</span>
              <button type="button" class="piece unrevealed pulse" data-flip-pos="${pos}" title="點擊翻開 ${meta.label}">
                <span class="piece-back-inner">仙</span>
              </button>
              <span class="slot-aspect-tag flip-hint">點擊翻開</span>
            </div>
          `
        }

        const levelBadgeClass: Record<string, string> = {
          大吉: 'badge-grand-luck',
          吉: 'badge-luck',
          平: 'badge-fair',
          守中: 'badge-guard',
          需慎: 'badge-caution',
        }
        const badgeClass = levelBadgeClass[gua.level] || 'badge-luck'

        const posIndexNames = ['中宮・主位', '左方・客方', '右方・主方', '上方・天時', '下方・地利']

        const formationsHtml = gua.analysis.formations.length > 0
          ? gua.analysis.formations.map(f => `
              <div class="formation-item">
                <div class="formation-item-title">🔮 ${esc(f.name)}</div>
                <div class="formation-item-desc">${esc(f.description)}</div>
              </div>
            `).join('')
          : `
              <div class="formation-item">
                <div class="formation-item-desc">${esc(gua.summary)}</div>
              </div>
            `

        const recordsHtml = gua.analysis.records.length > 0
          ? `
            <details class="chess-records-details">
              <summary>查看十字吃子捕捉明細（共 ${gua.analysis.records.length} 筆）</summary>
              <div class="records-content">
                <ul class="records-list">
                  ${gua.analysis.records.map(r => `
                    <li class="${r.isGain ? 'record-gain' : 'record-loss'}">
                      <span class="record-badge">${r.isGain ? '收獲' : '付出'}</span>
                      <b>${posIndexNames[r.attackerPos]} [${esc(r.attacker.character)}]</b> 捕捉 <b>${posIndexNames[r.targetPos]} [${esc(r.target.character)}]</b>
                      <span class="record-score">${r.isGain ? '+' : '-'}${r.score}分</span>
                    </li>
                  `).join('')}
                </ul>
              </div>
            </details>
          `
          : ''

        const resultCard = gua.allRevealed ? `
          <div class="chess-result-box">
            <div class="result-head">
              <span class="result-level-badge ${badgeClass}">${gua.level}</span>
              <h3 class="result-pattern-name">${esc(gua.patternName)}</h3>
            </div>

            <div class="result-score-bar">
              <div class="score-item score-gain">
                <span class="score-label">收獲</span>
                <b class="score-val">${gua.analysis.gains}</b>
                <span class="score-unit">分</span>
              </div>
              <span class="score-sym">${gua.analysis.compareSymbol}</span>
              <div class="score-item score-loss">
                <span class="score-label">付出</span>
                <b class="score-val">${gua.analysis.losses}</b>
                <span class="score-unit">分</span>
              </div>
              <div class="score-badges">
                ${gua.analysis.hasGoodFriends ? '<span class="score-tag badge-friend">好朋友格・逐筆減半</span>' : ''}
                ${gua.analysis.protectedColor !== null ? `<span class="score-tag badge-protect">護身免吃・${gua.analysis.protectedColor ? '紅方' : '黑方'}受庇佑</span>` : ''}
              </div>
            </div>

            <div class="result-formations-section">
              <h4 class="section-title">仙姑格局詳解</h4>
              ${formationsHtml}
            </div>

            <div class="result-summary-section">
              <div class="advice-line"><b>仙姑指點心法：</b>${esc(gua.advice)}</div>
            </div>

            ${recordsHtml}

            <div class="result-pos-grid">
              <div class="pos-item center-item">
                <span class="pos-badge">中宮・本質</span>
                <p>${esc(gua.posInterpretations.center)}</p>
              </div>
              <div class="pos-item">
                <span class="pos-badge">上方・天時</span>
                <p>${esc(gua.posInterpretations.top)}</p>
              </div>
              <div class="pos-item">
                <span class="pos-badge">下方・地利</span>
                <p>${esc(gua.posInterpretations.bottom)}</p>
              </div>
              <div class="pos-item">
                <span class="pos-badge">左方・客方</span>
                <p>${esc(gua.posInterpretations.left)}</p>
              </div>
              <div class="pos-item">
                <span class="pos-badge">右方・主方</span>
                <p>${esc(gua.posInterpretations.right)}</p>
              </div>
            </div>
            <div class="result-copy-row">
              <button type="button" class="btn-copy-gua" data-act="copy-gua">📋 一鍵複製卦象摘要（貼給 LINE 解卦）</button>
            </div>
            <div class="result-save-hint">✨ 卦象摘要（格局、收獲／付出、五枚棋子與仙姑指點心法）已存入本機「祈福紀錄」（最多保留 ${MAX_RECORDS} 筆，完整格局詳解請複製或匯出備份）</div>
          </div>
        ` : `
          <div class="chess-prompt-box">
            <p class="chess-prompt-text">
              心中默想所求之事（工作、感情、健康、轉職或當前抉擇），<br>請以誠敬之心，依序親手<b>點擊翻開</b>上方十字星位中的五枚棋子。
            </p>
            <div class="chess-flip-counter">
              當前進度：已翻開 <b>${gua.revealedCount}</b> / 5 顆
            </div>
          </div>
        `

        return `
          <p class="eyebrow">天心仙姑問事亭・象棋神卦</p>
          <h2>十字五星排卦</h2>
          ${note}
          <div class="chess-cross-board">
            <div class="cross-row top-row">
              ${renderSlot('top')}
            </div>
            <div class="cross-row mid-row">
              ${renderSlot('left')}
              ${renderSlot('center')}
              ${renderSlot('right')}
            </div>
            <div class="cross-row bottom-row">
              ${renderSlot('bottom')}
            </div>
          </div>
          ${resultCard}
          <div class="row">
            <button type="button" class="btn primary" data-chess-act="restart">重新洗牌排卦</button>
            <button type="button" class="btn" data-open="consult">問事服務介紹</button>
            <button type="button" class="btn" data-act="contact">正式問事聯絡入口</button>
          </div>
          ${renderServiceSection()}
          ${renderDisclaimerStrip()}
        `
      }
      case 'woodfish':
        return `<p class="eyebrow">靜心</p><h2>敲木魚</h2><p>隨著節奏，一聲一念，讓心慢慢安定下來。</p>${note}<button class="btn primary big" data-ritual="woodfish">叩・敲一下</button>`
      case 'bell':
        return `<p class="eyebrow">祈福鐘</p><h2>鳴鐘</h2><p>鐘聲悠遠，願祝福隨聲遠播。</p>${note}<button class="btn primary big" data-ritual="bell">鳴鐘祈願</button>`
      case 'wishing-pool': {
        const catList: { id: WishCategory; name: string; icon: string; desc: string }[] = [
          { id: 'peace', name: '平安健康', icon: '🌸', desc: '身心康泰・無病無災' },
          { id: 'career', name: '事業亨通', icon: '💼', desc: '宏圖大展・步步高升' },
          { id: 'love', name: '廣結良緣', icon: '💖', desc: '良緣天成・貴人相隨' },
          { id: 'wealth', name: '財運興旺', icon: '💰', desc: '五路納吉・財源廣進' },
          { id: 'study', name: '金榜題名', icon: '🎓', desc: '魁星高照・才思敏捷' },
        ]
        const catButtons = catList.map(c => `
          <button type="button" class="wish-cat-btn ${this.selectedWishCategory === c.id ? 'active' : ''}" data-wish-cat="${c.id}">
            <span class="cat-icon">${c.icon}</span>
            <b class="cat-name">${c.name}</b>
            <span class="cat-desc">${c.desc}</span>
          </button>
        `).join('')

        const blessingCard = this.lastWishBlessing ? `
          <div class="wish-blessing-card">
            <span class="blessing-badge">【${this.lastWishBlessing.categoryName}】祈福圓滿</span>
            <h3 class="blessing-title">${esc(this.lastWishBlessing.title)}</h3>
            <p class="blessing-prophecy">「${esc(this.lastWishBlessing.prophecy)}」</p>
            <div class="blessing-foot">✨ 銅錢入水，漣漪四溢・神明垂慈，心誠則靈</div>
          </div>
        ` : ''

        return `
          <p class="eyebrow">前庭東側・蓮花許願池</p>
          <h2>投一枚祈福銅錢</h2>
          <p>默念心中所求，選擇祈福主題或輸入心願，將祈福銅錢擲向池心聚寶金蓮台。</p>
          ${note}
          ${blessingCard}
          <div class="wish-section-title">選擇祈願主題：</div>
          <div class="wish-cat-grid">${catButtons}</div>
          <div class="wish-custom-row">
            <input type="text" class="wish-custom-input" placeholder="可填寫具體祈願（選填，例如：家人平安順遂）" maxlength="36" value="${esc(this.customWishInput)}" />
          </div>
          <div class="wish-action-bar">
            <div class="stat">池中已集 <b>${d.coins}</b> 枚願力銅錢</div>
            <button class="btn primary big wish-toss-btn" data-ritual="coin">🪙 誠心投幣許願</button>
          </div>
        `
      }
      case 'prayer-wall': {
        const mine = d.wishes.map(w => `<li class="mine"><p>${esc(w.text)}</p><small>${formatRecordDate(w.at)}・我的祈願</small></li>`).join('')
        const sample = SAMPLE_WISHES.map(w => `<li><p>${w}</p><small>示例祈願</small></li>`).join('')
        return `<p class="eyebrow">大殿外前庭廣場・祈願牆</p><h2>一念善願</h2><p>此牆坐落於大殿外前庭廣場東側，展示善信在此留駐的真誠祝願。</p>${note}
          <ul class="wall">${mine}${sample}</ul><button class="btn primary" data-open="prayer">寫下新的心願</button>`
      }
      case 'cushion':
        return `<p class="eyebrow">觀世音菩薩主殿</p><h2>觀音拜墊・跪拜祈福</h2><p>於觀世音菩薩前虔誠跪拜，靜心默念心願，願菩薩慈悲護佑，平安吉祥，福慧圓滿。</p>${note}
          <div class="row"><button class="btn primary" data-act="cushion-pray">立即跪拜祈福</button></div>`
      case 'sky-lantern':
        return `<p class="eyebrow">天心仙姑問事亭旁・祈福天燈坪</p><h2>天燈祈福・祈願升空</h2><p>相傳孔明燈乘風而上，上達天聽。於天心仙姑旁點燃祈福天燈，讓微光照亮心願，隨風冉冉升入星空，祈願天心指引迷津，平安順遂、萬事如意。</p>${note}
          <div class="row"><button class="btn primary" data-act="sky-lantern-pray">立即點燃天燈</button></div>`
      case 'records': {
        const rows = d.records.map(r => `<li><b>${esc(r.action)}</b><span>${esc(r.detail)}</span><small>${formatRecordDate(r.at)}</small></li>`).join('')
        const hasRecords = d.records.length > 0
        return `<p class="eyebrow">祈福紀錄</p><h2>參拜足跡</h2>
          <p>共 ${d.records.length} / ${MAX_RECORDS} 筆紀錄，保存在此瀏覽器中。</p>
          <div class="records-storage-notice">⚠️ 清除瀏覽器資料、使用無痕模式或更換裝置將無法保留紀錄，最多保留 ${MAX_RECORDS} 筆（超過將自動移除最舊紀錄）。重要卦象建議隨時複製或匯出備份。</div>
          <div class="records-export-bar">
            <button type="button" class="btn small" data-act="records-copy" ${hasRecords ? '' : 'disabled'}>📋 複製全部紀錄</button>
            <button type="button" class="btn small" data-act="records-export-txt" ${hasRecords ? '' : 'disabled'}>📄 匯出文字 (.txt)</button>
            <button type="button" class="btn small" data-act="records-export-json">💾 備份 JSON (.json)</button>
          </div>
          ${note}
          <ul class="records">${rows || '<li class="empty">尚無紀錄。走到香爐前上香，開始今日的參拜吧。</li>'}</ul>`
      }
    }
  }

  lotCard(lot: { number: number; title: string; text: string; advice: string }): string {
    return `<div class="lot"><span class="lot-no">第 ${lot.number} 籤</span><h3>${esc(lot.title)}</h3><p>${esc(lot.text)}</p><p class="advice">${esc(lot.advice)}</p><small>今日已求籤，明日可再抽。</small></div>`
  }


  private setOverlay(selector: string, open: boolean): void {
    const el = this.root.querySelector<HTMLElement>(selector)
    if (el) el.hidden = !open
  }

  private copyText(text: string, okMsg: string): void {
    const fallback = () => {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(ta)
        this.toast(ok ? okMsg : '瀏覽器不支援自動複製，請改用匯出功能')
      } catch {
        this.toast('瀏覽器不支援自動複製，請改用匯出功能')
      }
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => this.toast(okMsg), fallback)
    } else {
      fallback()
    }
  }

  private downloadTextFile(filename: string, content: string, mime: string): void {
    try {
      const blob = new Blob([content], { type: mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      this.toast('檔案匯出失敗，請改用「複製全部紀錄」')
    }
  }

  private onClick(e: MouseEvent): void {
    const t = (e.target as HTMLElement).closest<HTMLElement>('button')
    if (!t) {
      const target = e.target as HTMLElement
      if (target.matches('[data-qr-lightbox], [data-legal-modal], [data-service-modal]')) {
        e.stopPropagation()
        target.hidden = true
        return
      }
      if (target.classList.contains('panel-wrap')) {
        e.preventDefault()
        e.stopPropagation()
        this.closePanel()
        this.actions.closePanel()
        return
      }
      if (target.classList.contains('market-panel-wrap')) {
        e.preventDefault()
        e.stopPropagation()
        this.closeMarketPanel()
        window.dispatchEvent(new CustomEvent('market:close-panel'))
        return
      }
      return
    }
    e.stopPropagation()
    const act = t.dataset.act
    if (act === 'begin') this.actions.begin()
    else if (act === 'enter') this.actions.enter()
    else if (act === 'resume') this.actions.resume()
    else if (act === 'close') { e.preventDefault(); this.closePanel(); this.actions.closePanel() }
    else if (act === 'explore') this.actions.explore()
    else if (act === 'exit') this.actions.exitExplore()
    else if (act === 'guide-cancel') this.actions.cancelGuide()
    else if (act === 'wish-again') { e.preventDefault(); this.hideWishBanner(); this.actions.ritual('coin') }
    else if (act === 'wish-close') { e.preventDefault(); this.hideWishBanner() }
    else if (act === 'interact') window.dispatchEvent(new CustomEvent('temple:interact-touch'))
    else if (act === 'market-enter') {
      if (this.isOwnerPreviewActive()) this.actions.enterMarket()
      else this.showUnderConstruction('天心靈光市集')
    }
    else if (act === 'unicorn-enter') {
      this.showUnderConstruction('月光森林・獨角獸心安宮')
    }
    else if (act === 'market-walk') {
      const targetId = t.dataset.marketTarget
      if (targetId) window.dispatchEvent(new CustomEvent('market:walk-to', { detail: targetId }))
    }
    else if (act === 'market-cam') {
      const dir = t.dataset.marketCam
      if (dir) window.dispatchEvent(new CustomEvent('market:camera', { detail: dir }))
    }
    else if (act === 'market-panel-close') {
      this.closeMarketPanel()
      window.dispatchEvent(new CustomEvent('market:close-panel'))
    }
    else if (act === 'market-ziwei') {
      this.birthChartTab = 'ziwei'
      void this.openBirthChartExperience()
    }
    else if (act === 'market-cards') void this.openCardExperience()
    else if (act === 'market-meditation') this.openMeditationExperience()
    else if (act === 'market-birth-tab') {
      const tab = t.dataset.tab as 'ziwei' | 'human-design'
      if (tab) {
        this.birthChartTab = tab
        this.renderBirthChartExperience()
      }
    }
    else if (act === 'hd-save') void this.saveHumanDesign()
    else if (act === 'hd-clear') void this.clearHumanDesign()
    else if (act === 'market-chess-flip-all') {
      const positions: ChessPos[] = ['center', 'left', 'right', 'top', 'bottom']
      positions.forEach(p => this.store.revealCrossPiece(p))
      this.renderMarketChessExperience()
      this.toast('已一鍵翻開五方星位！')
    }
    else if (act === 'market-chess-restart') {
      this.store.startCrossGua()
      this.renderMarketChessExperience()
      this.toast('已重新排卦，請翻開棋子。')
    }
    else if (act === 'market-chess-copy') {
      const gua = this.store.currentCrossGua
      if (!gua || !gua.allRevealed) { this.toast('請先翻開全部 5 顆棋子'); return }
      this.copyText(formatCrossGuaShareText(gua), '已複製卦象摘要，可直接貼給天心仙姑 LINE 解卦')
    }
    else if (act === 'service-memo-save') {
      const input = this.root.querySelector<HTMLTextAreaElement>('.ro-memo-input')
      this.saveServiceDeskMemo(input?.value ?? '')
      this.renderServiceDeskExperience()
    }
    else if (act === 'service-memo-clear') {
      this.clearServiceDeskMemo()
      this.renderServiceDeskExperience()
    }
    else if (act === 'num-prefill') {
      const d = t.dataset.date || '1996-08-22'
      try {
        const result = calculateNumerology(d)
        this.numerologyDate = result.birthDate
        this.numerologyResult = result
        this.numerologyError = ''
        this.toast(`已帶入範例日期 ${result.birthDate}`)
      } catch {}
      this.renderNumerologyExperience()
    }
    else if (act === 'num-consult') {
      this.toast('已為您記錄預約諮詢意向！可至「市集服務台」或天心宮官方 LINE 洽詢仙姑深度解讀。')
    }
    else if (act === 'card-draw-spread') this.drawCardSpread((t.dataset.cardTopic as CardTopic) || 'inner-state')
    else if (act === 'card-save-note') void this.saveCardNote()
    else if (act === 'card-clear-notes') void this.clearCardNotes()
    else if (act === 'meditation-start') this.startMeditation()
    else if (act === 'meditation-stop') this.stopMeditation()
    else if (act === 'meditation-ambient') {
      this.meditationAmbient = this.actions.toggleMeditationAmbient()
      this.renderMeditationExperience()
    }
    else if (act === 'ziwei-close') {
      this.closeZiweiPanel()
      window.dispatchEvent(new CustomEvent('market:close-panel'))
    }
    else if (act === 'ziwei-save') void this.saveZiwei()
    else if (act === 'ziwei-clear') void this.clearZiwei()
    else if (act === 'market-chess') {
      this.openMarketChessExperience()
    }
    else if (act === 'cushion-pray') { e.preventDefault(); this.closePanel(); this.actions.closePanel(); window.dispatchEvent(new CustomEvent('temple:interact', { detail: 'cushion' })) }
    else if (act === 'sky-lantern-pray') { e.preventDefault(); this.closePanel(); this.actions.closePanel(); window.dispatchEvent(new CustomEvent('temple:interact', { detail: 'sky-lantern' })) }
    else if (act === 'contact') window.open(LINE_OFFICIAL_URL, '_blank', 'noopener,noreferrer')
    else if (act === 'go-home') {
      this.closePanel()
      const m = this.root.querySelector<HTMLElement>('.map')
      if (m) m.hidden = true
      this.actions.goHome?.()
      this.show('title')
    }
    else if (act === 'open-services') this.setOverlay('[data-service-modal]', true)
    else if (act === 'services-close') this.setOverlay('[data-service-modal]', false)
    else if (act === 'open-legal') this.setOverlay('[data-legal-modal]', true)
    else if (act === 'legal-close') this.setOverlay('[data-legal-modal]', false)
    else if (act === 'qr-zoom') this.setOverlay('[data-qr-lightbox]', true)
    else if (act === 'qr-close') this.setOverlay('[data-qr-lightbox]', false)
    else if (act === 'copy-gua') {
      const gua = this.store.currentCrossGua
      if (!gua || !gua.allRevealed) { this.toast('請先翻開全部 5 顆棋子'); return }
      this.copyText(formatCrossGuaShareText(gua), '已複製卦象摘要，可直接貼給天心仙姑 LINE 解卦')
    }
    else if (act === 'records-copy') {
      this.copyText(formatRecordsAsText(this.store.data.records), '已複製全部祈福與卜卦紀錄')
    }
    else if (act === 'records-export-txt') {
      const day = new Date().toISOString().slice(0, 10)
      this.downloadTextFile(`天心仙姑-祈福與卜卦紀錄-${day}.txt`, formatRecordsAsText(this.store.data.records), 'text/plain;charset=utf-8')
      this.toast('已下載文字紀錄檔 (.txt)')
    }
    else if (act === 'records-export-json') {
      const day = new Date().toISOString().slice(0, 10)
      this.downloadTextFile(`天心仙姑-完整備份-${day}.json`, exportTempleBackupJson(this.store.data), 'application/json;charset=utf-8')
      this.toast('已下載完整 JSON 備份檔 (.json)')
    }
    else if (act === 'map') { const m = this.root.querySelector<HTMLElement>('.map')!; m.hidden = !m.hidden }
    else if (act === 'music') {
      const state = this.actions.toggleMusic()
      this.setMusicState(state.playing, state.chantCount)
      if (!state.playing) {
        this.toast('已將背景音樂靜音。')
      } else {
        this.toast(`已開啟綠度母梵唱（第 ${state.chantCount || 1}/12 遍），梵音悠揚，心靈安寧。`)
      }
    }
    else if (act === 'time') {
      const cycle: TimeSetting[] = ['auto', 'day', 'dusk', 'night', 'dawn']
      const next = cycle[(cycle.indexOf(this.currentTimeSetting) + 1) % cycle.length]
      this.currentTimeSetting = next
      const lunar = getLunarPhaseInfo()
      if (next === 'auto') {
        this.currentEffectiveTime = getRealWorldTimeOfDay().mode
        t.textContent = `⏰ 現實 (${getEffectiveTimeLabel(this.currentEffectiveTime)})`
        this.actions.time('auto')
        const nightExtra = this.currentEffectiveTime === 'night' ? `（現為深山星空・${lunar.name}）` : ''
        this.toast(`已切換為「現實時間同步」${nightExtra}：場景天象自動隨現實清晨、白天、黃昏與夜晚即時變換。`)
      } else {
        this.currentEffectiveTime = next
        t.textContent = getEffectiveTimeLabel(next)
        this.actions.time(next)
        const toasts: Record<TimeOfDay, string> = {
          day: '已切換為「白天（晴空）」時段，旭日當空，光耀萬山。',
          dusk: '已切換為「黃昏（夕陽）」時段，落日熔金，晚霞漫天。',
          night: `已切換為「夜晚（夜間）」時段：深山夜空寧靜澄澈、星月相映，今夜天象為「${lunar.name}」(${lunar.description})，宮燈齊明。`,
          dawn: '已切換為「清晨（晨曦）」時段，紫氣東來，初陽晨曦與曉星相映。',
        }
        this.toast(toasts[next])
      }
    }
    else if (act === 'toss-bobei') {
      const r = Math.random()
      if (r < 0.5) {
        this.lastBobei = {
          title: '【聖 筊】（允筊）',
          desc: '神明贊同欣允，所求大吉可行。心念端正，宏願必成。',
          cup1: 'yang',
          cup2: 'yin',
        }
      } else if (r < 0.75) {
        this.lastBobei = {
          title: '【笑 筊】',
          desc: '神明微笑不語。機緣未定、或是信眾心中早已明白答案，無須猶豫。',
          cup1: 'yang',
          cup2: 'yang',
        }
      } else {
        this.lastBobei = {
          title: '【陰 筊】（怒筊）',
          desc: '神明暫未贊同。時機未臻成熟，不可躁進，宜靜候佳期、多積福德。',
          cup1: 'yin',
          cup2: 'yin',
        }
      }
      this.store.divineBobei(this.lastBobei.title, this.lastBobei.desc)
      this.actions.ritual('bobei')
      this.open('bobei', `${this.lastBobei.title}：${this.lastBobei.desc}`)
    }
    if (t.dataset.wishCat) {
      this.selectedWishCategory = t.dataset.wishCat as WishCategory
      for (const btn of this.root.querySelectorAll<HTMLElement>('[data-wish-cat]')) {
        btn.classList.toggle('active', btn.dataset.wishCat === this.selectedWishCategory)
      }
    }
    if (t.dataset.gold) {
      const gold = t.dataset.gold
      this.store.burnGold(gold)
      this.actions.ritual('gold-furnace')
      this.open('gold-furnace', `「${gold}」已虔化入八角金亭，化吉納祥，福澤深遠！`)
    }
    if (t.dataset.char) { this.actions.choose(t.dataset.char as CharacterId); this.refreshCharacter() }
    if (t.dataset.open) this.open(t.dataset.open as PanelId)
    if (t.dataset.go) { this.root.querySelector<HTMLElement>('.map')!.hidden = true; this.actions.travel(t.dataset.go as ShrinePointId) }
    if (t.dataset.ritual) {
      e.preventDefault()
      if (t.dataset.ritual === 'coin') {
        const input = this.root.querySelector<HTMLInputElement>('.wish-custom-input')
        if (input) this.customWishInput = input.value.trim()
        this.closePanel()
        this.actions.closePanel()
      }
      this.actions.ritual(t.dataset.ritual)
    }
    if (t.dataset.flipPos) {
      e.preventDefault()
      const pos = t.dataset.flipPos as ChessPos
      const updated = this.store.revealCrossPiece(pos)
      this.actions.ritual('chess')
      if (updated.allRevealed) {
        this.open('chess', `✨ 五方星位已顯！卦象【${updated.patternName}】圓滿生成。`)
      } else {
        this.open('chess')
      }
    }
    if (t.dataset.marketFlipPos) {
      e.preventDefault()
      const pos = t.dataset.marketFlipPos as ChessPos
      this.store.revealCrossPiece(pos)
      this.renderMarketChessExperience()
    }
    if (t.dataset.travel) {
      e.preventDefault()
      const targetPoint = t.dataset.travel as ShrinePointId
      void this.travelFromMarket(targetPoint)
    }
    if (t.dataset.chessAct === 'restart') {
      e.preventDefault()
      this.store.startCrossGua()
      this.actions.ritual('chess')
      this.open('chess', '已重新洗牌排卦，請在心中默念所求後親自翻牌。')
    }
  }

  updateTimeSettingLabel(setting: TimeSetting, effectiveMode: TimeOfDay): void {
    this.currentTimeSetting = setting
    this.currentEffectiveTime = effectiveMode
    const btn = this.root.querySelector<HTMLElement>('[data-act="time"]')
    if (!btn) return
    if (setting === 'auto') {
      btn.textContent = `⏰ 現實 (${getEffectiveTimeLabel(effectiveMode)})`
    } else {
      btn.textContent = getEffectiveTimeLabel(setting)
    }
  }

  updateMusicProgress(track: MusicTrack, current: number, total: number): void {
    const btn = this.root.querySelector<HTMLElement>('[data-act="music"]')
    if (!btn || !this.actions.isMusicPlaying()) return
    if (track === 'green_tara') {
      btn.textContent = `🎵 綠度母 (${current}/${total})`
    } else {
      btn.textContent = '🎵 般若心經'
    }
  }

  onMusicTrackTransition(_track: MusicTrack, title: string, reason?: 'auto_complete' | 'manual' | 'init'): void {
    const btn = this.root.querySelector<HTMLElement>('[data-act="music"]')
    if (btn && this.actions.isMusicPlaying()) {
      btn.textContent = '🎵 綠度母 (1/12)'
    }
    if (reason === 'manual' || reason === 'init') {
      this.toast(`🌸 正在播放《${title}》，梵音悠揚，心靈安寧。`, 3800)
    }
  }

  setMusicState(playing: boolean, chantCount?: number): void {
    const btn = this.root.querySelector<HTMLElement>('[data-act="music"]')
    if (!btn) return
    if (!playing) {
      btn.textContent = '🔇 音樂：暫停'
      btn.classList.add('is-muted')
      btn.setAttribute('aria-label', '背景音樂已暫停，點擊播放')
    } else {
      const count = chantCount || this.actions.getCurrentMusicState?.().chantCount || 1
      btn.textContent = `🎵 綠度母 (${count}/12)`
      btn.classList.remove('is-muted')
      btn.setAttribute('aria-label', `正在播放綠度母梵唱第 ${count}/12 遍，點擊靜音`)
    }
  }
}
