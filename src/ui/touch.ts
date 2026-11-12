import type { Input } from '../engine/input'

/**
 * On-screen touch controls: a joystick anchored bottom-left and drag-to-look on the rest of the canvas.
 * Enabled automatically on the first touch.
 */
export class TouchControls {
  private stickId: number | null = null
  private lookId: number | null = null
  private origin = { x: 0, y: 0 }
  private last = { x: 0, y: 0 }
  private readonly stick: HTMLElement
  private readonly knob: HTMLElement
  private readonly radius = 56

  constructor(root: HTMLElement, private readonly input: Input, private readonly active: () => boolean, private readonly canMove: () => boolean = active) {
    const layer = root.querySelector<HTMLElement>('.touch')!
    this.stick = layer.querySelector('.touch-stick')!
    this.knob = this.stick.querySelector('i')!

    const enable = () => document.body.classList.add('has-touch')
    if (matchMedia('(pointer: coarse)').matches) enable()
    window.addEventListener('touchstart', enable, { once: true, passive: true })
    // Any touch switches hints/prompts to touch, even taps on menu buttons.
    window.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch') this.input.method = 'touch'
    }, { capture: true })

    const canvas = document.querySelector<HTMLCanvasElement>('#game')!
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch' || !this.active()) return
      if (e.clientX < window.innerWidth * 0.45 && e.clientY > window.innerHeight * 0.45 && this.stickId === null && this.canMove()) {
        // The stick stays anchored bottom-left; the knob offset is measured from its centre.
        const r = this.stick.getBoundingClientRect()
        this.stickId = e.pointerId
        this.origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
        this.stick.classList.add('is-active')
        this.moveStick(e.clientX, e.clientY)
      } else if (this.lookId === null) {
        this.lookId = e.pointerId
        this.last = { x: e.clientX, y: e.clientY }
      }
    })
    window.addEventListener('pointermove', e => {
      if (e.pointerId === this.stickId) this.moveStick(e.clientX, e.clientY)
      else if (e.pointerId === this.lookId) {
        this.input.addTouchLook(e.clientX - this.last.x, e.clientY - this.last.y)
        this.last = { x: e.clientX, y: e.clientY }
      }
    })
    const end = (e: PointerEvent) => {
      if (e.pointerId === this.stickId) this.releaseStick()
      if (e.pointerId === this.lookId) this.lookId = null
    }
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  /** Called when a panel opens or exploration stops so the visitor never keeps walking. */
  releaseStick(): void {
    this.stickId = null
    this.knob.style.transform = ''
    this.stick.classList.remove('is-active')
    this.input.setTouchMove(0, 0)
  }

  private moveStick(x: number, y: number): void {
    let dx = x - this.origin.x
    let dy = y - this.origin.y
    const len = Math.hypot(dx, dy)
    if (len > this.radius) {
      dx = (dx / len) * this.radius
      dy = (dy / len) * this.radius
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`
    this.input.setTouchMove(dx / this.radius, -dy / this.radius)
  }
}
