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
  recentLongFrames: LongFrameRecord[]
}

export class GameTelemetry {
  private readonly bufferSize = 120
  private readonly frameBuffer: number[] = new Array(120).fill(16.6)
  private bufferIdx = 0
  private frameCount = 0
  private maxFrameMs = 0
  private consecutiveLongFrames = 0
  private maxConsecutiveLongFrames = 0
  readonly longFrames: LongFrameRecord[] = []
  private activeTags = new Set<LongFrameTag>()

  markTag(tag: LongFrameTag, _durationMs?: number): void {
    this.activeTags.add(tag)
  }

  reset(): void {
    this.frameBuffer.fill(16.6)
    this.bufferIdx = 0
    this.frameCount = 0
    this.maxFrameMs = 0
    this.consecutiveLongFrames = 0
    this.maxConsecutiveLongFrames = 0
    this.longFrames.length = 0
    this.activeTags.clear()
  }

  recordFrame(durationMs: number): void {
    this.frameCount++
    this.frameBuffer[this.bufferIdx] = durationMs
    this.bufferIdx = (this.bufferIdx + 1) % this.bufferSize

    if (durationMs > this.maxFrameMs) {
      this.maxFrameMs = Number(durationMs.toFixed(2))
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
      if (this.longFrames.length > 50) this.longFrames.shift()
    } else {
      this.consecutiveLongFrames = 0
    }

    this.activeTags.clear()
  }

  getStats(): TelemetryStats {
    const samples = [...this.frameBuffer].sort((a, b) => a - b)
    const avg = samples.reduce((acc, v) => acc + v, 0) / samples.length
    const p95 = samples[Math.floor(samples.length * 0.95)]
    return {
      frameCount: this.frameCount,
      avgMs: Number(avg.toFixed(2)),
      p95Ms: Number(p95.toFixed(2)),
      maxFrameMs: this.maxFrameMs,
      consecutiveLongFrames: this.consecutiveLongFrames,
      maxConsecutiveLongFrames: this.maxConsecutiveLongFrames,
      recentLongFrames: this.longFrames.slice(-10),
    }
  }
}

