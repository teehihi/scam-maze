import React, { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  Anchor,
  ArrowLeft,
  Eye,
  EyeOff,
  Feather,
  Footprints,
  HelpCircle,
  MapPin,
  Moon,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { MekongTelemetry, PlayerStats, TraversalMode, WorldBookmark } from '../engine/MekongWorldEngine';
import { WORLD_BOOKMARKS } from '../engine/bookmarks';
import { MIENTAY_PLACE_NAMES, MIENTAY_ZONE_NAMES } from '../placeNames';
import { useLiveValue, type LiveValue } from '../liveValue';

/** Range of the time-of-day dial, in hours (first light to the end of the firefly night). */
export const MIENTAY_TIME_RANGE = { min: 5.75, max: 19.75 } as const;

const TIME_PRESETS = [
  { id: 'dawn', hours: 6.25, icon: Sunrise },
  { id: 'noon', hours: 11.5, icon: Sun },
  { id: 'dusk', hours: 17.25, icon: Sunset },
  { id: 'night', hours: 19.75, icon: Moon },
] as const;

const MODES: ReadonlyArray<{ id: TraversalMode; icon: typeof Footprints }> = [
  { id: 'walk', icon: Footprints },
  { id: 'boat', icon: Anchor },
  { id: 'fly', icon: Feather },
];

function formatHour(hours: number): string {
  const whole = Math.floor(hours);
  const minutes = Math.min(59, Math.round((hours - whole) * 60));
  return `${String(whole).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

interface MientayHUDProps {
  isLocked: boolean;
  onToggleLock: () => void;
  /** Speed and position, updated many times a second without re-rendering the HUD. */
  stats: LiveValue<PlayerStats>;
  /** Frames per second, same idea. */
  fps: LiveValue<number>;
  telemetry: MekongTelemetry;
  visible: boolean;
  onToggleVisible: () => void;
  onBackToMenu?: () => void;
  onModeChange: (mode: TraversalMode) => void;
  onBookmark: (bookmark: WorldBookmark) => void;
  /** `commit` is false while a slider is being dragged and true once the value is final. */
  onTimeChange: (hours: number, commit: boolean) => void;
  onToggleAudio: () => void;
  onTogglePerformance: () => void;
}

const FpsText: React.FC<{ source: LiveValue<number> }> = ({ source }) => {
  const { t } = useTranslation('worlds');
  const fps = useLiveValue(source);
  return <>{t('mientay.hud.fps', { fps })}</>;
};

const StatsReadout: React.FC<{ source: LiveValue<PlayerStats> }> = React.memo(({ source }) => {
  const { t } = useTranslation('worlds');
  const stats = useLiveValue(source);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#1e4659]/80 bg-[#091b26]/85 p-2.5 px-3.5 font-mono text-[11px] text-zinc-300 shadow-xl">
      <div>
        <span className="text-zinc-400">{t('mientay.stats.speed')} </span>
        <span className="font-bold text-emerald-400">{stats.speed.toFixed(1)} m/s</span>
      </div>
      <div className="text-zinc-500">|</div>
      <div>
        <span className="text-zinc-400">{t('mientay.stats.position')} </span>
        <span className="text-zinc-200">
          X:{stats.position[0].toFixed(1)} Y:{stats.position[1].toFixed(1)} Z:{stats.position[2].toFixed(1)}
        </span>
      </div>
    </div>
  );
});
StatsReadout.displayName = 'StatsReadout';

const PILL =
  'pointer-events-auto flex items-center gap-1.5 rounded-full border border-white/15 bg-stone-950/65 px-3 py-1.5 text-xs font-medium text-stone-200 transition hover:bg-stone-900/80 cursor-pointer';

export const MientayHUD: React.FC<MientayHUDProps> = ({
  isLocked,
  onToggleLock,
  stats,
  fps,
  telemetry,
  visible,
  onToggleVisible,
  onBackToMenu,
  onModeChange,
  onBookmark,
  onTimeChange,
  onToggleAudio,
  onTogglePerformance,
}) => {
  const { t } = useTranslation('worlds');
  const [showHelp, setShowHelp] = useState(false);
  const [activeBookmark, setActiveBookmark] = useState<string>(WORLD_BOOKMARKS[0].id);
  // The slider follows the engine except while it is being dragged.
  const [sliderHours, setSliderHours] = useState(telemetry.timeOfDay);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) setSliderHours(telemetry.timeOfDay);
  }, [telemetry.timeOfDay, dragging]);

  if (!visible) {
    return (
      <button
        type="button"
        onClick={onToggleVisible}
        title={t('mientay.hud.show')}
        className="fixed right-4 top-4 z-30 pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-stone-950/60 px-3.5 py-2 text-xs font-medium text-stone-100 transition hover:bg-stone-900/80 cursor-pointer"
      >
        <Eye className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
        <span>{t('mientay.hud.show')}</span>
      </button>
    );
  }

  const commitTime = () => {
    setDragging(false);
    onTimeChange(sliderHours, true);
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex select-none flex-col justify-between p-4 sm:p-5">
      {/* Top bar */}
      <header className="flex w-full items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {onBackToMenu && (
            <button
              type="button"
              onClick={onBackToMenu}
              className="pointer-events-auto flex cursor-pointer items-center gap-2 rounded-xl border border-[#1e4659] bg-[#0d1f2d]/90 px-4 py-2 text-xs font-semibold text-zinc-100 shadow-lg transition-all hover:border-[#4dd8ff] hover:bg-[#133045]"
            >
              <ArrowLeft className="h-4 w-4 text-[#4dd8ff]" aria-hidden="true" />
              <span>{t('mientay.backToMenu')}</span>
            </button>
          )}
          <div className="hidden items-center gap-3 rounded-xl border border-amber-200/20 bg-stone-950/65 px-3.5 py-1.5 text-xs text-amber-50 sm:flex">
            <span className="font-medium text-amber-100">
              {t('mientay.header', { region: MIENTAY_PLACE_NAMES.regionUpper })}
            </span>
            <span className="flex items-center gap-1.5 text-amber-200/90">
              <MapPin className="h-3 w-3 shrink-0 text-amber-400" aria-hidden="true" />
              <span aria-label={t('mientay.zones.label')}>{MIENTAY_ZONE_NAMES[telemetry.zone]}</span>
            </span>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] text-emerald-300 ring-1 ring-emerald-400/25">
              <FpsText source={fps} />
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div
            role="group"
            aria-label={t('mientay.mode.label')}
            className="pointer-events-auto flex items-center rounded-full border border-white/15 bg-stone-950/65 p-1"
          >
            {MODES.map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={telemetry.mode === id}
                onClick={() => onModeChange(id)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  telemetry.mode === id ? 'bg-amber-500/90 text-stone-950 shadow' : 'text-stone-200 hover:bg-white/10'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t(`mientay.mode.${id}`)}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onToggleAudio}
            title={t('mientay.audio.title')}
            aria-pressed={telemetry.audioOn}
            className={`${PILL} ${telemetry.audioOn ? '!border-emerald-400/40 !bg-emerald-950/60 !text-emerald-200' : ''}`}
          >
            {telemetry.audioOn ? (
              <Volume2 className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
            ) : (
              <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{telemetry.audioOn ? t('mientay.audio.on') : t('mientay.audio.off')}</span>
          </button>
          <button
            type="button"
            onClick={onTogglePerformance}
            title={t('mientay.performance.title')}
            aria-pressed={telemetry.performanceMode}
            className={PILL}
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
            <span>{telemetry.performanceMode ? t('mientay.performance.on') : t('mientay.performance.off')}</span>
          </button>
          <button
            type="button"
            onClick={onToggleLock}
            className="pointer-events-auto flex cursor-pointer items-center gap-2 rounded-full border border-[#1e4659] bg-[#0d1f2d]/85 px-3.5 py-1.5 font-mono text-xs text-zinc-300 shadow-lg transition-all hover:bg-[#172f3e]"
          >
            <div className={`h-2 w-2 rounded-full ${isLocked ? 'animate-pulse bg-emerald-400' : 'bg-amber-400'}`} />
            <span>{isLocked ? t('mientay.pointer.locked') : t('mientay.pointer.unlocked')}</span>
          </button>
          <button
            type="button"
            onClick={onToggleVisible}
            title={t('mientay.hud.hide')}
            aria-label={t('mientay.hud.hide')}
            className={PILL}
          >
            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Reticle */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          <div className="h-1.5 w-1.5 rounded-full bg-white/85 shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
          <div className="absolute h-6 w-6 rounded-full border border-white/35" />
        </div>
      </div>

      {/* Hints in the middle of the lower screen */}
      <div className="flex flex-col items-center gap-2">
        {telemetry.mode === 'walk' && telemetry.nearBoat && (
          <div className="pointer-events-none flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-950/80 px-4 py-2 text-xs font-medium text-amber-100 shadow-lg">
            <Anchor className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
            <Trans
              t={t}
              i18nKey="mientay.boardPrompt"
              components={{ kbd: <kbd className="rounded border border-amber-200/30 bg-black/30 px-1 font-mono text-[10px]" /> }}
            />
          </div>
        )}
        {!isLocked && (
          <div
            className="pointer-events-auto flex cursor-pointer items-center gap-2 rounded-full border border-[#1e4659]/80 bg-[#071620]/90 px-4 py-2 text-xs text-zinc-300 shadow-lg transition-all hover:border-[#4dd8ff]"
            onClick={onToggleLock}
          >
            <div className="h-2 w-2 animate-ping rounded-full bg-amber-400" />
            <span>
              <Trans
                t={t}
                i18nKey="mientay.lockHint"
                components={{
                  kbd: <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-amber-300" />,
                }}
              />
            </span>
          </div>
        )}
      </div>

      {/* Bottom dock: places, time of day, help and telemetry */}
      <footer className="flex w-full flex-col items-stretch gap-2">
        <div className="pointer-events-auto mx-auto flex w-full max-w-4xl flex-col gap-2 rounded-2xl border border-white/15 bg-stone-950/65 p-3 shadow-2xl">
          <div role="group" aria-label={t('mientay.places.label')} className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {WORLD_BOOKMARKS.map((bookmark) => {
              const active = activeBookmark === bookmark.id;
              return (
                <button
                  key={bookmark.id}
                  type="button"
                  aria-pressed={active}
                  title={t(`mientay.places.subtitles.${bookmark.id}`)}
                  onClick={() => {
                    setActiveBookmark(bookmark.id);
                    onBookmark(bookmark);
                  }}
                  className={`shrink-0 cursor-pointer rounded-xl px-3 py-1.5 text-left text-xs font-semibold leading-tight transition ${
                    active ? 'bg-amber-500/90 text-stone-950 shadow-sm' : 'bg-white/5 text-stone-200 hover:bg-white/10'
                  }`}
                >
                  {bookmark.name}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-2">
            <div className="flex items-center gap-1.5">
              {TIME_PRESETS.map(({ id, hours, icon: Icon }) => {
                const active = Math.abs(sliderHours - hours) < 0.7;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setSliderHours(hours);
                      onTimeChange(hours, true);
                    }}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                      active ? 'bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/40' : 'text-stone-300 hover:bg-white/10'
                    }`}
                  >
                    <Icon className="h-3 w-3" aria-hidden="true" />
                    <span>{t(`mientay.time.${id}`)}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex min-w-[200px] flex-1 items-center gap-2.5">
              <span className="w-11 text-right font-mono text-xs font-medium text-amber-200">{formatHour(sliderHours)}</span>
              <input
                type="range"
                min={MIENTAY_TIME_RANGE.min}
                max={MIENTAY_TIME_RANGE.max}
                step={0.05}
                value={sliderHours}
                aria-label={t('mientay.time.label')}
                onPointerDown={() => setDragging(true)}
                onChange={(event) => {
                  const hours = parseFloat(event.target.value);
                  setSliderHours(hours);
                  onTimeChange(hours, false);
                }}
                onPointerUp={commitTime}
                onKeyUp={commitTime}
                onBlur={() => dragging && commitTime()}
                className="w-full accent-amber-400"
              />
            </div>
          </div>
        </div>

        <div className="flex w-full items-end justify-between gap-4">
          <div className="pointer-events-auto">
            <button
              type="button"
              onClick={() => setShowHelp((previous) => !previous)}
              aria-expanded={showHelp}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#1e4659]/80 bg-[#091b26]/80 px-3 py-1.5 font-mono text-[11px] text-zinc-300 shadow-md transition-all hover:bg-[#0f2838]"
            >
              <HelpCircle className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
              <span>{t('mientay.controls.toggle')}</span>
              <span className="ml-1 font-bold text-amber-400">{showHelp ? '✕' : '?'}</span>
            </button>
          </div>
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            {showHelp && (
              <div className="max-w-sm rounded-2xl border border-[#1e4659] bg-[#091b26]/92 p-3.5 text-[11px] text-zinc-300 shadow-2xl">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[11px]">
                  {(
                    [
                      ['W A S D', 'move'],
                      ['Shift', 'sprint'],
                      ['Space', 'jump'],
                      ['mouse', 'mouse'],
                      ['leftMouse', 'punch'],
                      ['rightMouse', 'block'],
                      ['B', 'boat'],
                      ['V', 'fly'],
                      ['H', 'hideHud'],
                    ] as const
                  ).map(([keyLabel, action]) => (
                    <div key={`${keyLabel}-${action}`}>
                      <span className="font-semibold text-amber-300">
                        {keyLabel === 'mouse' || keyLabel === 'leftMouse' || keyLabel === 'rightMouse'
                          ? t(`mientay.controls.${keyLabel}`)
                          : keyLabel}
                      </span>
                      <span className="text-zinc-400"> : {t(`mientay.controls.${action}`)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <StatsReadout source={stats} />
          </div>
        </div>
      </footer>
    </div>
  );
};
