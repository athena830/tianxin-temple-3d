import { CHARACTERS, LOTS, TempleStore, formatRecordDate, type CharacterId, type LampId, type OfferingId, type WishCategory, type WishBlessing } from '../game/temple-data'
import { getLunarPhaseInfo, getRealWorldTimeOfDay, type ShrinePoint, type ShrinePointId, type TimeOfDay, type TimeSetting } from '../game/temple-world'
import type { MusicTrack } from '../engine/audio'
import { APP_VERSION } from '../version'
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
  explore(): void
  exitExplore(): void
  cancelGuide(): void
  time(mode: TimeSetting): void
  toggleMusic(): { playing: boolean; track: MusicTrack; chantCount: number }
  isMusicPlaying(): boolean
  switchTrack?(track: MusicTrack): void
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

  constructor(private readonly store: TempleStore, private readonly actions: TempleUiActions) {
    const initReal = getRealWorldTimeOfDay().mode
    this.currentTimeSetting = 'auto'
    this.currentEffectiveTime = initReal
    const initialTimeLabel = `⏰ 現實 (${getEffectiveTimeLabel(initReal)})`

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
          <p class="note">祈願與紀錄僅保存在此瀏覽器中。</p>
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
          <div class="badge"><span class="seal small">玉</span><div><b>玉皇宮</b><small data-who></small></div></div>
          <div class="hud-buttons">
            <button class="chip" data-act="time">${initialTimeLabel}</button>
            <button class="chip" data-act="music">🎵 綠度母 (1/12)</button>
            <button class="chip" data-act="map">參拜指引</button>
            <button class="chip" data-open="records">祈福紀錄</button>
            <button class="chip" data-open="prayer-wall">祈願牆</button>
          </div>
        </header>
        <nav class="map" hidden>
          <p>選擇目的地，跟著金色箭頭前往</p>
          <button data-go="guanyin-dragon">參拜昇龍觀音</button><button data-go="gold-furnace">八角金亭（化金）</button><button data-go="chess">天心仙姑問事亭</button>
          <button data-go="incense">上香祈福</button><button data-go="yuhuang">後殿凌霄寶殿</button><button data-go="prayer">寫下心願</button>
          <button data-go="offerings">虛擬供奉</button><button data-go="lamps">祈福燈區</button><button data-go="daily-lot">每日抽籤</button>
          <button data-go="woodfish">敲木魚</button><button data-go="bell">鳴鐘</button><button data-go="drum">鼓樓擊鼓</button>
          <button data-go="wishing-pool">蓮花許願池</button><button data-go="prayer-wall">祈願牆</button><button data-go="records">祈福紀錄</button>
        </nav>
        <div class="prompt" hidden><b data-prompt-title></b><span data-prompt-sub></span><kbd class="key">E</kbd><button class="btn small primary touch-only" data-act="interact">互動</button></div>
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
      <div class="wish-banner" hidden></div>
      <div class="npc-dialogue-bar" hidden><span class="npc-icon">💬</span><b class="npc-name"></b><span class="npc-text"></span></div>
      <div class="toast" hidden></div>`
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
      const text = (form.elements.namedItem('wish') as HTMLTextAreaElement).value
      const wish = this.store.submitWish(text)
      if (!wish) { this.toast('請先寫下你的心願'); return }
      this.actions.ritual('wish')
      this.open('prayer-wall', '你的心願已安放在祈願牆。')
    })
    this.root.addEventListener('keydown', e => { if (e.key === 'Escape' && !this.panelHidden) { e.stopPropagation(); this.actions.closePanel() } })
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

  guideTo(point: ShrinePoint | null, distance: number): void {
    const el = this.root.querySelector<HTMLElement>('.guide')!
    el.hidden = !point
    if (!point) return
    el.querySelector('[data-guide-name]')!.textContent = point.title
    el.querySelector('[data-guide-dist]')!.textContent = `約 ${Math.max(1, Math.round(distance))} 公尺`
  }

  get panelOpen(): boolean { return !this.panelHidden }

  setBootProgress(v: number): void {
    this.root.querySelector<HTMLElement>('.boot .bar i')!.style.width = `${Math.round(v * 100)}%`
  }

  refreshCharacter(): void {
    const cur = this.store.data.character
    for (const b of this.root.querySelectorAll<HTMLElement>('[data-char]')) b.classList.toggle('on', b.dataset.char === cur)
    const c = CHARACTERS.find(x => x.id === cur)!
    this.root.querySelector<HTMLElement>('[data-who]')!.textContent = `${c.title}・${c.name}`
  }

  near(point: ShrinePoint | null): void {
    const el = this.root.querySelector<HTMLElement>('.prompt')!
    el.hidden = !point
    if (!point) return
    el.querySelector('[data-prompt-title]')!.textContent = point.title
    el.querySelector('[data-prompt-sub]')!.textContent = point.subtitle
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

  private render(id: PanelId, message: string): string {
    const d = this.store.data
    const note = message ? `<p class="result">${esc(message)}</p>` : ''
    switch (id) {
      case 'incense':
        return `<p class="eyebrow">觀世音菩薩主殿</p><h2>上香祈福</h2><p>雙手合十，靜心三息。點燃清香，向觀世音菩薩說出心中的祝願。</p>${note}
          <div class="row"><button class="btn primary" data-ritual="incense">敬上三炷清香</button><button class="btn" data-open="prayer">寫下心願</button></div>`
      case 'prayer':
        return `<p class="eyebrow">線上祈福</p><h2>寫下心願</h2><p>心願將留在本機的祈願牆，也會記入你的祈福紀錄。</p>${note}
          <form class="wish-form"><textarea name="wish" maxlength="120" rows="4" placeholder="例如：願家人平安健康，萬事順心。"></textarea><button class="btn primary" type="submit">送出祈願</button></form>`
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
          <div class="row"><button class="btn primary" data-open="chess">返回象棋卜卦</button><button class="btn" data-act="contact">正式問事聯絡入口</button></div>`
      case 'chess':
        return `<p class="eyebrow">天心仙姑問事亭・象棋卜卦</p><h2>選一枚棋子</h2><p>心中默想一件事，再選擇棋子與落子方向。</p>${note}
          <div class="chess">${['帥', '仕', '相', '馬', '車', '炮', '兵'].map((p, i) => `<button class="piece ${i % 2 ? 'black' : ''}" data-piece="${p}">${p}</button>`).join('')}</div>
          <div class="row dir">${['向前', '守中', '轉向'].map(x => `<button class="btn" data-dir="${x}">${x}</button>`).join('')}</div>
          <div class="row"><button class="btn" data-open="consult">問事服務介紹</button><button class="btn" data-act="contact">正式問事聯絡入口</button></div>`
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
        return `<p class="eyebrow">祈願牆</p><h2>一念善願</h2><p>此牆展示你在此裝置寫下的心願，以及數則示例祈願。</p>${note}
          <ul class="wall">${mine}${sample}</ul><button class="btn primary" data-open="prayer">寫下新的心願</button>`
      }
      case 'records': {
        const rows = d.records.map(r => `<li><b>${esc(r.action)}</b><span>${esc(r.detail)}</span><small>${formatRecordDate(r.at)}</small></li>`).join('')
        return `<p class="eyebrow">祈福紀錄</p><h2>參拜足跡</h2><p>共 ${d.records.length} 筆紀錄，保存在此瀏覽器中。</p>${note}
          <ul class="records">${rows || '<li class="empty">尚無紀錄。走到香爐前上香，開始今日的參拜吧。</li>'}</ul>`
      }
    }
  }

  lotCard(lot: { number: number; title: string; text: string; advice: string }): string {
    return `<div class="lot"><span class="lot-no">第 ${lot.number} 籤</span><h3>${esc(lot.title)}</h3><p>${esc(lot.text)}</p><p class="advice">${esc(lot.advice)}</p><small>今日已求籤，明日可再抽。</small></div>`
  }

  private chessPiece = ''

  private onClick(e: MouseEvent): void {
    const t = (e.target as HTMLElement).closest<HTMLElement>('button')
    if (!t) {
      if ((e.target as HTMLElement).classList.contains('panel-wrap')) {
        e.preventDefault()
        e.stopPropagation()
        this.closePanel()
        this.actions.closePanel()
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
    else if (act === 'contact') this.toast('正式問事聯絡方式即將公布，敬請期待')
    else if (act === 'map') { const m = this.root.querySelector<HTMLElement>('.map')!; m.hidden = !m.hidden }
    else if (act === 'music') {
      const state = this.actions.toggleMusic()
      if (!state.playing) {
        t.textContent = '🔇 音樂：關'
        this.toast('已將背景音樂靜音。')
      } else if (state.track === 'green_tara') {
        t.textContent = `🎵 綠度母 (${state.chantCount || 1}/12)`
        this.toast(`已開啟綠度母梵唱（第 ${state.chantCount || 1}/12 遍），持誦圓滿 12 遍後將轉入《般若波羅蜜多心經》。`)
      } else {
        t.textContent = '🎵 般若心經'
        this.toast('正在播放《般若波羅蜜多心經》，空靈甘甜，除障生慧。')
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
    if (t.dataset.piece) {
      this.chessPiece = t.dataset.piece
      for (const p of this.root.querySelectorAll<HTMLElement>('[data-piece]')) p.classList.toggle('on', p === t)
    }
    if (t.dataset.dir) {
      if (!this.chessPiece) { this.toast('請先選擇一枚棋子'); return }
      const result = this.store.divineChess(this.chessPiece, t.dataset.dir)
      this.actions.ritual('chess')
      this.open('chess', `「${this.chessPiece}」${t.dataset.dir}：${result}`)
      this.chessPiece = ''
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

  onMusicTrackTransition(track: MusicTrack, _title: string): void {
    const btn = this.root.querySelector<HTMLElement>('[data-act="music"]')
    if (btn && this.actions.isMusicPlaying()) {
      btn.textContent = track === 'heart_sutra' ? '🎵 般若心經' : '🎵 綠度母 (1/12)'
    }
    if (track === 'heart_sutra') {
      this.toast('🌸 綠度母心咒已圓滿持誦 12 遍，現轉入《般若波羅蜜多心經》，願智慧圓滿、吉祥安康。', 5200)
    }
  }
}
