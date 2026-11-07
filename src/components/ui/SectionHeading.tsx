import type { ReactNode } from "react";
import { Reveal } from "./Reveal";

interface SectionHeadingProps {
  /** Small uppercase system label, e.g. "03 · The signal". */
  label: string;
  /** Headline lines; each string becomes its own line. */
  lines: string[];
  intro?: ReactNode;
  id?: string;
  className?: string;
}

/** Shared editorial heading: system label, big display headline, short intro. */
export function SectionHeading({ label, lines, intro, id, className = "" }: SectionHeadingProps) {
  return (
    <Reveal className={className}>
      <p className="label flex items-center gap-3 text-lavender">
        <span aria-hidden="true" className="h-px w-8 bg-lavender/60" />
        {label}
      </p>
      <h2 id={id} className="display mt-5 text-[clamp(2.25rem,6vw,4.75rem)]">
        {lines.map((line, i) => (
          <span key={line} className={`block ${i > 0 ? "text-lavender" : ""}`}>
            {line}
          </span>
        ))}
      </h2>
      {intro && <p className="mt-6 max-w-xl text-base leading-relaxed text-mist sm:text-lg">{intro}</p>}
    </Reveal>
  );
}
