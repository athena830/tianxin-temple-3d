import './styles/main.css'
import { Audio } from './engine/audio'
import { Assets } from './engine/assets'
import { Input } from './engine/input'
import { GameLoop } from './engine/loop'
import { SAVE_KEY, SaveStore } from './engine/save'
import { TempleStore, type LampId, type OfferingId } from './game/temple-data'
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
  let lockLostAt = 0

  const reopen = (id: ShrinePointId, msg: string) => ui.open(id, msg)
  const ui = new TempleUi(store, {
    begin: () => { audio.unlock(); audio.play('ui'); game?.showSelect(); ui.show('select') },
    choose: id => { store.setCharacter(id); game?.world.setCharacter(id); audio.play('ui') },
    enter: () => {
      audio.unlock(); audio.startMusic()
      game?.enter(); ui.show('hud'); loop.resetAccumulator(); input.lockPointer()
      ui.toast('穿過宮門，沿著石道前往觀音佛祖主殿')
    },
    resume: () => { if (!game) return; game.resume(); ui.show('hud'); loop.resetAccumulator(); input.lockPointer() },
    openPanel: () => { if (game && game.mode === 'explore') game.mode = 'panel'; input.unlockPointer() },
    closePanel: () => { ui.closePanel(); if (game?.mode === 'panel') { game.resume(); loop.resetAccumulator(); input.lockPointer() } },
    travel: id => { game?.travelTo(id); audio.play('ui') },
    ritual: action => {
      if (!game) return
      const w = game.world
      if (action === 'incense') { store.offerIncense(); w.perform('incense'); audio.play('chime'); reopen('incense', '清香裊裊，願觀音佛祖慈悲護佑，平安吉祥。') }
      else if (action === 'wish') { w.perform('wish'); audio.play('chime') }
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
  const assets = new Assets()
  assets.onProgress(p => ui.setBootProgress(0.7 + p * 0.3))
  await g.loadModels(assets)
  g.world.setCharacter(store.data.character)
  for (const id of Object.keys(store.data.lamps) as LampId[]) if (store.data.lamps[id]) g.world.perform(`lamp-${id}`)
  for (const id of Object.keys(store.data.offerings) as OfferingId[]) {
    for (let i = 1; i <= Math.min(2, store.data.offerings[id]); i += 1) g.world.perform(`offer-${id}`, { [id]: i })
  }
  g.onNear = point => ui.near(point)
  window.addEventListener('temple:interact', e => ui.open((e as CustomEvent<ShrinePointId>).detail))
  window.addEventListener('temple:interact-touch', () => { if (g.mode === 'explore' && g.active) ui.open(g.active.id) })

  if (import.meta.env.DEV) {
    const [{ registerGameTuning }, { tuning }] = await Promise.all([import('../scripts/manus-tuning/adapter.js'), import('./game/tuning')])
    await registerGameTuning(tuning)
  }

  const pause = () => {
    if (g.mode !== 'explore') return
    g.mode = 'paused'
    ui.show('pause')
    input.unlockPointer()
  }
  const loop = new GameLoop({
    beforeFrame: frameSeconds => input.update(frameSeconds),
    step: dt => g.step(dt),
    render: (alpha, frameSeconds) => {
      if (input.consume('pause') && performance.now() - lockLostAt > 300) {
        if (g.mode === 'panel') { ui.closePanel(); g.mode = 'explore' }
        else if (g.mode === 'explore') pause()
      }
      g.render(alpha, frameSeconds)
    },
  })
  loop.start()
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && g.mode === 'explore' && input.method === 'keyboard') { lockLostAt = performance.now(); pause() }
  })
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause() })
  canvas.addEventListener('click', () => { if (g.mode === 'explore') input.lockPointer() })
  new TouchControls(document.getElementById('ui')!, input, () => g.mode === 'explore')
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
