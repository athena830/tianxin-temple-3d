import './styles/main.css'
import { Audio } from './engine/audio'
import { Assets } from './engine/assets'
import { Input } from './engine/input'
import { GameLoop } from './engine/loop'
import { SAVE_KEY, SaveStore } from './engine/save'
import { TempleStore, type LampId, type OfferingId } from './game/temple-data'
import type { TempleGame } from './game/temple-game'
import { LOTUS_POND, WISH_POOL } from './game/temple-courtyard'
import { DRAGON_GUANYIN_POS, type ShrinePointId } from './game/temple-world'
import { TempleUi } from './ui/temple-ui'
import { TouchControls } from './ui/touch'

document.documentElement.lang = 'zh-TW'
;(window as any).__TEMPLE_LOADED__ = true

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

  let interactBlockedUntil = 0
  const reopen = (id: ShrinePointId, msg: string) => ui.open(id, msg)
  const ui = new TempleUi(store, {
    begin: () => { audio.unlock(); audio.startMusic(); audio.play('ui'); game?.showSelect(); ui.show('select') },
    choose: id => { store.setCharacter(id); game?.world.setCharacter(id); audio.play('ui') },
    enter: () => {
      audio.unlock(); audio.startMusic()
      game?.enter(); ui.show('hud'); loop.resetAccumulator()
      // Directly start exploring for all devices: seamless entry without an extra "開始探索" prompt
      startExplore()
      if (input.method === 'touch' || document.body.classList.contains('has-touch')) {
        ui.toast('左下搖桿移動，右側拖曳轉視角')
      } else {
        ui.toast('已穿過宮門。滑鼠點擊地面或 WASD 走動，右鍵拖曳轉視角')
      }
    },
    resume: () => { if (!game) return; ui.show('hud'); syncMode() },
    openPanel: () => { game?.openPanel(); touch?.releaseStick(); syncMode() },
    closePanel: () => {
      interactBlockedUntil = Math.max(interactBlockedUntil, Date.now() + 500)
      ui.closePanel()
      game?.closePanel()
      loop.resetAccumulator()
      syncMode()
    },
    travel: id => { game?.setGuide(id); audio.play('ui'); ui.toast('跟著地上的金色箭頭前往') },
    explore: startExplore,
    exitExplore,
    cancelGuide: () => game?.setGuide(null),
    time: mode => game?.world.setTimeSetting(mode),
    toggleMusic: () => audio.toggleMusic(),
    isMusicPlaying: () => audio.isMusicPlaying(),
    getCurrentMusicState: () => audio.getCurrentMusicState(),
    switchTrack: track => audio.switchToTrack(track),
    ritual: action => {
      if (!game) return
      const w = game.world
      if (action === 'incense') { store.offerIncense(); w.perform('incense'); audio.play('chime'); reopen('incense', '清香裊裊，願觀世音菩薩慈悲護佑，平安吉祥。') }
      else if (action === 'wish') { w.perform('wish'); audio.play('chime') }
      else if (action === 'drum') { store.strikeDrum(); w.perform('drum'); audio.play('drum'); ui.toast('「咚——」鼓聲震天，暮鼓收心，萬緣放下。') }
      else if (action === 'bobei') { audio.play('woodfish'); audio.play('coin') }
      else if (action === 'gold-furnace') { w.perform('gold-furnace'); audio.play('chime') }
      else if (action === 'yuhuang') {
        if (game.worshipping) return
        interactBlockedUntil = Date.now() + 3600
        ui.closePanel(); game.closePanel(); syncMode()
        w.perform('yuhuang'); audio.play('chime')
        game.worship({ x: 0, z: -30.2 }, 3.0, () => {
          store.worshipYuhuang(); audio.play('bell')
          ui.toast('朝拜玉皇上帝：願蒙浩恩庇佑，吉星高照，百福駢臻。', 4800)
        })
      }
      else if (action === 'guanyin-dragon') {
        if (game.worshipping) return
        interactBlockedUntil = Date.now() + 5200
        ui.closePanel(); game.closePanel(); syncMode()
        w.perform('guanyin-dragon'); audio.play('chime')
        game.worship(DRAGON_GUANYIN_POS, 4.6, () => {
          store.worshipDragonGuanyin(); audio.play('bell')
          ui.toast('參拜昇龍觀音：仰望五層樓高觀音菩薩乘龍騰雲，祈願吉祥如意、百福駢臻。', 4800)
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
        if (game.worshipping) return
        interactBlockedUntil = Date.now() + 3600
        const cat = ui.selectedWishCategory
        const wishText = ui.customWishInput
        const { count, blessing } = store.tossCoin(cat, wishText)
        ui.lastWishBlessing = blessing
        ui.customWishInput = ''
        ui.hideWishBanner()

        // 1. Close panel immediately so the 3D world is 100% unobstructed!
        ui.closePanel()
        game.closePanel()
        syncMode()

        // 2. Position visitor and frame camera towards the Lotus Wishing Pool
        game.frameWishingPool()

        // 3. Play coin toss audio immediately as the coin is launched
        audio.play('coin-toss')

        // 4. Perform 3D parabolic animation; on splash, play water plop & celestial chime
        w.perform('coin', undefined, {
          playerPos: game.feet,
          onSplash: () => {
            audio.play('water-splash')
            audio.play('wish-chime')
          },
        })

        // 5. Visitor plays prayer/worship pose facing the target lotus pool for 2.4s
        const feet = game.feet
        const distEast = Math.hypot(feet.x - LOTUS_POND.x, feet.z - LOTUS_POND.z)
        const distWest = Math.hypot(feet.x - WISH_POOL.x, feet.z - WISH_POOL.z)
        const targetPool = distWest < distEast && distWest < 8.0 ? WISH_POOL : LOTUS_POND

        game.worship({ x: targetPool.x, z: targetPool.z }, 2.4, () => {
          // 6. After coin has landed and sparkles rise, show the floating wish blessing card at the bottom!
          ui.showWishBanner(blessing, count)
        })
      }
    },
  })
  ui.show('boot')
  audio.onChantProgress = (cur, total) => ui.updateMusicProgress('green_tara', cur, total)
  audio.onTrackChange = (track, title, reason) => ui.onMusicTrackTransition(track, title, reason)
  ;(window as any).__templeAudio__ = audio

  let loaded = 0
  const track = <T>(p: Promise<T>): Promise<T> => p.then(v => (ui.setBootProgress(0.1 + (++loaded / 4) * 0.6), v))
  ui.setBootProgress(0.1)
  const [{ TempleGame }, { Renderer, suggestQuality }, physics] = await Promise.all([
    track(import('./game/temple-game')),
    track(import('./engine/renderer')),
    track(import('./engine/physics')),
    track(Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 400))])),
  ])
  await physics.initPhysics()
  if (firstRun) save.update({ quality: suggestQuality() })
  const renderer = new Renderer(canvas, save.data.quality)
  const g = new TempleGame(renderer, input, audio)
  game = g
  g.reducedMotion = save.data.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches
  g.world.reducedSmoke = g.reducedMotion
  const assets = new Assets()
  assets.onProgress(p => ui.setBootProgress(0.7 + p * 0.2))
  await g.loadModels(assets)
  ui.setBootProgress(0.9)
  // Precompile WebGL shader pipelines while still in boot screen, completely eliminating
  // the 1-2 second frame freeze when entering the 3D scene!
  try {
    renderer.gl.compile(g.world.scene, g.camera)
  } catch (err) {
    console.warn('Shader precompile:', err)
  }
  ui.setBootProgress(1.0)
  g.world.setCharacter(store.data.character)
  for (const id of Object.keys(store.data.lamps) as LampId[]) if (store.data.lamps[id]) g.world.perform(`lamp-${id}`)
  for (const id of Object.keys(store.data.offerings) as OfferingId[]) {
    for (let i = 1; i <= Math.min(2, store.data.offerings[id]); i += 1) g.world.perform(`offer-${id}`, { [id]: i })
  }
  g.onNear = point => ui.near(point)
  g.onGuide = (point, distance) => ui.guideTo(point, distance)
  g.world.onNpcDialogue = (speaker, text) => ui.showNpcDialogue(speaker, text)
  g.world.onTimeOfDayChange = mode => ui.updateTimeSettingLabel(g.world.getTimeSetting(), mode)
  g.onClickResult = result => {
    if (!result) return
    if (Date.now() < interactBlockedUntil || g.worshipping) return
    if (result.kind === 'open') ui.open(result.id)
    else { ui.toast(`前往「${result.point.title}」...`); g.setGuide(result.point.id) }
  }
  // Click anywhere on canvas immediately ensures explore mode is active
  const triggerCushionPrayer = () => {
    if (!g || g.worshipping || Date.now() < interactBlockedUntil) return
    const emptyCushion = g.world.getNearestEmptyCushion(g.feet, 2.5)
    if (!emptyCushion) {
      ui.toast('請靠近觀音菩薩前的紅色拜墊，按 E 跪下拜拜。')
      return
    }
    interactBlockedUntil = Date.now() + 5200
    ui.closePanel()
    g.closePanel()
    syncMode()

    // 鎖定該拜墊為玩家正在參拜，避免 NPC 重疊
    g.world.setPlayerOnCushion(emptyCushion.index, true)

    // 角色精準對齊至拜墊位置
    g.teleportTo(emptyCushion.worldX, emptyCushion.worldZ)

    // 播放引罄清脆聲響與香爐裊裊香煙
    audio.play('chime')
    g.world.perform('incense')
    ui.toast('於觀世音菩薩前跪下虔誠祈福...', 2200)

    // 面向大殿正中央觀音聖像方向 ({ x: 0, z: -12.5 }) 虔誠合十跪拜 4.2 秒
    g.worship({ x: 0, z: -12.5 }, 4.2, () => {
      store.offerIncense()
      audio.play('bell')
      ui.toast('跪拜祈福圓滿：心香一瓣，願觀音菩薩慈悲庇佑，福慧增長、平安吉祥。', 4500)
      g.world.setPlayerOnCushion(emptyCushion.index, false)
    })
  }

  const triggerSkyLantern = () => {
    if (!g || g.worshipping || Date.now() < interactBlockedUntil) return
    const standPos = g.world.getPlayerLanternStand()
    if (!standPos) return
    const dist = Math.hypot(g.feet.x - standPos.x, g.feet.z - standPos.z)
    if (dist > 3.0) {
      ui.toast('請靠近天心仙姑旁的祈福天燈台，按 E 點燃天燈。')
      return
    }
    const launched = g.world.triggerPlayerSkyLantern()
    if (!launched) {
      ui.toast('祈福天燈正在冉冉升空中，稍候片刻再放一盞祈願天燈。')
      return
    }

    interactBlockedUntil = Date.now() + 5200
    ui.closePanel()
    g.closePanel()
    syncMode()

    // 角色對齊至天燈台前方
    g.teleportTo(standPos.x, standPos.z + 1.1)

    // 播放引罄清脆聲響
    audio.play('chime')
    ui.toast('點燃祈福天燈：心願隨燈火冉冉升空...', 2500)

    // 面向天燈台方向虔誠合十祈福 4.2 秒
    g.worship({ x: standPos.x, z: standPos.z }, 4.2, () => {
      store.addRecord('天燈祈福', '於天心仙姑問事亭前點燃祈福天燈，祈願天心指路、福慧圓滿')
      audio.play('bell')
      ui.toast('天燈祈福圓滿：燈耀天心、心願通達，願天心仙姑指點迷津，所求如願、福壽安康！', 4500)
    })
  }

  canvas.addEventListener('pointerdown', () => {
    if (game && game.mode === 'browse' && !game.worshipping && Date.now() >= interactBlockedUntil) startExplore()
  })
  window.addEventListener('temple:interact', e => {
    if (Date.now() < interactBlockedUntil || g.worshipping) return
    const id = (e as CustomEvent<ShrinePointId>).detail
    if (id === 'cushion') {
      triggerCushionPrayer()
      return
    }
    if (id === 'sky-lantern') {
      triggerSkyLantern()
      return
    }
    ui.open(id)
  })
  window.addEventListener('temple:interact-touch', () => {
    if (Date.now() < interactBlockedUntil || g.worshipping) return
    if (g.active && (g.mode === 'explore' || g.mode === 'browse')) {
      if (g.active.id === 'cushion') {
        triggerCushionPrayer()
        return
      }
      if (g.active.id === 'sky-lantern') {
        triggerSkyLantern()
        return
      }
      ui.open(g.active.id)
    }
  })
  window.addEventListener('temple:toast', e => {
    ui.toast((e as CustomEvent<string>).detail, 3200)
  })

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
