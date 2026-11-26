import type { Audio } from '../engine/audio'
import type { Input } from '../engine/input'
import type { Renderer } from '../engine/renderer'
import type { MarketGame } from './market-game'
import type { TempleGame } from './temple-game'

export type WorldId = 'temple' | 'market'
export type PortalTransitionState = 'idle' | 'entering-portal' | 'loading-target-world' | 'fading-in'
type ActiveGame = TempleGame | MarketGame

export function canBeginPortalTransition(state: PortalTransitionState): boolean { return state === 'idle' }

type SceneManagerOptions = {
  renderer: Renderer
  input: Input
  audio: Audio
  createTemple: () => Promise<TempleGame>
  createMarket: () => Promise<MarketGame>
  onTransition: (state: PortalTransitionState, message: string) => void
  onWorldChanged: (world: WorldId, game: ActiveGame) => void
  onError: (message: string) => void
  canEnterMarket?: () => boolean
}

/** Owns which world is alive. It keeps renderer/input/audio shared, but never keeps two worlds loaded. */
export class SceneManager {
  world: WorldId = 'temple'
  state: PortalTransitionState = 'idle'
  current!: ActiveGame

  constructor(private readonly options: SceneManagerOptions) {}

  async initialize(): Promise<TempleGame> {
    const game = await this.options.createTemple()
    this.current = game
    this.world = 'temple'
    this.options.onWorldChanged('temple', game)
    return game
  }

  /** Register the boot-loaded temple without constructing a second copy. */
  adoptInitial(game: TempleGame): void {
    this.current = game
    this.world = 'temple'
    this.options.onWorldChanged('temple', game)
  }

  async enterMarket(): Promise<void> { await this.switchTo('market') }
  async returnTemple(): Promise<void> { await this.switchTo('temple') }

  private async switchTo(target: WorldId): Promise<void> {
    if (target === 'market' && this.options.canEnterMarket && !this.options.canEnterMarket()) {
      return
    }
    if (!canBeginPortalTransition(this.state) || this.world === target) return
    const previous = this.current
    this.state = 'entering-portal'
    this.options.input.clearHeld()
    this.options.onTransition(this.state, '穿越靈光之門⋯')
    try {
      await pause(550)
      this.state = 'loading-target-world'
      this.options.onTransition(this.state, target === 'market' ? '載入天心靈光市集⋯' : '載入天心宮主殿⋯')
      previous.dispose()
      const next = target === 'market' ? await this.options.createMarket() : await this.options.createTemple()
      this.current = next
      this.world = target
      if (target === 'temple') (next as TempleGame).enterFromMarket()
      else (next as MarketGame).enter()
      this.state = 'fading-in'
      this.options.onWorldChanged(target, next)
      this.options.onTransition(this.state, target === 'market' ? '抵達靈光市集⋯' : '回到天心宮⋯')
      await pause(420)
      this.state = 'idle'
      this.options.onTransition('idle', '')
    } catch (error) {
      const recoveryWorld: WorldId = target === 'market' ? 'temple' : 'market'
      // The previous world has already released its GPU and physics resources. Recreate it rather
      // than trying to render disposed objects, so a failed lazy import cannot leave a white canvas.
      const recovery = recoveryWorld === 'temple' ? await this.options.createTemple() : await this.options.createMarket()
      this.current = recovery
      this.world = recoveryWorld
      if (recoveryWorld === 'temple') (recovery as TempleGame).enterFromMarket()
      else (recovery as MarketGame).enter()
      this.options.onWorldChanged(recoveryWorld, recovery)
      this.state = 'idle'
      this.options.onTransition('idle', '')
      this.options.onError('時空門暫時無法開啟，已保留目前世界。請稍後再試。')
      console.error('Portal transition failed:', error)
    }
  }

  step(dt: number): void { if (this.state === 'idle') this.current.step(dt) }
  render(alpha: number, frameSeconds: number): void {
    // Once disposal starts, never call a former world's renderer or Rapier handles again.
    if (this.state === 'idle') this.current.render(alpha, frameSeconds)
  }
}

function pause(milliseconds: number): Promise<void> { return new Promise(resolve => window.setTimeout(resolve, milliseconds)) }
