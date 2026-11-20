import type { CardTopic, ThreeCardSpread } from './card-engine'

const STORAGE_KEY = 'tianxin.card-notes.v1'
const MAX_NOTES = 40

export type CardNote = { id: string; createdAt: number; topic: CardTopic; cards: string[]; note: string }

export function listCardNotes(): CardNote[] {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    const notes = value ? JSON.parse(value) : []
    return Array.isArray(notes) ? notes : []
  } catch { return [] }
}

export function saveCardNote(spread: ThreeCardSpread, note: string): CardNote[] {
  const trimmed = note.trim()
  if (!trimmed) return listCardNotes()
  const next = [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: Date.now(), topic: spread.topic, cards: spread.cards.map(card => card.name), note: trimmed }, ...listCardNotes()].slice(0, MAX_NOTES)
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* storage may be disabled */ }
  return next
}

export function clearCardNotes(): void {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* storage may be disabled */ }
}
