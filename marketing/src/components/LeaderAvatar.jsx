/** Initials avatar placeholder — used until real headshot photo files are supplied. */
export default function LeaderAvatar({ name }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="flex h-56 w-full items-center justify-center bg-gradient-to-br from-brand-700 to-ink">
      <span className="font-display text-4xl font-bold text-white/90">{initials}</span>
    </div>
  );
}
