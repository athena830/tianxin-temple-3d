/**
 * Unified input: keyboard + mouse (drag to look, never pointer lock), gamepad and touch all feed one action state.
 * Gameplay reads `move`, `look` and `pressed()/held()`; it never checks raw keys.
 *
 * Call `endFrame()` once per rendered frame after gameplay consumed edge-triggered presses.
 */
export type Action = 'jump' | 'sprint' | 'dash' | 'pause' | 'confirm' | 'back' | 'interact'
export type InputMethod = 'keyboard' | 'gamepad' | 'touch'

const KEY_BINDINGS: Record<Action, string[]> = {
  jump: ['Space'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  dash: ['KeyF', 'KeyJ'],
  pause: ['Escape'],
  confirm: ['Enter', 'NumpadEnter'],
  // Menus handle Escape/Backspace themselves via DOM keydown; `back` is the gamepad B button.
  back: [],
  interact: ['KeyE'],
}
const MOVE_KEYS = { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'] }
// Standard gamepad mapping: A=0, B=1, X=2, Y=3, LB=4, RB=5, RT=7, Start=9, L3=10.
const PAD_BINDINGS: Record<Action, number[]> = { jump: [0], sprint: [4, 10], dash: [2, 5, 7], pause: [9], confirm: [0], back: [1], interact: [3] }

export class Input {
  /** Movement intent in [-1, 1]: x = strafe right, y = forward. */
  readonly move = { x: 0, y: 0 }
  /** Camera look delta accumulated since the last `endFrame()` (radians-ish units, pre-sensitivity). */
  readonly look = { x: 0, y: 0 }
  method: InputMethod = 'keyboard'
  /** Multiplies look deltas; settings screen writes it. */
  sensitivity = 1
  invertY = false

  private keys = new Set<string>()
  private held_ = new Set<Action>()
  private pressed_ = new Set<Action>()
  private touchMove = { x: 0, y: 0 }
  private touchButtons = new Set<Action>()
  private padPrev: boolean[] = []
  private padIndex = -1
  private padId = ''
  private listeners: Array<() => void> = []

  constructor(canvas: HTMLCanvasElement) {
    const on = <K extends keyof WindowEventMap>(target: Window | HTMLElement, type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      target.addEventListener(type, fn as EventListener, opts)
      this.listeners.push(() => target.removeEventListener(type, fn as EventListener, opts))
    }
    on(window, 'keydown', e => {
      if (e.repeat) return
      // Never treat typing in a text field (wish form) as movement or shortcuts.
      const typing = (e.target as HTMLElement | null)?.matches?.('input, textarea, select, [contenteditable="true"]')
      if (typing) return
      this.keys.add(e.code)
      this.method = 'keyboard'
      for (const [action, codes] of Object.entries(KEY_BINDINGS) as [Action, string[]][]) {
        if (codes.includes(e.code)) this.pressed_.add(action)
      }
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault()
    })
    on(window, 'keyup', e => this.keys.delete(e.code))
    on(window, 'blur', () => this.clearHeld())
    on(window, 'gamepaddisconnected', e => {
      if (e.gamepad.index === this.padIndex) this.resetPad()
    })
    // Mouse never captures the pointer: drag on the canvas to turn (right button, or left drag), wheel zooms,
    // and a short left click selects whatever was clicked in the scene.
    const target = canvas as HTMLElement
    if (typeof target?.addEventListener !== 'function') return
    target.addEventListener('contextmenu', e => e.preventDefault())
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      if (e.button !== 0 && e.button !== 2) return
      this.drag = { id: e.pointerId, button: e.button, x: e.clientX, y: e.clientY, moved: 0, at: performance.now() }
      try { target.setPointerCapture(e.pointerId) } catch { /* capture is optional */ }
    }
    const onMove = (e: PointerEvent) => {
      const d = this.drag
      if (!d || d.id !== e.pointerId) return
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      d.x = e.clientX
      d.y = e.clientY
      d.moved += Math.abs(dx) + Math.abs(dy)
      if (d.button === 2 || d.moved > 6) {
        this.look.x += dx * 0.0045
        this.look.y += dy * 0.0045
        this.dragging = true
      }
    }
    const onUp = (e: PointerEvent) => {
      const d = this.drag
      if (!d || d.id !== e.pointerId) return
      if (d.button === 0 && d.moved <= 6 && performance.now() - d.at < 600) this.clicks.push({ x: e.clientX, y: e.clientY })
      this.drag = null
      this.dragging = false
    }
    target.addEventListener('pointerdown', onDown)
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', () => { this.drag = null; this.dragging = false })
    target.addEventListener('wheel', e => {
      e.preventDefault()
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
      this.zoom += e.deltaY * unit
    }, { passive: false })
    this.listeners.push(() => {
      target.removeEventListener('pointerdown', onDown)
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
    })
  }

  /** True while a mouse drag is turning the camera (lets the UI show a grabbing cursor). */
  dragging = false
  private drag: { id: number; button: number; x: number; y: number; moved: number; at: number } | null = null
  private clicks: { x: number; y: number }[] = []
  private zoom = 0

  /** Clicks (client pixels) on the 3D canvas since the last call. */
  takeClicks(): { x: number; y: number }[] {
    const out = this.clicks
    this.clicks = []
    return out
  }

  /** Accumulated wheel delta in pixels since the last call (positive = zoom out). */
  takeZoom(): number {
    const z = this.zoom
    this.zoom = 0
    return z
  }

  /** Release every held key/stick so the visitor stops when a panel opens or the tab loses focus. */
  clearHeld(): void {
    this.keys.clear()
    this.touchMove.x = 0
    this.touchMove.y = 0
    this.touchButtons.clear()
    this.move.x = 0
    this.move.y = 0
    this.pressed_.clear()
  }

  /** Touch controls feed these from the on-screen joystick and buttons. */
  setTouchMove(x: number, y: number): void {
    this.method = 'touch'
    this.touchMove.x = x
    this.touchMove.y = y
  }

  addTouchLook(dx: number, dy: number): void {
    this.method = 'touch'
    this.look.x += dx * 0.006
    this.look.y += dy * 0.006
  }

  setTouchButton(action: Action, down: boolean): void {
    this.method = 'touch'
    if (down && !this.touchButtons.has(action)) this.pressed_.add(action)
    if (down) this.touchButtons.add(action)
    else this.touchButtons.delete(action)
  }

  private resetPad(): void {
    this.padPrev = []
    this.padIndex = -1
    this.padId = ''
  }

  /** Sample once per rendered frame; elapsed time scales continuous stick look only. */
  update(frameSeconds = 1 / 60): void {
    const k = (codes: string[]) => codes.some(code => this.keys.has(code))
    let x = (k(MOVE_KEYS.right) ? 1 : 0) - (k(MOVE_KEYS.left) ? 1 : 0)
    let y = (k(MOVE_KEYS.up) ? 1 : 0) - (k(MOVE_KEYS.down) ? 1 : 0)
    this.held_.clear()
    for (const [action, codes] of Object.entries(KEY_BINDINGS) as [Action, string[]][]) {
      if (k(codes)) this.held_.add(action)
    }
    for (const action of this.touchButtons) this.held_.add(action)
    if (this.touchMove.x !== 0 || this.touchMove.y !== 0) {
      x = this.touchMove.x
      y = this.touchMove.y
    }
    const pad = navigator.getGamepads?.().find(p => p && p.connected)
    if (pad) {
      if (pad.index !== this.padIndex || pad.id !== this.padId) this.padPrev = []
      this.padIndex = pad.index
      this.padId = pad.id
      const dead = (v: number) => (Math.abs(v) < 0.18 ? 0 : v)
      const lx = dead(pad.axes[0] ?? 0)
      const ly = dead(pad.axes[1] ?? 0)
      const rx = dead(pad.axes[2] ?? 0)
      const ry = dead(pad.axes[3] ?? 0)
      const padActive = lx !== 0 || ly !== 0 || rx !== 0 || ry !== 0 || pad.buttons.some(b => b.pressed)
      if (padActive) this.method = 'gamepad'
      const dx = (pad.buttons[15]?.pressed ? 1 : 0) - (pad.buttons[14]?.pressed ? 1 : 0)
      const dy = (pad.buttons[12]?.pressed ? 1 : 0) - (pad.buttons[13]?.pressed ? 1 : 0)
      if (lx !== 0 || ly !== 0 || dx !== 0 || dy !== 0) {
        x = dx || lx
        y = dy || -ly
      }
      // Preserve the 60 Hz turn rate at every render frequency.
      this.look.x += rx * 2.7 * frameSeconds
      this.look.y += ry * 2.7 * frameSeconds
      for (const [action, buttons] of Object.entries(PAD_BINDINGS) as [Action, number[]][]) {
        if (buttons.some(i => pad.buttons[i]?.pressed)) this.held_.add(action)
        // Alternate bindings are independent physical presses, even when another is held.
        if (buttons.some(i => pad.buttons[i]?.pressed && !this.padPrev[i])) this.pressed_.add(action)
      }
      this.padPrev = pad.buttons.map(b => b.pressed)
    } else this.resetPad()
    const len = Math.hypot(x, y)
    this.move.x = len > 1 ? x / len : x
    this.move.y = len > 1 ? y / len : y
  }

  held(action: Action): boolean {
    return this.held_.has(action)
  }

  /** True once per physical press. */
  pressed(action: Action): boolean {
    return this.pressed_.has(action)
  }

  /**
   * Read and clear a press. Use this inside fixed simulation steps: several steps can run in one
   * rendered frame, and a press must trigger exactly one jump/confirm.
   */
  consume(action: Action): boolean {
    return this.pressed_.delete(action)
  }

  /** Consume the look delta with sensitivity/invert applied. */
  takeLook(): { x: number; y: number } {
    const out = { x: this.look.x * this.sensitivity, y: this.look.y * this.sensitivity * (this.invertY ? -1 : 1) }
    this.look.x = 0
    this.look.y = 0
    return out
  }

  endFrame(): void {
    this.pressed_.clear()
  }

  dispose(): void {
    for (const off of this.listeners) off()
    this.listeners = []
  }
}
