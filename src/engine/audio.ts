/**
 * Web Audio mixer with music and SFX buses. Browsers only allow audio after a user gesture, so
 * call `unlock()` from the first click/key press (the title screen does this).
 *
 * 全域 AudioManager 模組：
 * - 進入市集（market）在 1.2 秒內將背景音樂（BGM）音量平滑淡出至 0，完成後 pause()。
 * - 離開市集（temple）檢查 localStorage 的 userMuted 狀態；若為 false 則自動於 1.2 秒內淡入至預設音量 0.25。
 * - 僅暫停背景音樂，不影響點擊音效與互動語音。
 */
export type Sfx = 'pickup' | 'jump' | 'land' | 'hurt' | 'ui' | 'win' | 'lose' | 'dash' | 'bell' | 'woodfish' | 'coin' | 'chime' | 'drum' | 'coin-toss' | 'water-splash' | 'wish-chime'

export type MusicTrack = 'green_tara' | 'heart_sutra'

export const TARGET_TARA_CHANTS = 12
export const DEFAULT_MUSIC_VOLUME = 0.25
export const USER_MUTED_STORAGE_KEY = 'userMuted'

/** 讀取使用者是否曾主動點擊靜音 */
export function getUserMuted(): boolean {
  try {
    return localStorage.getItem(USER_MUTED_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/** 記錄使用者是否手動靜音 */
export function setUserMuted(muted: boolean): void {
  try {
    localStorage.setItem(USER_MUTED_STORAGE_KEY, muted ? 'true' : 'false')
  } catch {}
}

const TARA_OFFSETS = [24.0, 37.5, 51.0, 64.5, 78.0, 91.5, 105.0, 118.5, 132.0, 145.5, 159.0, 172.5, 186.0, 199.5]

export class Audio {
  readonly ctx: AudioContext
  private master: GainNode
  private music: GainNode
  private sfx: GainNode
  private musicOn = false
  private currentTrack: MusicTrack = 'green_tara'
  private taraChantCount = 0
  private taraLoopCount = 0
  private lastTTime = 0
  private taraAudio?: HTMLAudioElement
  private buffers = new Map<string, AudioBuffer>()
  private meditationNoise?: AudioBufferSourceNode
  private meditationGain?: GainNode

  // 淡入淡出動畫與狀態管理
  private isFadingOut = false
  private isFadingIn = false
  private fadeRaf?: number
  private isAutoMarketPaused = false
  private unlocked = false

  get autoMarketPaused(): boolean {
    return this.isAutoMarketPaused
  }

  onChantProgress?: (current: number, total: number) => void
  onTrackChange?: (track: MusicTrack, title: string, reason?: 'auto_complete' | 'manual' | 'init') => void
  onMusicStateChange?: (playing: boolean, chantCount: number) => void

  constructor() {
    this.ctx = new AudioContext()
    this.master = this.ctx.createGain()
    this.music = this.ctx.createGain()
    this.music.gain.value = DEFAULT_MUSIC_VOLUME
    this.sfx = this.ctx.createGain()
    this.music.connect(this.master)
    this.sfx.connect(this.master)
    this.master.connect(this.ctx.destination)
  }

  unlock(): void {
    this.unlocked = true
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  /** Volumes in 0..1. */
  setVolumes(music: number, sfx: number, muted = false): void {
    const t = this.ctx.currentTime
    const targetMusicVol = muted ? 0 : music * DEFAULT_MUSIC_VOLUME
    this.music.gain.setTargetAtTime(targetMusicVol, t, 0.05)
    this.sfx.gain.setTargetAtTime(muted ? 0 : sfx * 0.8, t, 0.05)
    if (this.taraAudio) this.taraAudio.volume = targetMusicVol
  }

  /**
   * 進入市集（market 場景）：
   * 在 1.2 秒內將背景音樂（BGM）音量平滑淡出至 0，淡出完成後執行 pause() 暫停播放。
   * 僅暫停背景音樂，不可靜音市集內的按鈕點擊音效、語音或影片元件。
   */
  fadeMusicOut(durationSeconds = 1.2): Promise<void> {
    return new Promise(resolve => {
      if (!this.musicOn && !this.taraAudio) {
        this.isAutoMarketPaused = true
        resolve()
        return
      }
      this.isFadingOut = true
      this.isFadingIn = false
      if (this.fadeRaf) cancelAnimationFrame(this.fadeRaf)

      const startVol = this.taraAudio ? this.taraAudio.volume : (this.music.gain.value || DEFAULT_MUSIC_VOLUME)
      const startTime = performance.now()
      const durationMs = Math.max(100, durationSeconds * 1000)

      // Web Audio GainNode 平滑降音量
      try {
        const t = this.ctx.currentTime
        this.music.gain.cancelScheduledValues(t)
        this.music.gain.setValueAtTime(this.music.gain.value, t)
        this.music.gain.linearRampToValueAtTime(0.0001, t + durationSeconds)
      } catch {}

      const step = () => {
        if (!this.isFadingOut) return
        const elapsed = performance.now() - startTime
        const progress = Math.min(1, elapsed / durationMs)
        const currentVol = Math.max(0, startVol * (1 - progress))
        if (this.taraAudio) this.taraAudio.volume = currentVol

        if (progress < 1) {
          this.fadeRaf = requestAnimationFrame(step)
        } else {
          if (this.taraAudio) {
            this.taraAudio.volume = 0
            this.taraAudio.pause()
          }
          try {
            this.music.gain.setValueAtTime(0, this.ctx.currentTime)
          } catch {}
          this.musicOn = false
          this.isAutoMarketPaused = true
          this.isFadingOut = false
          this.onMusicStateChange?.(false, this.taraChantCount)
          resolve()
        }
      }
      this.fadeRaf = requestAnimationFrame(step)
    })
  }

  /**
   * 離開市集（返回大殿或廣場）：
   * 檢查使用者是否曾「手動點擊靜音」（從 localStorage 讀取 userMuted 狀態）。
   * 若 userMuted 為 false，則自動恢復播放 BGM，並在 1.2 秒內淡入至預設音量（0.25）。
   * 若 userMuted 為 true，則維持靜音，不要幫使用者強制開啟。
   */
  fadeMusicIn(targetVolume = DEFAULT_MUSIC_VOLUME, durationSeconds = 1.2): Promise<void> {
    return new Promise(resolve => {
      // 檢查使用者是否曾手動點擊靜音
      if (getUserMuted()) {
        this.isAutoMarketPaused = false
        resolve()
        return
      }

      if (!this.unlocked) {
        // 遵循瀏覽器自動播放政策，在使用者尚未進行首次互動前不強制播放
        this.isAutoMarketPaused = false
        resolve()
        return
      }

      this.isFadingIn = true
      this.isFadingOut = false
      if (this.fadeRaf) cancelAnimationFrame(this.fadeRaf)

      const ta = this.initTaraAudio()
      ta.volume = 0
      try {
        const t = this.ctx.currentTime
        this.music.gain.cancelScheduledValues(t)
        this.music.gain.setValueAtTime(0, t)
        this.music.gain.linearRampToValueAtTime(targetVolume, t + durationSeconds)
      } catch {}

      void ta.play().catch(() => {})
      this.musicOn = true
      this.isAutoMarketPaused = false
      this.onMusicStateChange?.(true, this.taraChantCount)

      const startTime = performance.now()
      const durationMs = Math.max(100, durationSeconds * 1000)

      const step = () => {
        if (!this.isFadingIn) return
        const elapsed = performance.now() - startTime
        const progress = Math.min(1, elapsed / durationMs)
        const currentVol = targetVolume * progress
        if (this.taraAudio) this.taraAudio.volume = currentVol

        if (progress < 1) {
          this.fadeRaf = requestAnimationFrame(step)
        } else {
          if (this.taraAudio) this.taraAudio.volume = targetVolume
          this.isFadingIn = false
          resolve()
        }
      }
      this.fadeRaf = requestAnimationFrame(step)
    })
  }

  /**
   * 場景進入市集統一調用
   */
  async onEnterMarket(): Promise<void> {
    if (this.musicOn) {
      await this.fadeMusicOut(1.2)
    } else {
      this.isAutoMarketPaused = true
    }
  }

  /**
   * 場景離開市集統一調用
   */
  async onLeaveMarket(): Promise<void> {
    if (getUserMuted()) {
      // 若曾手動點擊靜音，維持靜音
      this.isAutoMarketPaused = false
      return
    }
    await this.fadeMusicIn(DEFAULT_MUSIC_VOLUME, 1.2)
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

  /** User-initiated only: a soft filtered noise bed for the 60-second meditation. */
  toggleMeditationAmbient(): boolean {
    this.unlock()
    if (this.meditationNoise) {
      this.meditationNoise.stop()
      this.meditationNoise.disconnect()
      this.meditationGain?.disconnect()
      this.meditationNoise = undefined
      this.meditationGain = undefined
      return false
    }
    if (this.ctx.state !== 'running') return false
    const seconds = 2
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate)
    const samples = buffer.getChannelData(0)
    for (let i = 0; i < samples.length; i += 1) samples[i] = (Math.random() * 2 - 1) * 0.28
    const source = this.ctx.createBufferSource()
    const filter = this.ctx.createBiquadFilter()
    const gain = this.ctx.createGain()
    source.buffer = buffer
    source.loop = true
    filter.type = 'lowpass'
    filter.frequency.value = 620
    gain.gain.value = 0.045
    source.connect(filter).connect(gain).connect(this.music)
    source.start()
    this.meditationNoise = source
    this.meditationGain = gain
    return true
  }

  stopMeditationAmbient(): void {
    if (!this.meditationNoise) return
    this.meditationNoise.stop()
    this.meditationNoise.disconnect()
    this.meditationGain?.disconnect()
    this.meditationNoise = undefined
    this.meditationGain = undefined
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
        tone(520, 140, 0.18, 'sine', 0.42)
        tone(220, 60, 0.28, 'sine', 0.35, 0.02)
        tone(880, 280, 0.09, 'triangle', 0.22, 0.01)
        tone(120, 45, 0.35, 'sine', 0.25, 0.05)
        break
      case 'wish-chime':
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
      el.src = './audio/green_tara.mp3?v=3.42.0'
      el.loop = true
      el.preload = 'none'
      el.volume = DEFAULT_MUSIC_VOLUME
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
        const displayCount = Math.max(1, ((totalChants - 1) % TARGET_TARA_CHANTS) + 1)

        if (displayCount !== this.taraChantCount) {
          this.taraChantCount = displayCount
          this.onChantProgress?.(this.taraChantCount, TARGET_TARA_CHANTS)
        }
      })

      try {
        const source = this.ctx.createMediaElementSource(el)
        source.connect(this.music)
      } catch {}
    }
    return this.taraAudio
  }

  switchToTrack(_track: MusicTrack, reason: 'auto_complete' | 'manual' | 'init' = 'manual'): void {
    this.currentTrack = 'green_tara'
    this.taraChantCount = 0
    this.taraLoopCount = 0
    this.lastTTime = 0
    const ta = this.initTaraAudio()
    if (this.musicOn) {
      ta.currentTime = 0
      void ta.play().catch(() => {})
    }
    this.onTrackChange?.('green_tara', '綠度母心咒', reason)
    this.onChantProgress?.(1, TARGET_TARA_CHANTS)
  }

  /** Starts playing the background music (Green Tara). */
  startMusic(): void {
    this.unlock()
    this.musicOn = true
    this.isAutoMarketPaused = false
    const ta = this.initTaraAudio()
    ta.volume = DEFAULT_MUSIC_VOLUME
    try {
      this.music.gain.setValueAtTime(DEFAULT_MUSIC_VOLUME, this.ctx.currentTime)
    } catch {}
    void ta.play().catch(() => {})
    this.onChantProgress?.(Math.max(1, this.taraChantCount), TARGET_TARA_CHANTS)
    this.onTrackChange?.('green_tara', '綠度母心咒', 'init')
    this.onMusicStateChange?.(true, this.taraChantCount)
  }

  stopMusic(): void {
    this.musicOn = false
    if (this.taraAudio) this.taraAudio.pause()
    this.onMusicStateChange?.(false, this.taraChantCount)
  }

  /** 手動點擊音樂開關按鈕（允許在大殿或市集中手動開關） */
  toggleMusic(): { playing: boolean; track: MusicTrack; chantCount: number } {
    if (this.musicOn) {
      setUserMuted(true)
      this.stopMusic()
      return { playing: false, track: this.currentTrack, chantCount: this.taraChantCount }
    } else {
      setUserMuted(false)
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

export { Audio as AudioManager }

