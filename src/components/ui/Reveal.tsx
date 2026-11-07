import type { CSSProperties, ReactNode } from "react";
import { useInView } from "../../hooks/useInView";

interface RevealProps {
  children: ReactNode;
  /** Delay in seconds, for staggering siblings. */
  delay?: number;
  className?: string;
  /** Also exposes data-visible so child `.draw`/`.grow-*` elements animate. */
  as?: "div" | "li" | "article" | "p" | "figure";
}

/** Fades and lifts its content in once, when it scrolls into view. */
export function Reveal({ children, delay = 0, className = "", as: Tag = "div" }: RevealProps) {
  const [ref, visible] = useInView<HTMLElement>();
  return (
    <Tag
      ref={ref as never}
      data-visible={visible}
      className={`reveal ${className}`}
      style={{ "--d": `${delay}s` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}

/**
 * Wrapper that only reports visibility (no fade of its own), so children such
 * as SVG lines can draw when the group enters the viewport.
 */
export function InViewGroup({ children, className = "" }: { children: ReactNode; className?: string }) {
  const [ref, visible] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} data-visible={visible} className={className}>
      {children}
    </div>
  );
}
