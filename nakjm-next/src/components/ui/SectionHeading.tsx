import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SplitText } from "./SplitText";
import { Reveal } from "./Reveal";

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  /** Second phrase, set in crimson — the house headline device. */
  accent?: string;
  lede?: string;
  align?: "left" | "center";
  light?: boolean;
  className?: string;
  children?: ReactNode;
}

export function SectionHeading({
  eyebrow,
  title,
  accent,
  lede,
  align = "left",
  light = false,
  className,
  children,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "max-w-3xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      <Reveal variant="fade">
        <span className={cn("eyebrow", light && "eyebrow-light")}>{eyebrow}</span>
      </Reveal>

      <h2
        className={cn(
          "mt-7 text-headline",
          light ? "text-white" : "text-navy",
        )}
      >
        <SplitText as="span" text={title} />
        {accent ? (
          <>
            {" "}
            <span className={light ? "text-crimson-400" : "text-crimson"}>
              <SplitText as="span" text={accent} delay={0.12} />
            </span>
          </>
        ) : null}
      </h2>

      {lede ? (
        <Reveal variant="up" delay={0.1}>
          <p
            className={cn(
              "mt-7 max-w-measure text-lede",
              light ? "text-white/75" : "text-ink/60",
              align === "center" && "mx-auto",
            )}
          >
            {lede}
          </p>
        </Reveal>
      ) : null}

      {children}
    </div>
  );
}
