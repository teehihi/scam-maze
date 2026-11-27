// Chapter HUD of "LAST SUBMISSION: 72 GIỜ CUỐI", in the style of the neighborhood HUD (prologue):
// the map disc with three status bars on a ring around it (digital security, support network,
// fatigue), the clock beside it, and the settings button and cash in the top-right corner.
// Presentation only: it reads `ChapterState.resources` and never writes. Every value is also
// available as text (hover or focus a bar; screen readers get a list), so no status depends on
// color alone. Evidence is not shown here (it will be items in an inventory later).
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Moon, Settings, ShieldCheck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useGameLocale } from "../../../i18n";
import { simulatedClock, type ChapterResources } from "../../../game/narrative/resources";
import type { FatigueLevel } from "../../../game/narrative/fatigue";
import { NoSignalMinimap } from "../../prologue/Minimap";
import { SaigonMinimap, type SaigonRadarData } from "./SaigonMinimap";
import { KEYCAP, KEYCAP_HOVER, MENU_BUTTON, SHADOW, stop } from "../../prologue/PrologueHud";
import { formatSpan, type Tx } from "../device/deviceFormat";

const WEEKDAY_KEYS = [
  "hud.status.weekday.1",
  "hud.status.weekday.2",
  "hud.status.weekday.3",
  "hud.status.weekday.4",
  "hud.status.weekday.5",
  "hud.status.weekday.6",
  "hud.status.weekday.7",
] as const;

const CASH_ICON = "/assets/ui/hud/cashicon.webp";
const ICON_TASK = "/assets/ui/hud/task.webp";
const ICON_DOT = "/assets/ui/hud/dot.webp";
/** Height of the top-right row: the cash icon and the settings key cap (px). */
const ROW_PX = 32;

/** Map disc diameter (px), as in the neighborhood. */
const DISC = 148;
/** Space around the disc for the ring (px). */
const PAD = 16;
const SIZE = DISC + PAD * 2;
const CENTER = SIZE / 2;
const RING_R = DISC / 2 + 9;
/** Each bar covers this many degrees; the rest of its third is the gap that holds its icon. */
const SPAN = 94;
/** Angle of the first gap: the icons sit upper right, bottom and upper left, so the lower-left corner stays free for the task button. */
const RING_OFFSET = 60;
/** Width of the clock column beside the map (px). */
const CLOCK_COLUMN_PX = 208;
/** The task button sits on the ring box's lower-left corner, clear of the ring icons. */
const TASK_BUTTON_POSITION: React.CSSProperties = { left: -30, top: SIZE - 24 };

const COLOR = {
  track: "rgba(243,239,228,0.16)",
  security: "#8ec5ff",
  support: "#6fe0a8",
  rested: "#c9bbf7",
  tired: "#b9a5f5",
  low: "#f07a6a",
};

type StatId = "security" | "support" | "fatigue";

interface Stat {
  id: StatId;
  icon: LucideIcon;
  /** 0..100. */
  value: number;
  color: string;
  label: string;
  /** Value as text, for example "50%" or "Tired, 60%". */
  valueText: string;
  description: string;
}

/** A point on the ring: 0 degrees is the top, angles grow clockwise. */
function polar(radius: number, degrees: number): [number, number] {
  const a = (degrees * Math.PI) / 180;
  return [CENTER + radius * Math.sin(a), CENTER - radius * Math.cos(a)];
}

function arc(radius: number, from: number, to: number): string {
  const [x0, y0] = polar(radius, from);
  const [x1, y1] = polar(radius, to);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${radius} ${radius} 0 ${to - from > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

const clamp100 = (value: number) => Math.max(0, Math.min(100, value));

export interface ChapterStatusClusterProps {
  resources: ChapterResources;
  /** Present when the scenario has fatigue rules; without it the fatigue bar is not drawn. */
  fatigueLevel?: FatigueLevel;
  /** Placed on the map's lower-left corner (the task button). */
  mapCorner?: React.ReactNode;
  /**
   * One row for the band above the open laptop: the ring at a small size (no map label, no hover box)
   * and the clock with the weekday and the time left on one line.
   */
  compact?: boolean;
  /** Live Saigon GPS radar payload when outdoors; switches seamlessly from indoor standby disc to live map. */
  outsideRadar?: SaigonRadarData | null;
}

/** Size of the ring box in the compact row (px). */
const COMPACT_SIZE = 52;

/** Top-left cluster: the map disc with the status ring, and the clock beside it. */
export const ChapterStatusCluster: React.FC<ChapterStatusClusterProps> = ({ resources, fatigueLevel, mapCorner, compact = false, outsideRadar = null }) => {
  const { t } = useTranslation(["chapter1", "worlds"]);
  const text = t as unknown as Tx;
  const [focus, setFocus] = useState<StatId | null>(null);
  const percent = (value: number) => t("chapter1:hud.status.percent", { value });

  const stats: Stat[] = [
    {
      id: "security",
      icon: ShieldCheck,
      value: resources.digitalSecurity,
      color: resources.digitalSecurity < 40 ? COLOR.low : COLOR.security,
      label: t("chapter1:hud.status.security"),
      valueText: percent(resources.digitalSecurity),
      description: t("chapter1:hud.status.securityHint"),
    },
    {
      id: "support",
      icon: Users,
      value: resources.supportNetwork,
      color: resources.supportNetwork < 30 ? COLOR.low : COLOR.support,
      label: t("chapter1:hud.status.support"),
      valueText: percent(resources.supportNetwork),
      description: t("chapter1:hud.status.supportHint"),
    },
  ];
  if (fatigueLevel !== undefined) {
    stats.push({
      id: "fatigue",
      icon: Moon,
      value: resources.fatigue,
      color: fatigueLevel === "exhausted" ? COLOR.low : fatigueLevel === "tired" ? COLOR.tired : COLOR.rested,
      label: t("chapter1:hud.status.fatigue"),
      valueText: t("chapter1:hud.status.fatigueValue", {
        level: t(`chapter1:hud.status.fatigueLevel.${fatigueLevel}`),
        value: resources.fatigue,
      }),
      description: t("chapter1:hud.status.fatigueHint"),
    });
  }

  const clock = simulatedClock(resources.timeMinutes);
  const clockText = `${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`;
  const focused = compact ? null : (stats.find((stat) => stat.id === focus) ?? null);

  return (
    <div
      className={`pointer-events-none relative flex gap-4 ${compact ? "items-center gap-3" : "items-start"} ${mapCorner && !compact ? "pb-7" : ""}`}
      data-testid="chapter-status-cluster"
      data-compact={compact ? "true" : undefined}
    >
      <div className="relative shrink-0" style={compact ? { width: COMPACT_SIZE, height: COMPACT_SIZE } : { width: SIZE, height: SIZE }}>
      <div className="relative" style={compact ? { width: SIZE, height: SIZE, transform: `scale(${COMPACT_SIZE / SIZE})`, transformOrigin: "0 0" } : { width: SIZE, height: SIZE }}>
        <div className="absolute" style={{ left: PAD, top: PAD }}>
          {outsideRadar ? (
            <SaigonMinimap
              radar={outsideRadar}
              label={outsideRadar.zone ?? t("worlds:quests.noSignal")}
              size={DISC}
            />
          ) : (
            <NoSignalMinimap label={t("worlds:quests.noSignal")} size={DISC} />
          )}
        </div>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="absolute inset-0 overflow-visible"
          role="group"
          aria-label={t("chapter1:hud.status.label")}
          onMouseDown={stop}
        >
          {stats.map((stat, index) => {
            const gap = RING_OFFSET + index * 120;
            const from = gap + (120 - SPAN) / 2;
            const to = from + SPAN;
            const fill = from + (SPAN * clamp100(stat.value)) / 100;
            const [ix, iy] = polar(RING_R, gap);
            const Icon = stat.icon;
            const active = focus === stat.id;
            return (
              <g
                key={stat.id}
                data-testid={`status-ring-${stat.id}`}
                tabIndex={0}
                role="img"
                aria-label={`${stat.label}: ${stat.valueText}`}
                className="outline-none"
                onPointerEnter={() => setFocus(stat.id)}
                onPointerLeave={() => setFocus((current) => (current === stat.id ? null : current))}
                onFocus={() => setFocus(stat.id)}
                onBlur={() => setFocus((current) => (current === stat.id ? null : current))}
              >
                <path d={arc(RING_R, from, to)} fill="none" stroke={COLOR.track} strokeWidth={5} strokeLinecap="round" />
                {stat.value > 0 && (
                  <path
                    d={arc(RING_R, from, Math.max(from + 0.5, fill))}
                    fill="none"
                    stroke={stat.color}
                    strokeWidth={active ? 7 : 5}
                    strokeLinecap="round"
                    style={{ filter: `drop-shadow(0 0 4px ${stat.color}88)`, transition: "stroke-width 150ms ease" }}
                  />
                )}
                <foreignObject x={ix - 9} y={iy - 9} width={18} height={18}>
                  <Icon aria-hidden="true" className="h-[18px] w-[18px] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" style={{ color: stat.color }} />
                </foreignObject>
                {/* Wide, invisible hit area along the whole bar and its icon. */}
                <path d={arc(RING_R, gap - (120 - SPAN) / 2, to)} fill="none" stroke="transparent" strokeWidth={18} style={{ pointerEvents: "stroke", cursor: "help" }} />
              </g>
            );
          })}
        </svg>
        {!compact && mapCorner}
      </div>
      </div>

      {compact ? (
        <div className={`flex items-baseline gap-2.5 whitespace-nowrap ${SHADOW}`} data-testid="resource-time" role="group" aria-label={t("chapter1:hud.status.clock")}>
          <span className="font-menu text-2xl font-bold leading-none tracking-[0.04em] text-[#f3efe4] tabular-nums">{clockText}</span>
          <span className="font-menu text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300">{t(`chapter1:${WEEKDAY_KEYS[clock.isoWeekday - 1]}`)}</span>
          <span className="font-menu text-xs font-semibold tracking-[0.04em] text-[#c9bbf7]">{t("chapter1:hud.status.timeLeft", { time: formatSpan(text, resources.timeMinutes) })}</span>
          <span className="sr-only" data-testid="resource-thesis">{t("chapter1:hud.status.thesisShort", { value: resources.thesisProgress })}</span>
        </div>
      ) : (
      <div className={`pt-5 ${SHADOW}`} style={{ width: CLOCK_COLUMN_PX }} data-testid="resource-time" role="group" aria-label={t("chapter1:hud.status.clock")}>
        <p className="font-menu text-4xl font-bold leading-none tracking-[0.04em] text-[#f3efe4] tabular-nums">{clockText}</p>
        <p className="mt-1 font-menu text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300">{t(`chapter1:${WEEKDAY_KEYS[clock.isoWeekday - 1]}`)}</p>
        <p className="mt-2 font-menu text-sm font-semibold leading-tight tracking-[0.04em] text-[#c9bbf7]">
          {t("chapter1:hud.status.timeLeft", { time: formatSpan(text, resources.timeMinutes) })}
        </p>
        <p className="mt-0.5 font-menu text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400" data-testid="resource-thesis">
          {t("chapter1:hud.status.thesisShort", { value: resources.thesisProgress })}
        </p>
      </div>
      )}

      {focused && (
        <div
          role="tooltip"
          data-testid="status-ring-detail"
          className="absolute z-20 w-60 rounded-md border border-white/15 bg-[#12101c]/95 px-3 py-2.5 shadow-[0_6px_24px_rgba(0,0,0,0.55)]"
          // To the right of the clock column, so it covers neither the clock nor the objective.
          style={{ left: SIZE + 16 + CLOCK_COLUMN_PX + 16, top: 12 }}
        >
          <p className="flex items-center gap-2 font-menu text-sm font-semibold uppercase tracking-[0.12em] text-[#f3efe4]">
            <focused.icon className="h-4 w-4" style={{ color: focused.color }} aria-hidden="true" />
            {focused.label}
            <span className="ml-auto tabular-nums" style={{ color: focused.color }}>
              {focused.valueText}
            </span>
          </p>
          <div aria-hidden="true" className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full" style={{ width: `${clamp100(focused.value)}%`, background: focused.color }} />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-300">{focused.description}</p>
        </div>
      )}

      {/* The values as text for screen readers (and tests); the ring above is the visual. */}
      <ul className="sr-only">
        {stats.map((stat) => (
          <li key={stat.id} data-testid={`resource-${stat.id}`}>
            {stat.label}: {stat.valueText}
          </li>
        ))}
      </ul>
    </div>
  );
};

export interface ChapterTopBarProps {
  cash: number;
  /** Opens the host's pause menu (with Settings); the button is hidden without it. */
  onOpenSettings?: () => void;
  onHoverSound?: () => void;
}

/** Top-right corner: cash as icon, amount and unit, then the settings button. Both are one height (ROW_PX). */
export const ChapterTopBar: React.FC<ChapterTopBarProps> = ({ cash, onOpenSettings, onHoverSound }) => {
  const { t } = useTranslation("chapter1");
  const locale = useGameLocale();
  return (
    <div className="flex items-center gap-6" style={{ height: ROW_PX }} onMouseDown={stop} data-testid="chapter-top-bar">
      <p className={`pointer-events-none flex h-full items-center gap-2 ${SHADOW}`} data-testid="resource-cash" aria-label={t("hud.status.cash")}>
        <img src={CASH_ICON} alt="" aria-hidden="true" draggable={false} className="h-full w-auto select-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" />
        <span className={`font-menu text-xl font-bold leading-none tracking-[0.06em] tabular-nums ${cash < 0 ? "text-[#f07a6a]" : "text-[#f3efe4]"}`}>
          {new Intl.NumberFormat(locale).format(cash)}
        </span>{" "}
        <span className="font-menu text-xl font-semibold uppercase leading-none tracking-[0.14em] text-zinc-300">{t("hud.status.cashUnit")}</span>
      </p>
      {onOpenSettings && (
        <button type="button" onClick={onOpenSettings} onPointerEnter={onHoverSound} className={`${MENU_BUTTON} h-full !text-xl leading-none`} aria-keyshortcuts="Escape" data-testid="hud-settings">
          <span aria-hidden="true" className={`${KEYCAP} ${KEYCAP_HOVER} !p-0`} style={{ width: ROW_PX, height: ROW_PX }}>
            <Settings className="h-5 w-5" />
          </span>
          <span>{t("hud.settings")}</span>
        </button>
      )}
    </div>
  );
};

export interface ChapterTaskButtonProps {
  /** Something in the task list (the schedule) has not been looked at yet. */
  unseen: boolean;
  onOpen: () => void;
  onHoverSound?: () => void;
}

/**
 * The task icon at the lower-left of the map, as in the neighborhood HUD: it opens the task list
 * (the schedule, key K). `dot.webp` marks it while there is something new.
 */
export const ChapterTaskButton: React.FC<ChapterTaskButtonProps> = ({ unseen, onOpen, onHoverSound }) => {
  const { t } = useTranslation("chapter1");
  return (
    <button
      type="button"
      onMouseDown={stop}
      onClick={onOpen}
      onPointerEnter={onHoverSound}
      aria-label={t("hud.tasks")}
      aria-keyshortcuts="K"
      data-testid="hud-task-button"
      className="pointer-events-auto absolute z-10 flex h-14 w-14 items-center justify-center rounded-lg outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-[#b9a5f5] cursor-pointer"
      style={TASK_BUTTON_POSITION}
    >
      <span className="relative block h-[3.25rem] w-[3.25rem]">
        <img src={ICON_TASK} alt="" draggable={false} className="h-full w-full select-none object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" />
        {unseen && (
          <img
            data-testid="hud-task-new-mark"
            src={ICON_DOT}
            alt=""
            aria-hidden="true"
            draggable={false}
            // Same offset as the neighborhood button: both files are 512 px canvases with the shape off center.
            style={{ width: "115%", height: "115%", left: "28.8%", top: "-48%" }}
            className="absolute max-w-none select-none object-contain"
          />
        )}
      </span>
    </button>
  );
};
