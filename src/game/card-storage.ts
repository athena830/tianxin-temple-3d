import type { CardTopic, ThreeCardSpread } from './card-engine'

const STORAGE_KEY = 'tianxin.card-notes.v1'
const MAX_NOTES = 40
const MAX_NOTE_LENGTH = 500
const VALID_TOPICS = new Set<string>(['inner-state', 'relationship', 'work', 'next-step'])

export type CardNote = { id: string; createdAt: number; topic: CardTopic; cards: string[]; note: string }

function isValidCardNote(item: unknown): item is CardNote {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false
  const rec = item as Record<string, unknown>
  return (
    typeof rec.id === 'string' &&
    rec.id.length > 0 &&
    rec.id.length <= 80 &&
    typeof rec.createdAt === 'number' &&
    Number.isFinite(rec.createdAt) &&
    typeof rec.topic === 'string' &&
    VALID_TOPICS.has(rec.topic) &&
    Array.isArray(rec.cards) &&
    rec.cards.length <= 10 &&
    rec.cards.every(c => typeof c === 'string' && c.length <= 60) &&
    typeof rec.note === 'string'
  )
}

export function listCardNotes(): CardNote[] {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    const notes: unknown = value ? JSON.parse(value) : []
    if (!Array.isArray(notes)) return []
    return notes
      .filter(isValidCardNote)
      .slice(0, MAX_NOTES)
      .map(n => ({ ...n, note: n.note.slice(0, MAX_NOTE_LENGTH) }))
  } catch { return [] }
}

export function saveCardNote(spread: ThreeCardSpread, note: string): CardNote[] {
  const trimmed = typeof note === 'string' ? note.trim().slice(0, MAX_NOTE_LENGTH) : ''
  if (!trimmed) return listCardNotes()
  const next = [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: Date.now(), topic: spread.topic, cards: spread.cards.map(card => String(card.name).slice(0, 60)), note: trimmed }, ...listCardNotes()].slice(0, MAX_NOTES)
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* storage may be disabled */ }
  return next
}

export function clearCardNotes(): void {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* storage may be disabled */ }
}
