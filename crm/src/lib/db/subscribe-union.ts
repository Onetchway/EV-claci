"use client";

/**
 * Combines several independent onSnapshot subscriptions (one per id) into a
 * single callback stream — used for a merged lead's "everywhere" panels
 * (payments, documents, EOI history, activity), where each source id's
 * subcollection/rows stay physically where they were written (see the
 * mergeLeads doc comment in db/leads.ts) but the surviving lead's detail
 * page needs to read all of them together.
 */
interface MaybeTimestamp {
  toMillis?: () => number;
}

/** Sorts combined rows from subscribeUnion by a Firestore Timestamp field — each source is already ordered, but concatenating sources means the merged list isn't globally chronological until re-sorted. */
export function sortByTimestamp<T>(rows: T[], field: keyof T, dir: "asc" | "desc" = "desc"): T[] {
  const millis = (row: T) => (row[field] as unknown as MaybeTimestamp | null | undefined)?.toMillis?.() ?? 0;
  return [...rows].sort((a, b) => (dir === "desc" ? millis(b) - millis(a) : millis(a) - millis(b)));
}

export function subscribeUnion<T>(
  ids: string[],
  subscribeOne: (id: string, cb: (rows: T[]) => void, onError?: (e: Error) => void) => () => void,
  cb: (rows: T[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const buckets = new Map<string, T[]>();
  const unsubs = ids.map((id) =>
    subscribeOne(
      id,
      (rows) => {
        buckets.set(id, rows);
        cb(ids.flatMap((i) => buckets.get(i) ?? []));
      },
      onError,
    ),
  );
  return () => unsubs.forEach((u) => u());
}
