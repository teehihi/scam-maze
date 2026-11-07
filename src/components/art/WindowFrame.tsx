import type { ReactNode } from "react";

interface WindowFrameProps {
  title: string;
  children: ReactNode;
  className?: string;
  /** Tone of the title-bar accent dot. */
  accent?: string;
}

/** Fictional application window used by every environment preview. */
export function WindowFrame({ title, children, className = "", accent = "bg-lavender" }: WindowFrameProps) {
  return (
    <div className={`overflow-hidden border border-hairline bg-navy shadow-[0_24px_60px_-20px_rgb(0_0_0/0.6)] ${className}`}>
      <div className="flex h-9 items-center gap-2 border-b border-hairline bg-navy-2 px-3">
        <span aria-hidden="true" className="size-2 bg-hairline" />
        <span aria-hidden="true" className="size-2 bg-hairline" />
        <span aria-hidden="true" className={`size-2 ${accent}`} />
        <span className="label ml-2 truncate text-[10px] text-mist">{title}</span>
      </div>
      {children}
    </div>
  );
}
