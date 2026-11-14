export function getNoteTimestampMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts.seconds === 'number') {
    return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1e6);
  }
  if (typeof ts === 'number') return ts;
  if (ts instanceof Date) return ts.getTime();
  return 0;
}

export function computeNoteNumbersMap(
  notes: Array<{ id: string; title?: string; createdAt?: any; updatedAt?: any }>
): Map<string, number> {
  const validNotes = (notes || []).filter(
    (n) => n && n.id && n.title !== '__neural_chat_history__'
  );

  const sorted = [...validNotes].sort((a, b) => {
    const aTime = getNoteTimestampMs(a.createdAt) || getNoteTimestampMs(a.updatedAt);
    const bTime = getNoteTimestampMs(b.createdAt) || getNoteTimestampMs(b.updatedAt);
    if (aTime !== bTime) return aTime - bTime;
    return a.id.localeCompare(b.id);
  });

  const map = new Map<string, number>();
  sorted.forEach((note, index) => {
    map.set(note.id, index + 1);
  });
  return map;
}
