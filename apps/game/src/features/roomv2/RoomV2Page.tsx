import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import type { GameSettings } from "@scammaze/shared-types";
import { Engine, type UIState } from "./game/engine";
import { setTranslator } from "./game/strings";

interface RoomV2PageProps {
  settings: GameSettings;
  onBackToMenu: () => void;
  /** Called once the room engine has been built (the story flow hides its loading screen then). */
  onReady?: (engine: Engine) => void;
  /**
   * Part of the story flow: no title card (the room starts at once), no back button or quality
   * picker, and no own pause layer; the story page shows its resume prompt and pause menu.
   */
  embedded?: boolean;
  /** Pointer lock and started state for the story page's HUD. */
  onUI?: (ui: UIState) => void;
}

type RoomQuality = "high" | "low";

const INITIAL_UI: UIState = {
  prompt: null,
  focus: false,
  captions: [],
  inspecting: null,
  locked: false,
  fade: 1,
  ended: null,
  started: false,
  seated: false,
};

const SHADOW = { textShadow: "0 1px 6px rgba(0,0,0,.9)" } as const;

/**
 * Prototype route `/roomv2`: the player's apartment, "After the Rain". It is a standalone engine
 * kept apart from the story chapters until it is integrated.
 */
export const RoomV2Page: React.FC<RoomV2PageProps> = ({ settings, onBackToMenu, onReady, embedded = false, onUI }) => {
  const { t } = useTranslation("worlds");
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const [ui, setUI] = useState<UIState>(INITIAL_UI);
  const [quality, setQuality] = useState<RoomQuality>(settings.graphicsQuality === "high" ? "high" : "low");
  const [loading, setLoading] = useState(true);
  const [showHelp, setShowHelp] = useState(true);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onUIRef = useRef(onUI);
  onUIRef.current = onUI;
  const embeddedRef = useRef(embedded);
  embeddedRef.current = embedded;

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    setLoading(true);
    setUI(INITIAL_UI);
    // The engine's prompts, captions and phone screens all read from the active language.
    setTranslator((key, options) => (t as unknown as (k: string, o?: object) => string)(key, options));
    // Let the loading text paint before the heavy texture generation starts.
    const timer = window.setTimeout(() => {
      try {
        const engine = new Engine(el, (next) => { setUI(next); onUIRef.current?.(next); }, quality);
        engineRef.current = engine;
        // In the story the door is already open: the player walks straight in.
        if (embeddedRef.current) engine.begin();
        onReadyRef.current?.(engine);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }, 60);
    return () => {
      window.clearTimeout(timer);
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [quality]);

  useEffect(() => {
    if (!ui.started) return;
    const timer = window.setTimeout(() => setShowHelp(false), 22000);
    return () => window.clearTimeout(timer);
  }, [ui.started]);

  const keyClass = "rounded border border-white/40 px-1.5 py-0.5 text-[11px]";

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-black text-stone-100">
      <div ref={mountRef} className="absolute inset-0" />

      {!embedded && (
      <button
        type="button"
        onClick={onBackToMenu}
        className="absolute left-3 top-3 z-50 flex cursor-pointer items-center gap-1.5 rounded-md border border-white/15 bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur transition hover:bg-white/25"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        {t("roomv2.backToMenu")}
      </button>
      )}

      {ui.started && ui.locked && !ui.inspecting && !ui.ended && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className={`rounded-full transition-all duration-300 ${ui.focus ? "h-5 w-5 border border-white/70" : "h-1 w-1 bg-white/60"}`} />
          {ui.prompt && (
            <div className="absolute top-1/2 mt-7 flex items-center gap-2 text-[13px] tracking-wide text-white/85" style={SHADOW}>
              <span className={`${keyClass} text-white/80`}>E</span>
              {ui.prompt}
            </div>
          )}
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-[9%] flex flex-col items-center gap-2 px-6" aria-live="polite">
        {ui.captions.map((caption) => (
          <div key={caption.id} className="max-w-2xl text-center animate-[cap_0.9s_ease-out]" style={{ textShadow: "0 2px 10px rgba(0,0,0,.95)" }}>
            {caption.voice ? (
              <p className="text-[17px] leading-relaxed text-sky-100/95">
                <span className="mr-2 text-xs uppercase tracking-[0.2em] text-sky-300/70">{t("roomv2.caption.phone")}</span>
                “{caption.text}”
              </p>
            ) : (
              <p className="text-[17px] italic leading-relaxed text-stone-100/90">{caption.text}</p>
            )}
          </div>
        ))}
      </div>

      {ui.inspecting && !ui.ended && (
        <div className="pointer-events-none absolute bottom-8 right-8 flex flex-col items-end gap-1.5 text-[13px] text-white/75" style={SHADOW}>
          {ui.inspecting.title && <div className="mb-1 text-[11px] uppercase tracking-[0.25em] text-white/45">{ui.inspecting.title}</div>}
          {ui.inspecting.actions.map((action) => (
            <div key={action.key} className="flex items-center gap-2">
              {action.label}
              <span className={keyClass}>{action.key}</span>
            </div>
          ))}
        </div>
      )}

      {ui.seated && ui.started && !ui.inspecting && !ui.ended && (
        <div className="pointer-events-none absolute bottom-8 right-8 flex flex-col items-end gap-1.5 text-[13px] text-white/75" style={SHADOW}>
          <div className="mb-1 text-[11px] uppercase tracking-[0.25em] text-white/45">{t("roomv2.seated.title")}</div>
          <div className="flex items-center gap-2">
            {t("roomv2.seated.stand")}
            <span className={keyClass}>Q</span>
          </div>
        </div>
      )}

      {ui.started && showHelp && !ui.inspecting && (
        <div className="pointer-events-none absolute bottom-7 left-7 text-[12px] leading-6 text-white/45">
          <div>
            <b className="font-medium text-white/65">{t("roomv2.controls.moveKeys")}</b> {t("roomv2.controls.move")} ·{" "}
            <b className="font-medium text-white/65">{t("roomv2.controls.mouse")}</b> {t("roomv2.controls.look")} ·{" "}
            <b className="font-medium text-white/65">Shift</b> {t("roomv2.controls.sprint")}
          </div>
          <div>
            <b className="font-medium text-white/65">{t("roomv2.controls.interactKeys")}</b> {t("roomv2.controls.interact")} ·{" "}
            <b className="font-medium text-white/65">{t("roomv2.controls.backKeys")}</b> {t("roomv2.controls.back")}
          </div>
        </div>
      )}

      {!embedded && ui.started && !ui.locked && !ui.ended && (
        <button
          type="button"
          onClick={() => engineRef.current?.lock()}
          className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/35 backdrop-blur-[1px]"
        >
          <span className="text-sm uppercase tracking-[0.3em] text-white/70">{t("roomv2.pause")}</span>
        </button>
      )}

      {!embedded && !ui.started && (
        <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(10,12,20,0.55),rgba(0,0,0,0.92))]">
          <div className="max-w-xl px-8 text-center">
            <p className="mb-6 text-[11px] uppercase tracking-[0.45em] text-amber-200/60">{t("roomv2.intro.kicker")}</p>
            <h1 className="text-5xl font-extralight tracking-tight text-stone-100 md:text-6xl">{t("roomv2.intro.title")}</h1>
            <p className="mt-6 text-[15px] leading-relaxed text-stone-300/75">{t("roomv2.intro.description")}</p>
            <button
              type="button"
              disabled={loading}
              onClick={() => engineRef.current?.begin()}
              className="mt-10 cursor-pointer rounded-full border border-white/25 px-8 py-3 text-sm uppercase tracking-[0.25em] text-white/85 transition hover:border-white/50 hover:bg-white/10 disabled:opacity-40"
            >
              {loading ? t("roomv2.intro.building") : t("roomv2.intro.enter")}
            </button>
            <div className="mt-8 flex items-center justify-center gap-3 text-[12px] text-white/45">
              <span>{t("roomv2.intro.quality")}</span>
              {(["high", "low"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={quality === option}
                  onClick={() => setQuality(option)}
                  className={`cursor-pointer rounded-full border px-3 py-1 ${quality === option ? "border-white/50 text-white/85" : "border-white/15 hover:border-white/30"}`}
                >
                  {t(`roomv2.intro.${option}`)}
                </button>
              ))}
            </div>
            <p className="mt-6 text-[12px] text-white/35">{t("roomv2.intro.headphones")}</p>
          </div>
        </div>
      )}

      {ui.ended && (
        <div className="absolute inset-0 flex animate-[cap_2.5s_ease-out] items-center justify-center">
          <div className="max-w-lg px-8 text-center">
            <p className="mb-5 text-[11px] uppercase tracking-[0.45em] text-amber-200/55">
              {ui.ended === "answered" ? t("roomv2.ending.answeredTime") : t("roomv2.ending.declinedTime")}
            </p>
            <h2 className="text-3xl font-extralight leading-snug text-stone-100 md:text-4xl">{t("roomv2.ending.title")}</h2>
            <p className="mt-5 text-[15px] leading-relaxed text-stone-300/70">
              {ui.ended === "answered" ? t("roomv2.ending.answered") : t("roomv2.ending.declined")}
            </p>
            <p className="mt-8 text-[11px] uppercase tracking-[0.35em] text-white/35">{t("roomv2.ending.endOfPrologue")}</p>
            <div className="mt-8 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => engineRef.current?.continueAfterEnd()}
                className="cursor-pointer rounded-full border border-white/25 px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-white/85 hover:bg-white/10"
              >
                {t("roomv2.ending.stay")}
              </button>
              {!embedded && (
              <button
                type="button"
                onClick={onBackToMenu}
                className="cursor-pointer rounded-full border border-white/10 px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-white/55 hover:bg-white/5"
              >
                {t("roomv2.backToMenu")}
              </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
