/**
 * @-mentions in notes and remarks — Odoo-chatter style tagging.
 *
 * Kept deliberately simple: a mention is "@" followed by a user's full name
 * with spaces collapsed to nothing (so "@AnandKumar" matches "Anand Kumar").
 * That avoids needing a rich-text editor just to tag a colleague.
 */

export interface Mentionable {
  uid: string;
  name: string;
  email: string;
}

/** Every user mentioned in `text`, matched against the given roster. */
export function findMentions(text: string, users: Mentionable[]): Mentionable[] {
  const matches = text.match(/@([A-Za-z][\w'-]*(?:[A-Za-z][\w'-]*)*)/g) ?? [];
  if (matches.length === 0) return [];

  const byKey = new Map(users.map((u) => [u.name.replace(/\s+/g, "").toLowerCase(), u]));
  const found = new Map<string, Mentionable>();

  for (const raw of matches) {
    const key = raw.slice(1).toLowerCase();
    const user = byKey.get(key);
    if (user) found.set(user.uid, user);
  }
  return [...found.values()];
}

/** Splits text into plain/mention segments so the UI can render @mentions as chips. */
export function splitMentions(
  text: string,
  users: Mentionable[],
): { text: string; mention?: Mentionable }[] {
  if (users.length === 0) return [{ text }];
  const names = [...users].sort((a, b) => b.name.length - a.name.length);
  const pattern = new RegExp(
    `@(${names.map((u) => u.name.replace(/\s+/g, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
    "g",
  );

  const parts: { text: string; mention?: Mentionable }[] = [];
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push({ text: text.slice(last, idx) });
    const key = m[1]!.toLowerCase();
    const user = names.find((u) => u.name.replace(/\s+/g, "").toLowerCase() === key);
    parts.push({ text: m[0], mention: user });
    last = idx + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
