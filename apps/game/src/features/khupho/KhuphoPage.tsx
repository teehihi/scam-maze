import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CloudRain, CloudSun, Pause, Play, Volume2, VolumeX } from "lucide-react";
import type { GameSettings } from "@scammaze/shared-types";
import { Engine, type Hud } from "./world/engine";
import { setTranslator } from "./world/strings";
import { KHUPHO_PLACE_NAMES } from "./placeNames";

interface KhuphoPageProps {
  settings: GameSettings;
  onBackToMenu: () => void;
}

/** Quality names the prototype engine understands, keyed by the game's graphics setting. */
const ENGINE_QUALITY = { low: "low", medium: "med", high: "high" } as const;
const QUALITY_CYCLE = ["high", "med", "low"] as const;

type TimeKey = "dawn" | "morning" | "noon" | "afternoon" | "sunset" | "evening" | "lateNight";

const TIME_PRESETS: ReadonlyArray<readonly [number, TimeKey]> = [
  [5.6, "dawn"],
  [8, "morning"],
  [12.3, "noon"],
  [17.2, "afternoon"],
  [18.6, "sunset"],
  [21, "evening"],
  [23.8, "lateNight"],
];

/** Teleport keys understood by the engine. */
const PLACES = ["street", "alley", "court", "living", "kitchen", "bedroom", "roof", "grocery", "cafe", "pho", "cap4"] as const;

const BUTTON =
  "cursor-pointer rounded-md border border-white/15 bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur transition hover:bg-white/25";

/**
 * Prototype route `/khupho`: a lived-in Vietnamese neighborhood (alley, tube houses, shops).
 * It is a standalone engine kept apart from the story chapters until it is integrated.
 */
export const KhuphoPage: React.FC<KhuphoPageProps> = ({ settings, onBackToMenu }) => {
  const { t } = useTranslation("worlds");
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const qualityRef = useRef(settings.graphicsQuality);
  qualityRef.current = settings.graphicsQuality;

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    let engine: Engine | null = null;
    let cancelled = false;
    // Prompts, room names and the weather label all read from the active language.
    setTranslator((key, options) => (t as unknown as (k: string, o?: object) => string)(key, options));
    Engine.create(el, setHud, { quality: ENGINE_QUALITY[qualityRef.current] }, undefined, () => cancelled)
      .then((built) => {
        if (cancelled) { built.dispose(); return; }
        engine = built;
        engineRef.current = built;
        setLoading(false);
      })
      .catch((err: unknown) => {
        console.error(err);
        if (!cancelled) { setError(err instanceof Error ? err.message : String(err)); setLoading(false); }
      });
    return () => {
      cancelled = true;
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  const engine = () => engineRef.current;
  const started = hud?.started ?? false;

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-black">
      <div ref={mountRef} className="absolute inset-0" />

      {loading && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-[#0d1117] text-amber-100" aria-busy="true">
          <div className="text-center">
            <div className="mb-3 text-2xl font-light tracking-widest">{t("khupho.loading.title")}</div>
            <div className="text-sm opacity-60">{t("khupho.loading.hint")}</div>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="absolute inset-0 z-40 grid place-items-center bg-black p-8 text-center text-red-300">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={onBackToMenu}
        className={`${BUTTON} absolute left-3 top-3 z-50 flex items-center gap-1.5`}
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        {t("khupho.backToMenu")}
      </button>

      {!loading && !error && !started && (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-black/45 via-black/25 to-black/70">
          <div className="max-w-2xl px-6 text-center text-white">
            <div className="mb-3 text-[11px] tracking-[0.45em] text-amber-200/80">{t("khupho.intro.kicker")}</div>
            <h1 className="mb-4 text-4xl font-semibold leading-tight md:text-6xl" style={{ textShadow: "0 2px 24px rgba(0,0,0,.6)" }}>
              {KHUPHO_PLACE_NAMES.street}
            </h1>
            <p className="mb-6 text-sm leading-relaxed text-white/80 md:text-base">{t("khupho.intro.description")}</p>
            <div className="mb-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                className="cursor-pointer rounded-full bg-amber-400 px-7 py-3 font-semibold text-black shadow-lg transition hover:bg-amber-300"
                onClick={() => engine()?.begin(true)}
              >
                {t("khupho.intro.enter")}
              </button>
              <button
                type="button"
                className="cursor-pointer rounded-full border border-white/30 bg-white/15 px-7 py-3 transition hover:bg-white/25"
                onClick={() => {
                  engine()?.begin(false);
                  engine()?.startTour();
                }}
              >
                {t("khupho.intro.tour")}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-white/70 md:grid-cols-4">
              <div className="rounded-lg bg-black/35 p-2"><b className="text-white">WASD</b> {t("khupho.controls.move")} · <b className="text-white">Shift</b> {t("khupho.controls.sprint")}</div>
              <div className="rounded-lg bg-black/35 p-2"><b className="text-white">{t("khupho.controls.look")}</b> {t("khupho.controls.lookHint")}</div>
              <div className="rounded-lg bg-black/35 p-2"><b className="text-white">{t("khupho.controls.interact")}</b> {t("khupho.controls.interactHint")}</div>
              <div className="rounded-lg bg-black/35 p-2">
                <b className="text-white">{t("khupho.controls.time")}</b> {t("khupho.controls.timeHint")} · <b className="text-white">{t("khupho.controls.rain")}</b> {t("khupho.controls.rainHint")} · <b className="text-white">{t("khupho.controls.tourKey")}</b> {t("khupho.controls.tourHint")}
              </div>
            </div>
          </div>
        </div>
      )}

      {started && hud && (
        <>
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className={`rounded-full transition-all ${hud.prompt ? "h-3 w-3 bg-amber-300/90 ring-2 ring-white/60" : "h-1.5 w-1.5 bg-white/70"}`} />
          </div>
          {hud.prompt && (
            <div className="pointer-events-none absolute left-1/2 top-[56%] -translate-x-1/2 rounded-full border border-white/20 bg-black/60 px-4 py-1.5 text-sm text-white backdrop-blur">
              <span className="mr-2 inline-block rounded bg-white/90 px-1.5 text-xs font-bold text-black">E</span>
              {hud.prompt}
            </div>
          )}
          <div className="pointer-events-none absolute left-3 top-14 text-white">
            <div className="text-xl font-semibold tabular-nums" style={{ textShadow: "0 1px 8px #000" }}>{hud.time}</div>
            <div className="text-xs opacity-80" style={{ textShadow: "0 1px 6px #000" }}>{hud.weather} · {hud.loc}</div>
            {hud.tour && <div className="mt-1 text-[11px] text-amber-200">{t("khupho.hud.tour")}</div>}
          </div>
          <div className="pointer-events-none absolute right-3 top-3 text-[11px] text-white/60">{t("khupho.hud.fps", { fps: hud.fps })}</div>
          <div className="absolute inset-x-0 bottom-3 flex flex-col items-center gap-2 px-2">
            <div className="flex flex-wrap justify-center gap-1.5">
              {TIME_PRESETS.map(([hour, key]) => (
                <button key={key} type="button" className={BUTTON} onClick={() => engine()?.setTime(hour)}>
                  {t(`khupho.times.${key}`)}
                </button>
              ))}
              <button type="button" className={`${BUTTON} flex items-center gap-1`} onClick={() => engine()?.setRain(hud.rain > 0.3 ? 0 : 1)}>
                {hud.rain > 0.3 ? <CloudSun className="h-3.5 w-3.5" aria-hidden="true" /> : <CloudRain className="h-3.5 w-3.5" aria-hidden="true" />}
                {hud.rain > 0.3 ? t("khupho.actions.clearSky") : t("khupho.actions.rain")}
              </button>
              <button type="button" className={`${BUTTON} flex items-center gap-1`} onClick={() => engine()?.setTimeScale(hud.timeScale > 0 ? 0 : 60)}>
                {hud.timeScale > 0 ? <Pause className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
                {hud.timeScale > 0 ? t("khupho.actions.pauseTime") : t("khupho.actions.resumeTime")}
              </button>
              <button
                type="button"
                className={BUTTON}
                aria-label={hud.muted ? t("khupho.actions.unmute") : t("khupho.actions.mute")}
                onClick={() => engine()?.toggleMute()}
              >
                {hud.muted ? <VolumeX className="h-3.5 w-3.5" aria-hidden="true" /> : <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />}
              </button>
              <button
                type="button"
                className={BUTTON}
                onClick={() => {
                  const index = QUALITY_CYCLE.indexOf(hud.quality as (typeof QUALITY_CYCLE)[number]);
                  engine()?.applyQuality(QUALITY_CYCLE[(index + 1) % QUALITY_CYCLE.length]);
                }}
              >
                {t("khupho.actions.graphics", { quality: t(`khupho.quality.${hud.quality as "high" | "med" | "low"}`) })}
              </button>
              <button type="button" className={BUTTON} onClick={() => engine()?.startTour()}>{t("khupho.actions.tour")}</button>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {PLACES.map((key) => (
                <button key={key} type="button" className={`${BUTTON} !bg-amber-900/50`} onClick={() => engine()?.teleport(key)}>
                  {t(`khupho.places.${key}`)}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
