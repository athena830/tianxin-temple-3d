/**
 * Runtime telemetry for frame times, P95, and long frame causes (VER 3.75.1).
 */
export type LongFrameTag = 'stage_load' | 'zone_light' | 'occlusion' | 'renderer' | 'physics'

export interface LongFrameRecord {
  frame: number
  durationMs: number
  tags: LongFrameTag[]
  timestamp: number
}

export interface TelemetryStats {
  frameCount: number
  avgMs: number
  p95Ms: number
  maxFrameMs: number
  consecutiveLongFrames: number
  maxConsecutiveLongFrames: number
  longFrameCount: number
  recentLongFrames: LongFrameRecord[]
}

export class GameTelemetry {
  readonly allFrames: number[] = []
  private frameCount = 0
  private maxFrameMs = 0
  private consecutiveLongFrames = 0
  private maxConsecutiveLongFrames = 0
  private longFrameCount = 0
  readonly longFrames: LongFrameRecord[] = []
  private readonly activeTags = new Set<LongFrameTag>()

  private readonly tagThresholds: Record<LongFrameTag, number> = {
    stage_load: 3.0,
    zone_light: 0,
    occlusion: 4.0,
    renderer: 25.0,
    physics: 8.0,
  }

  markTag(tag: LongFrameTag, durationMs?: number): void {
    if (durationMs === undefined) {
      this.activeTags.add(tag)
    } else {
      const threshold = this.tagThresholds[tag] ?? 0
      if (durationMs >= threshold) {
        this.activeTags.add(tag)
      }
    }
  }

  reset(): void {
    this.allFrames.length = 0
    this.frameCount = 0
    this.maxFrameMs = 0
    this.consecutiveLongFrames = 0
    this.maxConsecutiveLongFrames = 0
    this.longFrameCount = 0
    this.longFrames.length = 0
    this.activeTags.clear()
  }

  recordFrame(durationMs: number): void {
    this.frameCount++
    this.allFrames.push(durationMs)

    if (durationMs > this.maxFrameMs) {
      this.maxFrameMs = Number(durationMs.toFixed(2))
    }

    if (durationMs > 100) {
      this.longFrameCount++
    }

    if (durationMs > 50) {
      this.consecutiveLongFrames++
      if (this.consecutiveLongFrames > this.maxConsecutiveLongFrames) {
        this.maxConsecutiveLongFrames = this.consecutiveLongFrames
      }
      this.longFrames.push({
        frame: this.frameCount,
        durationMs: Number(durationMs.toFixed(2)),
        tags: Array.from(this.activeTags),
        timestamp: Math.round(performance.now()),
      })
      if (this.longFrames.length > 100) this.longFrames.shift()
    } else {
      this.consecutiveLongFrames = 0
    }

    this.activeTags.clear()
  }

  getStats(): TelemetryStats {
    if (this.allFrames.length === 0) {
      return {
        frameCount: 0,
        avgMs: 0,
        p95Ms: 0,
        maxFrameMs: 0,
        consecutiveLongFrames: 0,
        maxConsecutiveLongFrames: 0,
        longFrameCount: 0,
        recentLongFrames: [],
      }
    }
    const samples = [...this.allFrames].sort((a, b) => a - b)
    const avg = samples.reduce((acc, v) => acc + v, 0) / samples.length
    const p95 = samples[Math.floor(samples.length * 0.95)]
    return {
      frameCount: this.frameCount,
      avgMs: Number(avg.toFixed(2)),
      p95Ms: Number(p95.toFixed(2)),
      maxFrameMs: this.maxFrameMs,
      consecutiveLongFrames: this.consecutiveLongFrames,
      maxConsecutiveLongFrames: this.maxConsecutiveLongFrames,
      longFrameCount: this.longFrameCount,
      recentLongFrames: this.longFrames.slice(-20),
    }
  }
}
