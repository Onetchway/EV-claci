import type { ReactNode } from "react";

/**
 * Long-form legal pages: a single measured column, generous leading, and
 * typographic rules rather than boxes.
 */
export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <article className="bg-white pb-section pt-44">
      <div className="shell">
        <header className="max-w-measure border-b border-navy/10 pb-12">
          <span className="eyebrow">Legal</span>
          <h1 className="mt-7 text-headline text-navy">{title}</h1>
          <p className="mt-6 text-sm text-ink/40">Last updated {updated}</p>
        </header>

        <div
          className="
            mt-14 max-w-measure
            [&_h2]:mt-14 [&_h2]:text-xl [&_h2]:font-medium [&_h2]:tracking-tight [&_h2]:text-navy
            [&_p]:mt-5 [&_p]:leading-[1.75] [&_p]:text-ink/60
            [&_a]:text-crimson [&_a]:underline [&_a]:underline-offset-4
          "
        >
          {children}
        </div>
      </div>
    </article>
  );
}
