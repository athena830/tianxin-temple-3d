import './styles/main.css'
import { Audio } from './engine/audio'
import { Assets } from './engine/assets'
import { Input } from './engine/input'
import { GameLoop } from './engine/loop'
import { SAVE_KEY, SaveStore } from './engine/save'
import { TempleStore, type LampId, type OfferingId } from './game/temple-data'
import { TIANGONG } from './game/temple-courtyard'
import type { TempleGame } from './game/temple-game'
import type { ShrinePointId } from './game/temple-world'
import { TempleUi } from './ui/temple-ui'
import { TouchControls } from './ui/touch'

document.documentElement.lang = 'zh-TW'

async function boot(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#game')!
  const firstRun = safeGet(SAVE_KEY) === null
  const save = new SaveStore()
  const store = new TempleStore()
  const input = new Input(canvas)
  const audio = new Audio()
  audio.setVolumes(save.data.musicVolume * 0.6, save.data.sfxVolume, save.data.muted)
  let game: TempleGame | undefined
  let touch: TouchControls | undefined
  const syncMode = () => { if (game) ui.setMode(game.mode === 'panel' ? 'panel' : game.mode) }
  const startExplore = () => { if (!game) return; audio.unlock(); game.startExplore(); syncMode(); loop.resetAccumulator() }
  const exitExplore = () => { if (!game) return; game.stopExplore(); touch?.releaseStick(); syncMode() }

  const reopen = (id: ShrinePointId, msg: string) => ui.open(id, msg)
  const ui = new TempleUi(store, {
    begin: () => { audio.unlock(); audio.play('ui'); game?.showSelect(); ui.show('select') },
    choose: id => { store.setCharacter(id); game?.world.setCharacter(id); audio.play('ui') },
    enter: () => {
      audio.unlock(); audio.startMusic()
      game?.enter(); ui.show('hud'); loop.resetAccumulator()
      // Touch devices go straight to exploring; desktop starts with a free mouse until the visitor opts in.
      if (input.method === 'touch' || document.body.classList.contains('has-touch')) { startExplore(); ui.toast('左下搖桿移動，右側拖曳轉視角') }
      else { syncMode(); ui.toast('已穿過宮門。按「開始探索」後用 WASD 走動，沿石道前往觀音佛祖主殿') }
    },
    resume: () => { if (!game) return; ui.show('hud'); syncMode() },
    openPanel: () => { game?.openPanel(); touch?.releaseStick(); syncMode() },
    closePanel: () => { ui.closePanel(); game?.closePanel(); loop.resetAccumulator(); syncMode() },
    travel: id => { game?.setGuide(id); audio.play('ui'); ui.toast('跟著地上的金色箭頭前往') },
    explore: startExplore,
    exitExplore,
    cancelGuide: () => game?.setGuide(null),
    ritual: action => {
      if (!game) return
      const w = game.world
      if (action === 'incense') { store.offerIncense(); w.perform('incense'); audio.play('chime'); reopen('incense', '清香裊裊，願觀音佛祖慈悲護佑，平安吉祥。') }
      else if (action === 'wish') { w.perform('wish'); audio.play('chime') }
      else if (action === 'tiangong') {
        if (game.worshipping) return
        // Close the panel, face the urn, bow with palms together, then show the blessing and resume free movement.
        ui.closePanel(); game.closePanel(); syncMode()
        w.perform('tiangong'); audio.play('chime')
        game.worship(TIANGONG, 2.6, () => {
          store.worshipTiangong(); audio.play('bell')
          ui.toast('敬拜玉皇上帝：願天公庇佑，風調雨順，闔家平安。', 4800)
        })
      }
      else if (action.startsWith('offer-')) {
        const id = action.slice(6) as OfferingId
        store.offer(id); w.perform(action, store.data.offerings); audio.play('pickup')
        reopen('offerings', `${({ flower: '鮮花', fruit: '鮮果', tea: '清茶' } as const)[id]}已供於主殿供桌，心意圓滿。`)
      } else if (action.startsWith('lamp-')) {
        const id = action.slice(5) as LampId
        if (store.lightLamp(id)) { w.perform(action); audio.play('chime') }
        reopen('lamps', `${({ peace: '平安燈', wealth: '財神燈', study: '文昌燈' } as const)[id]}已點亮，燈火長明。`)
      } else if (action === 'lottery') {
        const { lot, fresh } = store.drawDailyLot()
        w.perform('lottery'); audio.play(fresh ? 'chime' : 'ui')
        reopen('daily-lot', fresh ? `求得第 ${lot.number} 籤。` : '今日已求過籤。')
      } else if (action === 'chess') { w.perform('chess'); audio.play('chime') }
      else if (action === 'woodfish') { store.tapWoodfish(); w.perform('woodfish'); audio.play('woodfish'); ui.toast('叩——心念安定') }
      else if (action === 'bell') { store.ringBell(); w.perform('bell'); audio.play('bell'); ui.toast('鐘聲悠遠，祝福遠播') }
      else if (action === 'coin') {
        const n = store.tossCoin(); w.perform('coin'); audio.play('coin')
        reopen('wishing-pool', `銅錢落入池中，泛起漣漪。這是你投下的第 ${n} 枚。`)
      }
    },
  })
  ui.show('boot')

  let loaded = 0
  const track = <T>(p: Promise<T>): Promise<T> => p.then(v => (ui.setBootProgress(0.1 + (++loaded / 4) * 0.6), v))
  ui.setBootProgress(0.1)
  const [{ TempleGame }, { Renderer, suggestQuality }, physics] = await Promise.all([
    track(import('./game/temple-game')),
    track(import('./engine/renderer')),
    track(import('./engine/physics')),
    track(document.fonts.ready),
  ])
  await physics.initPhysics()
  if (firstRun) save.update({ quality: suggestQuality() })
  const renderer = new Renderer(canvas, save.data.quality)
  const g = new TempleGame(renderer, input, audio)
  game = g
  g.reducedMotion = save.data.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches
  g.world.reducedSmoke = g.reducedMotion
  const assets = new Assets()
  assets.onProgress(p => ui.setBootProgress(0.7 + p * 0.3))
  await g.loadModels(assets)
  g.world.setCharacter(store.data.character)
  for (const id of Object.keys(store.data.lamps) as LampId[]) if (store.data.lamps[id]) g.world.perform(`lamp-${id}`)
  for (const id of Object.keys(store.data.offerings) as OfferingId[]) {
    for (let i = 1; i <= Math.min(2, store.data.offerings[id]); i += 1) g.world.perform(`offer-${id}`, { [id]: i })
  }
  g.onNear = point => ui.near(point)
  g.onGuide = (point, distance) => ui.guideTo(point, distance)
  g.onClickResult = result => {
    if (!result) return
    if (result.kind === 'open') ui.open(result.id)
    else { ui.toast(`「${result.point.title}」還有一段距離，請再走近一點`); g.setGuide(result.point.id) }
  }
  window.addEventListener('temple:interact', e => ui.open((e as CustomEvent<ShrinePointId>).detail))
  window.addEventListener('temple:interact-touch', () => { if (g.active && (g.mode === 'explore' || g.mode === 'browse')) ui.open(g.active.id) })

  if (import.meta.env.DEV) {
    const [{ registerGameTuning }, { tuning }] = await Promise.all([import('../scripts/manus-tuning/adapter.js'), import('./game/tuning')])
    await registerGameTuning(tuning)
  }

  let stepped = false
  const loop = new GameLoop({
    beforeFrame: frameSeconds => input.update(frameSeconds),
    step: dt => { g.step(dt); stepped = true },
    render: (alpha, frameSeconds) => {
      // Esc closes the open panel first; otherwise it leaves exploration and returns the mouse to the page.
      if (input.consume('pause')) {
        if (ui.panelOpen) { ui.closePanel(); g.closePanel(); syncMode() }
        else if (g.mode === 'explore') exitExplore()
      }
      g.render(alpha, frameSeconds)
      // Clear edge presses only once the simulation has seen them; a frame with no fixed step must not drop a key.
      if (stepped) { input.endFrame(); stepped = false }
    },
  })
  loop.start()
  document.addEventListener('visibilitychange', () => { if (document.hidden) exitExplore() })
  touch = new TouchControls(document.getElementById('ui')!, input, () => g.mode === 'explore' || g.mode === 'browse', () => g.mode === 'explore')
  g.mode = 'select'
  ui.show('title')
  ;(window as unknown as { __game: unknown }).__game = { game: g, ui, input, store }
}

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

boot().catch(err => {
  console.error(err)
  const el = document.getElementById('ui')
  if (el) el.innerHTML = `<div class="fatal">無法啟動：${String((err as Error)?.message ?? err).replace(/[<>&]/g, '')}</div>`
})
