import { describe, expect, it, beforeEach, vi } from 'vitest'
import { AudioManager, getUserMuted, setUserMuted, USER_MUTED_STORAGE_KEY } from '../src/engine/audio'

describe('AudioManager module', () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    const mockStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
    }
    vi.stubGlobal('localStorage', mockStorage)

    // Mock Web Audio Context
    class MockGainNode {
      gain = {
        value: 0.25,
        setTargetAtTime: vi.fn(),
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
      }
      connect = vi.fn()
      disconnect = vi.fn()
    }

    class MockAudioContext {
      currentTime = 0
      state = 'running'
      destination = {}
      createGain = () => new MockGainNode()
      resume = vi.fn().mockResolvedValue(undefined)
    }

    vi.stubGlobal('AudioContext', MockAudioContext)

    class MockAudioElement {
      volume = 0.25
      loop = false
      src = ''
      currentTime = 0
      play = vi.fn().mockResolvedValue(undefined)
      pause = vi.fn()
      addEventListener = vi.fn()
    }
    vi.stubGlobal('Audio', MockAudioElement)
    vi.stubGlobal('window', { Audio: MockAudioElement })
  })

  it('manages userMuted in localStorage correctly', () => {
    expect(getUserMuted()).toBe(false)
    setUserMuted(true)
    expect(getUserMuted()).toBe(true)
    expect(localStorage.getItem(USER_MUTED_STORAGE_KEY)).toBe('true')
    setUserMuted(false)
    expect(getUserMuted()).toBe(false)
  })

  it('initializes with expected audio state and aliases', () => {
    const mgr = new AudioManager()
    expect(mgr).toBeDefined()
    expect(typeof mgr.onEnterMarket).toBe('function')
    expect(typeof mgr.onLeaveMarket).toBe('function')
    expect(typeof mgr.fadeMusicOut).toBe('function')
    expect(typeof mgr.fadeMusicIn).toBe('function')
  })

  it('leave market respects userMuted = true and does not auto-play', async () => {
    const mgr = new AudioManager()
    setUserMuted(true)
    const fadeInSpy = vi.spyOn(mgr, 'fadeMusicIn')

    await mgr.onLeaveMarket()

    // When userMuted is true, fadeMusicIn is not called and music is not playing
    expect(fadeInSpy).not.toHaveBeenCalled()
    expect(mgr.isMusicPlaying()).toBe(false)
  })

  it('leave market resumes music when userMuted is false', async () => {
    const mgr = new AudioManager()
    setUserMuted(false)
    const fadeInSpy = vi.spyOn(mgr, 'fadeMusicIn').mockResolvedValue()

    await mgr.onLeaveMarket()
    expect(fadeInSpy).toHaveBeenCalledWith(0.25, 1.2)
  })

  it('entering market triggers fadeMusicOut with 1.2 seconds duration when music was on', async () => {
    const mgr = new AudioManager()
    const fadeOutSpy = vi.spyOn(mgr, 'fadeMusicOut').mockResolvedValue()

    mgr.startMusic()
    await mgr.onEnterMarket()

    expect(fadeOutSpy).toHaveBeenCalledWith(1.2)
  })

  it('toggleMusic switches between mute and play while updating userMuted in storage', () => {
    const mgr = new AudioManager()
    // First, start music
    mgr.startMusic()
    expect(mgr.isMusicPlaying()).toBe(true)

    // Manual mute via toggle
    const mutedState = mgr.toggleMusic()
    expect(mutedState.playing).toBe(false)
    expect(getUserMuted()).toBe(true)

    // Manual un-mute via toggle
    const playState = mgr.toggleMusic()
    expect(playState.playing).toBe(true)
    expect(getUserMuted()).toBe(false)
  })
})
