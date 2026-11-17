/**
 * Web Audio mixer with music and SFX buses. Browsers only allow audio after a user gesture, so
 * call `unlock()` from the first click/key press (the title screen does this).
 *
 * The starter ships no audio files: SFX are synthesized and the music is a generative ambient
 * pad. To use recorded assets, `load(url)` an AudioBuffer and `playBuffer()` it on either bus.
 */
export type Sfx = 'pickup' | 'jump' | 'land' | 'hurt' | 'ui' | 'win' | 'lose' | 'dash' | 'bell' | 'woodfish' | 'coin' | 'chime' | 'drum' | 'coin-toss' | 'water-splash' | 'wish-chime'

export type MusicTrack = 'green_tara' | 'heart_sutra'

export const TARGET_TARA_CHANTS = 12

const TARA_OFFSETS = [24.0, 37.5, 51.0, 64.5, 78.0, 91.5, 105.0, 118.5, 132.0, 145.5, 159.0, 172.5, 186.0, 199.5]

export class Audio {
  readonly ctx: AudioContext
  private master: GainNode
  private music: GainNode
  private sfx: GainNode
  private musicOn = false
  private currentTrack: MusicTrack = Math.random() < 0.5 ? 'green_tara' : 'heart_sutra'
  private taraChantCount = 0
  private taraLoopCount = 0
  private lastTTime = 0
  private taraAudio?: HTMLAudioElement
  private heartAudio?: HTMLAudioElement
  private buffers = new Map<string, AudioBuffer>()

  onChantProgress?: (current: number, total: number) => void
  onTrackChange?: (track: MusicTrack, title: string, reason?: 'auto_complete' | 'manual' | 'init') => void

  constructor() {
    this.ctx = new AudioContext()
    this.master = this.ctx.createGain()
    this.music = this.ctx.createGain()
    this.music.gain.value = 0.45
    this.sfx = this.ctx.createGain()
    this.music.connect(this.master)
    this.sfx.connect(this.master)
    this.master.connect(this.ctx.destination)
  }

  unlock(): void {
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  /** Volumes in 0..1. */
  setVolumes(music: number, sfx: number, muted = false): void {
    const t = this.ctx.currentTime
    const targetMusicVol = muted ? 0 : music * 0.45
    this.music.gain.setTargetAtTime(targetMusicVol, t, 0.05)
    this.sfx.gain.setTargetAtTime(muted ? 0 : sfx * 0.8, t, 0.05)
    if (this.taraAudio) this.taraAudio.volume = targetMusicVol
    if (this.heartAudio) this.heartAudio.volume = targetMusicVol
  }

  async load(url: string): Promise<AudioBuffer> {
    const cached = this.buffers.get(url)
    if (cached) return cached
    const data = await (await fetch(url)).arrayBuffer()
    const buffer = await this.ctx.decodeAudioData(data)
    this.buffers.set(url, buffer)
    return buffer
  }

  playBuffer(buffer: AudioBuffer, bus: 'music' | 'sfx' = 'sfx', loop = false): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    src.loop = loop
    src.connect(bus === 'music' ? this.music : this.sfx)
    src.start()
    return src
  }

  play(name: Sfx): void {
    if (this.ctx.state !== 'running') return
    const t = this.ctx.currentTime
    const tone = (freq: number, end: number, dur: number, type: OscillatorType, vol: number, delay = 0) => {
      const o = this.ctx.createOscillator()
      const g = this.ctx.createGain()
      o.type = type
      o.frequency.setValueAtTime(freq, t + delay)
      o.frequency.exponentialRampToValueAtTime(Math.max(end, 20), t + delay + dur)
      g.gain.setValueAtTime(0.0001, t + delay)
      g.gain.exponentialRampToValueAtTime(vol, t + delay + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur)
      o.connect(g).connect(this.sfx)
      o.start(t + delay)
      o.stop(t + delay + dur + 0.05)
    }
    switch (name) {
      case 'pickup': tone(880, 1320, 0.12, 'triangle', 0.35); tone(1320, 1760, 0.16, 'sine', 0.25, 0.06); break
      case 'jump': tone(300, 620, 0.14, 'square', 0.12); break
      case 'land': tone(160, 70, 0.1, 'sine', 0.25); break
      case 'hurt': tone(220, 90, 0.28, 'sawtooth', 0.22); break
      case 'ui': tone(660, 700, 0.06, 'triangle', 0.18); break
      case 'dash': tone(500, 180, 0.18, 'sawtooth', 0.1); break
      case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, f * 1.01, 0.3, 'triangle', 0.25, i * 0.11)); break
      case 'bell': [196, 392, 588, 785].forEach((f, i) => tone(f, f * 0.995, 3.2 - i * 0.5, 'sine', 0.3 / (i + 1))); break
      case 'drum': tone(95, 38, 0.75, 'sine', 0.55); tone(140, 50, 0.45, 'triangle', 0.35); tone(60, 30, 1.2, 'sine', 0.4, 0.02); break
      case 'woodfish': tone(720, 380, 0.09, 'triangle', 0.45); tone(1450, 900, 0.05, 'sine', 0.15); break
      case 'coin': tone(2100, 2000, 0.25, 'sine', 0.2); tone(2800, 2700, 0.2, 'sine', 0.12, 0.08); tone(300, 120, 0.35, 'sine', 0.12, 0.45); break
      case 'coin-toss':
        tone(3200, 2900, 0.12, 'triangle', 0.3)
        tone(4800, 4200, 0.09, 'sine', 0.22, 0.01)
        tone(6400, 5800, 0.05, 'sine', 0.15, 0.02)
        break
      case 'water-splash':
        // Liquid splash + bubble pop
        tone(520, 140, 0.18, 'sine', 0.42)
        tone(220, 60, 0.28, 'sine', 0.35, 0.02)
        tone(880, 280, 0.09, 'triangle', 0.22, 0.01)
        tone(120, 45, 0.35, 'sine', 0.25, 0.05)
        break
      case 'wish-chime':
        // Ethereal sparkling pentatonic blessing chord: C5, E5, G5, B5, D6, G6
        [523.25, 659.25, 783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => {
          tone(f, f * 0.998, 1.8 - i * 0.2, 'sine', 0.18 / (1 + i * 0.2), i * 0.08)
        })
        break
      case 'chime': [659, 880, 1175].forEach((f, i) => tone(f, f, 1.1, 'sine', 0.16, i * 0.14)); break
      case 'lose': [392, 330, 262].forEach((f, i) => tone(f, f * 0.98, 0.38, 'sine', 0.25, i * 0.16)); break
    }
  }

  private initTaraAudio(): HTMLAudioElement {
    if (!this.taraAudio) {
      const el = new window.Audio()
      el.src = './audio/green_tara.mp3?v=3.35.2'
      el.loop = true
      el.preload = 'auto'
      el.volume = 0.45
      this.taraAudio = el

      el.addEventListener('timeupdate', () => {
        if (this.currentTrack !== 'green_tara' || !this.musicOn) return
        const curTime = el.currentTime
        if (curTime < this.lastTTime - 5.0) {
          this.taraLoopCount += 1
        }
        this.lastTTime = curTime

        let inLoopCount = 0
        for (const off of TARA_OFFSETS) {
          if (curTime >= off) inLoopCount++
        }
        const totalChants = this.taraLoopCount * TARA_OFFSETS.length + inLoopCount
        const displayCount = Math.min(TARGET_TARA_CHANTS, Math.max(1, totalChants))

        if (displayCount !== this.taraChantCount) {
          this.taraChantCount = displayCount
          this.onChantProgress?.(this.taraChantCount, TARGET_TARA_CHANTS)
        }

        // When 12 chants complete (chant 12 starts at 172.5s and finishes at 186.0s before chant 13)
        if (totalChants >= TARGET_TARA_CHANTS && curTime >= 186.0) {
          this.switchToTrack('heart_sutra', 'auto_complete')
        }
      })

      try {
        const source = this.ctx.createMediaElementSource(el)
        source.connect(this.music)
      } catch {}
    }
    return this.taraAudio
  }

  private initHeartAudio(): HTMLAudioElement {
    if (!this.heartAudio) {
      const el = new window.Audio()
      el.src = './audio/heart_sutra.mp3?v=3.35.2'
      el.loop = true
      el.preload = 'auto'
      el.volume = 0.45
      this.heartAudio = el

      try {
        const source = this.ctx.createMediaElementSource(el)
        source.connect(this.music)
      } catch {}
    }
    return this.heartAudio
  }

  switchToTrack(track: MusicTrack, reason: 'auto_complete' | 'manual' | 'init' = 'manual'): void {
    if (this.currentTrack === track) return
    this.currentTrack = track

    if (track === 'heart_sutra') {
      this.play('wish-chime')
      if (this.taraAudio) {
        this.taraAudio.pause()
      }
      const ha = this.initHeartAudio()
      if (this.musicOn) {
        ha.currentTime = 0
        void ha.play().catch(() => {})
      }
      this.onTrackChange?.('heart_sutra', '般若波羅蜜多心經', reason)
    } else {
      this.taraChantCount = 0
      this.taraLoopCount = 0
      this.lastTTime = 0
      if (this.heartAudio) {
        this.heartAudio.pause()
      }
      const ta = this.initTaraAudio()
      if (this.musicOn) {
        ta.currentTime = 0
        void ta.play().catch(() => {})
      }
      this.onTrackChange?.('green_tara', '綠度母心咒', reason)
      this.onChantProgress?.(1, TARGET_TARA_CHANTS)
    }
  }

  /** Starts playing the background music (Green Tara or Heart Sutra depending on state). */
  startMusic(): void {
    this.unlock()
    this.musicOn = true
    if (this.currentTrack === 'green_tara') {
      const ta = this.initTaraAudio()
      void ta.play().catch(() => {})
      this.onChantProgress?.(Math.max(1, this.taraChantCount), TARGET_TARA_CHANTS)
      this.onTrackChange?.('green_tara', '綠度母心咒', 'init')
    } else {
      const ha = this.initHeartAudio()
      void ha.play().catch(() => {})
      this.onTrackChange?.('heart_sutra', '般若波羅蜜多心經', 'init')
    }
  }

  stopMusic(): void {
    this.musicOn = false
    if (this.taraAudio) this.taraAudio.pause()
    if (this.heartAudio) this.heartAudio.pause()
  }

  toggleMusic(): { playing: boolean; track: MusicTrack; chantCount: number } {
    if (this.musicOn) {
      this.stopMusic()
      return { playing: false, track: this.currentTrack, chantCount: this.taraChantCount }
    } else {
      this.startMusic()
      return { playing: true, track: this.currentTrack, chantCount: this.taraChantCount }
    }
  }

  getCurrentMusicState(): { playing: boolean; track: MusicTrack; chantCount: number } {
    return {
      playing: this.musicOn,
      track: this.currentTrack,
      chantCount: this.taraChantCount,
    }
  }

  isMusicPlaying(): boolean {
    return this.musicOn
  }
}
