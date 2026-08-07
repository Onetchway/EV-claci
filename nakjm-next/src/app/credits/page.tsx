import { buildMetadata } from "@/lib/seo";
import { LegalLayout } from "@/components/layout/LegalLayout";
import { imageCredits } from "@/lib/data/credits";

export const metadata = buildMetadata({
  title: "Image Credits",
  description:
    "Attribution for the licensed photography used on the NAKJM Infrastructure website.",
  path: "/credits/",
  noIndex: true,
});

export default function CreditsPage() {
  return (
    <LegalLayout title="Image Credits" updated="7 August 2026">
      <p>
        The photographs on this site are licensed stock from Wikimedia Commons.
        They illustrate the categories of work we describe — they are not
        photographs of NAKJM projects, and no client site, installation or
        completed work shown here should be read as ours.
      </p>
      <p>
        Each image is used under the licence named below. Where a licence
        requires attribution, the photographer and licence are credited here and
        the original is linked.
      </p>

      <h2>Photography</h2>
      <ul>
        {imageCredits.map((c) => (
          <li key={c.file}>
            <strong>{c.subject}</strong> — &ldquo;
            <a href={c.sourceUrl} rel="noopener noreferrer nofollow" target="_blank">
              {c.title}
            </a>
            &rdquo; by {c.author}, licensed under{" "}
            <a href={c.licenceUrl} rel="noopener noreferrer nofollow" target="_blank">
              {c.licence}
            </a>
            . Cropped and resized for this site.
          </li>
        ))}
      </ul>

      <h2>Client marks</h2>
      <p>
        Partner and client names and logos shown on this site remain the
        property of their respective owners and are used to identify the
        organisations we have worked with. No endorsement is implied.
      </p>
    </LegalLayout>
  );
}
