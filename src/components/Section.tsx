import type { ReactNode } from "react";

interface SectionProps {
  id: string;
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
}

export function Section({ id, eyebrow, title, intro, children }: SectionProps) {
  return (
    <section id={id} className="scroll-mt-20 px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-pumpkin">{eyebrow}</p>
        <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {title}
        </h2>
        {intro && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-violet-200/75">{intro}</p>}
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}
