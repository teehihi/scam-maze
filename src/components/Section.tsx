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
    <section id={id} className="scroll-mt-16 border-t border-line px-5 py-20 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <p className="font-mono text-xs font-medium uppercase tracking-widest text-accent-ink">{eyebrow}</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
        {intro && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{intro}</p>}
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}

/** Small flat square used as a list marker instead of emoji. */
export function Marker({ className = "bg-ink" }: { className?: string }) {
  return <span aria-hidden="true" className={`mt-2 size-2 shrink-0 ${className}`} />;
}
