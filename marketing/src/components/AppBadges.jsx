function AppleGlyph(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M16.365 1.43c0 1.14-.462 2.15-1.217 2.95-.828.88-2.13 1.56-3.24 1.47-.12-1.12.462-2.28 1.187-3.02.812-.84 2.19-1.47 3.27-1.4zM20.14 17.3c-.5 1.16-.74 1.68-1.39 2.7-.9 1.44-2.17 3.24-3.75 3.25-1.4.02-1.76-.92-3.66-.91-1.9.01-2.3.93-3.7.92-1.58-.01-2.78-1.63-3.68-3.07C1.06 16.83.28 12.7 1.68 9.94c.98-1.94 2.75-3.17 4.67-3.19 1.5-.02 2.6.99 3.66.99 1.03 0 2.47-1.22 4.17-1.04.71.03 2.7.29 3.98 2.17-.1.07-2.38 1.39-2.35 4.14.03 3.29 2.9 4.39 2.93 4.4-.03.09-.46 1.6-1.54 2.89z" />
    </svg>
  );
}

function PlayGlyph(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M3.6 2.6a1 1 0 0 0-.6.9v17a1 1 0 0 0 .6.9l9.9-9.4-9.9-9.4z" fill="#00D2FF" />
      <path d="M13.5 12l3.5-3.3-9.9-5.6a1 1 0 0 0-.5-.15L13.5 12z" fill="#00F076" />
      <path d="M13.5 12l-6.9 9.05c.16-.02.33-.07.5-.16l9.9-5.6L13.5 12z" fill="#FF3A44" />
      <path d="M17 8.7l-3.5 3.3 3.5 3.3 4.4-2.5a1 1 0 0 0 0-1.6L17 8.7z" fill="#FFCE00" />
    </svg>
  );
}

const APP_LINKS = [
  { href: '#', Glyph: AppleGlyph, top: 'Download on the', bottom: 'App Store' },
  { href: '#', Glyph: PlayGlyph, top: 'Get it on', bottom: 'Google Play' },
];

export default function AppBadges({ dark = true, className = '' }) {
  return (
    <div className={`flex gap-3 ${className}`}>
      {APP_LINKS.map(({ href, Glyph, top, bottom }) => (
        <a
          key={bottom}
          href={href}
          aria-label={`${top} ${bottom}`}
          className={
            'flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ' +
            (dark ? 'border-white/15 hover:border-lime' : 'border-line hover:border-brand-500')
          }
        >
          <Glyph className={dark ? 'h-5 w-5 text-white' : 'h-5 w-5 text-ink'} />
          <span className="leading-tight">
            <span className={dark ? 'block text-[9px] text-white/55' : 'block text-[9px] text-muted'}>{top}</span>
            <span className={dark ? 'block text-xs font-semibold text-white' : 'block text-xs font-semibold text-ink'}>{bottom}</span>
          </span>
        </a>
      ))}
    </div>
  );
}
