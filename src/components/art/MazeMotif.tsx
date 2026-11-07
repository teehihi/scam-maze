/**
 * The SCAMMAZE motif: concentric square paths with offset openings, read as
 * both a maze and a target. Purely decorative.
 */
const RINGS = [
  { size: 360, gap: [0.62, 0.7] },
  { size: 300, gap: [0.1, 0.19] },
  { size: 240, gap: [0.36, 0.45] },
  { size: 180, gap: [0.85, 0.94] },
  { size: 120, gap: [0.55, 0.65] },
  { size: 60, gap: [0.2, 0.32] },
] as const;

export function MazeMotif({ className = "", stroke = "currentColor", weight = 1.25 }: { className?: string; stroke?: string; weight?: number }) {
  return (
    <svg viewBox="-190 -190 380 380" fill="none" aria-hidden="true" className={className} focusable="false">
      {RINGS.map(({ size, gap }) => {
        const half = size / 2;
        const perimeter = size * 4;
        const open = (gap[1] - gap[0]) * perimeter;
        const solid = perimeter - open;
        return (
          <rect
            key={size}
            x={-half}
            y={-half}
            width={size}
            height={size}
            stroke={stroke}
            strokeWidth={weight}
            strokeDasharray={`${solid} ${open}`}
            strokeDashoffset={-gap[1] * perimeter}
            pathLength={perimeter}
          />
        );
      })}
      <circle r="5" fill={stroke} />
    </svg>
  );
}
