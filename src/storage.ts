/** The part of EmDash's collection contract needed for conflict-safe updates. */
export interface VersionedCollection<T> {
  getVersioned(id: string): Promise<{ value: T; revision: string } | null>;
  compareAndSet(id: string, revision: string | null, value: T): Promise<{ applied: boolean }>;
}

export class MissingRecord extends Error {}
export class WriteConflict extends Error {}

/** Recalculate against the newest value to avoid losing concurrent task updates. */
export async function updateRecord<T>(collection: VersionedCollection<T>, id: string, change: (value: T) => T): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await collection.getVersioned(id);
    if (!current) throw new MissingRecord();
    const next = change(current.value);
    if ((await collection.compareAndSet(id, current.revision, next)).applied) return next;
  }
  throw new WriteConflict();
}
