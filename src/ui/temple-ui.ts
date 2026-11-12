import { CHARACTERS, LOTS, TempleStore, formatRecordDate, type CharacterId, type LampId, type OfferingId } from '../game/temple-data'
import type { ShrinePoint, ShrinePointId } from '../game/temple-world'
export type PanelId = ShrinePointId | 'consult'

const esc = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const SAMPLE_WISHES = ['願家人身體健康，平安順遂。', '祈求考試順利，心定不慌。', '願世間少些病苦，多些溫柔。', '新的一年，工作踏實、心安自在。']

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
}

export class TempleUi {
  screen = 'boot'
  private readonly root: HTMLElement
  private toastTimer = 0

  constructor(private readonly store: TempleStore, private readonly actions: TempleUiActions) {
    this.root = document.getElementById('ui')!
    this.root.innerHTML = `
      <section class="screen boot" data-screen="boot"><img class="boot-icon" src="./favicon.png" alt="" width="72" height="72" /><p>宮門將啟，正在備香⋯</p><div class="bar"><i></i></div></section>
      <section class="screen title" data-screen="title">
        <div class="title-card">
          <div class="seal">玉</div>
          <p class="eyebrow">線上 3D 宮廟</p>
          <h1>玉皇宮</h1>
          <p class="lead">心願有寄，平安相伴。穿過宮門，走進觀音佛祖主殿，以自己的步伐參拜祈福。</p>
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
            <button class="chip" data-act="map">參拜指引</button>
            <button class="chip" data-open="records">祈福紀錄</button>
            <button class="chip" data-open="prayer-wall">祈願牆</button>
          </div>
        </header>
        <nav class="map" hidden>
          <p>選擇目的地，跟著金色箭頭前往</p>
          <button data-go="tiangong">參拜天公爐</button><button data-go="chess">天心仙姑問事亭</button><button data-go="incense">上香祈福</button><button data-go="prayer">寫下心願</button><button data-go="offerings">虛擬供奉</button>
          <button data-go="lamps">祈福燈區</button><button data-go="daily-lot">每日抽籤</button>
          <button data-go="woodfish">敲木魚</button><button data-go="bell">鳴鐘</button><button data-go="wishing-pool">蓮花許願池</button>
          <button data-go="prayer-wall">祈願牆</button><button data-go="records">祈福紀錄</button>
        </nav>
        <div class="prompt" hidden><b data-prompt-title></b><span data-prompt-sub></span><kbd class="key">E</kbd><button class="btn small primary touch-only" data-act="interact">互動</button></div>
        <div class="guide" hidden><span>前往</span><b data-guide-name></b><small data-guide-dist></small><button class="guide-x" data-act="guide-cancel" aria-label="取消指引">×</button></div>
        <div class="mode-bar">
          <button class="btn primary" data-act="explore" data-when="browse">開始探索</button>
          <button class="chip exit" data-act="exit" data-when="explore">退出探索<kbd class="key">Esc</kbd></button>
        </div>
        <p class="help" data-when="browse">按「開始探索」後即可走動・右鍵拖曳轉視角・滾輪縮放・點擊設施互動</p>
        <p class="help" data-when="explore">WASD／方向鍵 移動・Shift 快走・右鍵拖曳 轉視角・滾輪 縮放・E 或點擊 互動・Esc 退出探索</p>
        <div class="touch"><div class="touch-stick"><i></i></div></div>
      </section>
      <section class="screen pause" data-screen="pause"><div class="title-card"><h2>暫歇片刻</h2><p class="lead">點擊下方按鈕繼續參拜。</p><button class="btn primary" data-act="resume">繼續參拜</button></div></section>
      <div class="panel-wrap" hidden><article class="panel"><button class="close" data-act="close" aria-label="關閉">×</button><div class="panel-body"></div></article></div>
      <div class="toast" hidden></div>`
    this.root.addEventListener('click', e => this.onClick(e))
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

  toast(text: string, ms = 2600): void {
    const el = this.root.querySelector<HTMLElement>('.toast')!
    el.textContent = text
    el.hidden = false
    clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => { el.hidden = true }, ms)
  }

  closePanel(): void { this.root.querySelector<HTMLElement>('.panel-wrap')!.hidden = true }

  open(id: PanelId, message = ''): void {
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
        return `<p class="eyebrow">觀音佛祖主殿</p><h2>上香祈福</h2><p>雙手合十，靜心三息。點燃清香，向觀音佛祖說出心中的祝願。</p>${note}
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
          ${lot ? this.lotCard(lot) : '<button class="btn primary" data-ritual="lottery">搖籤筒・求今日籤</button>'}`
      }
      case 'tiangong':
        return `<p class="eyebrow">前庭天公爐</p><h2>參拜玉皇上帝</h2><p>立於天公爐前，雙手合十，向玉皇上帝敬拜。人物會面向天公爐合掌鞠躬，完成後即可繼續走動。</p>${note}
          <div class="row"><button class="btn primary" data-ritual="tiangong">合掌敬拜</button></div>`
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
      case 'wishing-pool':
        return `<p class="eyebrow">許願池</p><h2>投一枚祈福銅錢</h2><p>默念心願，將虛擬銅錢投入池中。此處不涉及任何真實付款。</p>${note}
          <p class="stat">已投入 <b>${d.coins}</b> 枚</p><button class="btn primary big" data-ritual="coin">投下銅錢</button>`
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
    if (!t) { if ((e.target as HTMLElement).classList.contains('panel-wrap')) this.actions.closePanel(); return }
    const act = t.dataset.act
    if (act === 'begin') this.actions.begin()
    else if (act === 'enter') this.actions.enter()
    else if (act === 'resume') this.actions.resume()
    else if (act === 'close') this.actions.closePanel()
    else if (act === 'explore') this.actions.explore()
    else if (act === 'exit') this.actions.exitExplore()
    else if (act === 'guide-cancel') this.actions.cancelGuide()
    else if (act === 'interact') window.dispatchEvent(new CustomEvent('temple:interact-touch'))
    else if (act === 'contact') this.toast('正式問事聯絡方式即將公布，敬請期待')
    else if (act === 'map') { const m = this.root.querySelector<HTMLElement>('.map')!; m.hidden = !m.hidden }
    if (t.dataset.char) { this.actions.choose(t.dataset.char as CharacterId); this.refreshCharacter() }
    if (t.dataset.open) this.open(t.dataset.open as PanelId)
    if (t.dataset.go) { this.root.querySelector<HTMLElement>('.map')!.hidden = true; this.actions.travel(t.dataset.go as ShrinePointId) }
    if (t.dataset.ritual) this.actions.ritual(t.dataset.ritual)
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
}
