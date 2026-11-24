import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { SaigonMinimap } from "../../chapter1/hud/SaigonMinimap";
import { CinemaNpcHud } from "./CinemaNpcHud";
import { DistrictArrivalBanner, StreetActionPrompt } from "./StreetHudElements";
import {
  OpenWorldEngine,
  type LandmarkWaypoint,
  type OpenWorldSnapshot,
} from "./world/OpenWorldEngine";
import type { WeatherPreset } from "./world/AtmosphereSystem";

function formatClock(hours: number): string {
  const h = Math.floor(((hours % 24) + 24) % 24);
  const m = Math.floor((((hours % 24) + 24) % 24 - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const WEATHER_LABELS: { id: WeatherPreset; label: string; badge: string }[] = [
  { id: "clear", label: "Nắng / Quang", badge: "1" },
  { id: "overcast", label: "Mây Ẩm", badge: "2" },
  { id: "drizzle", label: "Sau Cơn Mưa", badge: "3" },
  { id: "monsoon", label: "Mưa Giông", badge: "4" },
];

const WAYPOINTS: { id: LandmarkWaypoint; label: string }[] = [
  { id: "room", label: "Phòng 6.07" },
  { id: "balcony", label: "Hành Lang Trọ" },
  { id: "hem", label: "Hẻm 462/14" },
  { id: "bus", label: "Trạm Xe Buýt" },
  { id: "bitexco", label: "Bitexco Q.1" },
  { id: "landmark81", label: "Landmark 81" },
];

export default function OpenWorldApp() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<OpenWorldEngine | null>(null);
  const [snap, setSnap] = useState<OpenWorldSnapshot | null>(null);
  // Start collapsed so entering Saigon immediately feels like a clean, full-bleed cinema open world.
  const [panelOpen, setPanelOpen] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    let engine: OpenWorldEngine | null = null;
    try {
      engine = new OpenWorldEngine(el, setSnap);
      engineRef.current = engine;
    } catch (err) {
      console.error("OpenWorldEngine init error:", err);
      setBootError(err instanceof Error ? err.message : String(err));
    }
    return () => {
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  const atm = snap?.atmosphere;
  const inDialogue = Boolean(snap?.storyDialogue);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950 font-sans text-white">
      {/* Full-Bleed Seamless 3D Open World Viewport */}
      <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

      {bootError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-6">
          <div className="max-w-md rounded-2xl border border-red-400/40 bg-slate-900 p-6 text-sm text-white shadow-2xl">
            <div className="mb-2 text-base font-bold text-red-300">Không thể khởi tạo WebGL Open World</div>
            <p className="font-mono text-xs text-white/80">{bootError}</p>
          </div>
        </div>
      )}

      {/* Center Ultra-Minimal Crosshair (cleanly hidden during cinema NPC dialogue or modals) */}
      {!inDialogue && !snap?.activeModal && (
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
          <div
            className={`rounded-full transition-all duration-150 ${
              snap?.prompt
                ? "h-1.5 w-1.5 border border-amber-200/85 bg-amber-200/65"
                : "h-1 w-1 bg-white/35"
            }`}
          />
        </div>
      )}

      {/* Cinematic District Arrival Banner (glides in on zone transition, then dissolves cleanly) */}
      {snap && (
        <DistrictArrivalBanner
          zone={snap.zone}
          district={snap.district}
          weather={snap.atmosphere.weather}
          hidden={inDialogue || Boolean(snap.activeModal)}
        />
      )}

      {/* Top-Left: Quiet Cinema Clock & Live Rotating Saigon Radar (hidden cleanly during NPC dialogue) */}
      {snap && !inDialogue && (
        <div className="pointer-events-none fixed top-4 left-4 z-10 flex items-start gap-4">
          <SaigonMinimap
            size={128}
            radar={{
              position: { x: snap.position.x, z: snap.position.z },
              headingDeg: snap.headingDeg,
              busPosition: snap.busPosition,
              npcBlips: snap.npcBlips,
              zone: snap.zone,
              district: snap.district,
            }}
            label={snap.zone}
          />
          <div className="pt-2 [text-shadow:0_1px_8px_rgba(0,0,0,0.88)]">
            <p className="font-menu text-3xl font-bold leading-none tracking-[0.04em] text-[#f3efe4] tabular-nums">
              {formatClock(snap.atmosphere.timeOfDay)}
            </p>
            <p className="mt-1 font-menu text-xs font-semibold uppercase tracking-[0.16em] text-zinc-200">
              {snap.zone}
            </p>
            <p className="mt-1 font-menu text-[11px] font-medium tracking-[0.06em] text-emerald-300/90">
              Buýt 06 · {snap.busStatus}
            </p>
          </div>
        </div>
      )}

      {/* Top-Right: Collapsible World Director (collapsed by default for clean immersion) */}
      {!inDialogue && (
        <div className="fixed top-4 right-4 z-20 flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className="flex cursor-pointer items-center gap-2 rounded-md border border-white/15 bg-black/50 px-3 py-1.5 font-menu text-xs font-semibold uppercase tracking-[0.14em] text-[#f3efe4]/90 backdrop-blur-md transition hover:border-white/35 hover:bg-black/70 hover:text-white"
          >
            {panelOpen ? (
              <>
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Đóng</span>
              </>
            ) : (
              <>
                <SlidersHorizontal className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                <span>Đạo Diễn Sài Gòn</span>
              </>
            )}
          </button>

          {panelOpen && snap && atm && (
            <div className="w-72 rounded-xl border border-white/15 bg-[#100f18]/85 p-3.5 text-xs shadow-2xl backdrop-blur-xl">
              {/* Telemetry tucked cleanly inside the Director drawer */}
              <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2 text-[10px] text-white/60">
                <span>{snap.district}</span>
                <span className="font-mono">
                  {snap.fps} FPS · {snap.streaming.activeNear} near / {snap.streaming.activeLod} LOD
                </span>
              </div>

              {/* 24-Hour Day / Night Cycle */}
              <div className="mb-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="font-semibold tracking-wider text-white/80 uppercase">
                    Chu Kỳ Ngày / Đêm
                  </span>
                  <button
                    type="button"
                    onClick={() => engineRef.current?.setAutoCycle(!atm.autoCycle)}
                    className={`cursor-pointer rounded px-2 py-0.5 text-[10px] font-semibold transition ${
                      atm.autoCycle
                        ? "border border-emerald-400/30 bg-emerald-500/25 text-emerald-300"
                        : "bg-white/10 text-white/70"
                    }`}
                  >
                    {atm.autoCycle ? "Tự động: BẬT" : "Tự động: TẮT"}
                  </button>
                </div>
                <input
                  type="range"
                  min={0}
                  max={23.95}
                  step={0.05}
                  value={atm.timeOfDay}
                  onChange={(e) => {
                    engineRef.current?.setAutoCycle(false);
                    engineRef.current?.setTimeOfDay(parseFloat(e.target.value));
                  }}
                  className="w-full accent-amber-400"
                />
                <div className="mt-1.5 grid grid-cols-4 gap-1">
                  {[
                    { label: "Bình Minh", h: 6.0 },
                    { label: "Trưa", h: 12.5 },
                    { label: "Hoàng Hôn", h: 17.75 },
                    { label: "Đêm", h: 22.15 },
                  ].map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => {
                        engineRef.current?.setAutoCycle(false);
                        engineRef.current?.setTimeOfDay(t.h);
                      }}
                      className="cursor-pointer rounded bg-white/10 py-1 text-[10px] font-medium text-white/85 transition hover:bg-amber-400/25 hover:text-amber-200"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Tropical Weather */}
              <div className="mb-3 border-t border-white/10 pt-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="font-semibold tracking-wider text-white/80 uppercase">
                    Thời Tiết Nhiệt Đới
                  </span>
                  <span className="text-[10px] text-sky-300">
                    Ẩm {Math.round(atm.wetness * 100)}% · Gió {Math.round(atm.windStrength * 100)}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {WEATHER_LABELS.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => engineRef.current?.setWeather(w.id)}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border px-2 py-1.5 text-[11px] font-medium transition ${
                        atm.weather === w.id
                          ? "border-sky-400/60 bg-sky-500/25 text-sky-100"
                          : "border-white/10 bg-white/5 text-white/75 hover:bg-white/15"
                      }`}
                    >
                      <span>{w.label}</span>
                      <span className="rounded bg-black/40 px-1 text-[9px] text-white/50">{w.badge}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Seamless Open-World Landmarks */}
              <div className="border-t border-white/10 pt-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="font-semibold tracking-wider text-white/80 uppercase">
                    Địa Điểm Liền Mạch
                  </span>
                  <button
                    type="button"
                    onClick={() => engineRef.current?.toggleDoor()}
                    className="cursor-pointer rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200 hover:bg-amber-500/35"
                  >
                    {snap.doorOpen ? "Đóng Cửa 6.07" : "Mở Cửa 6.07"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {WAYPOINTS.map((wp) => (
                    <button
                      key={wp.id}
                      type="button"
                      onClick={() => engineRef.current?.moveToWaypoint(wp.id)}
                      className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-left text-[11px] text-white/85 transition hover:border-amber-400/50 hover:bg-amber-400/15"
                    >
                      {wp.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom-Left: Quiet Frameless Controls Rail (matches Chapter 1 PrologueHud language) */}
      {snap && !inDialogue && (
        <div className="pointer-events-none fixed bottom-4 left-4 z-10 hidden items-center gap-4 font-menu text-xs font-semibold uppercase tracking-[0.14em] text-zinc-300/65 [text-shadow:0_1px_8px_rgba(0,0,0,0.88)] sm:flex">
          <span className="flex items-center gap-1.5">
            <kbd className="border border-white/25 bg-black/45 px-1.5 py-0.5 text-[11px] text-zinc-100">WASD</kbd>
            Di chuyển
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="border border-white/25 bg-black/45 px-1.5 py-0.5 text-[11px] text-zinc-100">Shift</kbd>
            Chạy
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="border border-white/25 bg-black/45 px-1.5 py-0.5 text-[11px] text-zinc-100">E</kbd>
            Tương tác
          </span>
        </div>
      )}

      {/* Unified Tactile Action Prompt (ZERO raw "[E]" brackets!) */}
      {snap?.prompt && !snap.activeModal && !inDialogue && (
        <StreetActionPrompt prompt={snap.prompt} bottomClass="bottom-24" />
      )}

      {/* Cinema-grade GTA-6 / RDR2 Diegetic Subtitles, Crowd Bump Whispers & Borderless Replies */}
      {!snap?.activeModal && (
        <CinemaNpcHud
          language="vi"
          dialogue={snap?.storyDialogue ?? null}
          ambientBark={snap?.ambientBark ?? null}
          crowdReaction={snap?.crowdReaction ?? null}
          onSelectReply={(idx) => engineRef.current?.selectStoryReply(idx)}
          onCloseDialogue={() => engineRef.current?.closeStoryDialogue()}
        />
      )}

      {/* Room 6.07 Authentic Smartphone Message Modal */}
      {snap?.activeModal === "phone" && (
        <div
          onClick={() => engineRef.current?.closeModal()}
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-80 rounded-3xl border border-white/20 bg-slate-900/95 p-5 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between text-xs text-white/55">
              <span>Phòng 6.07 · Tin nhắn mới</span>
              <span>{formatClock(snap.atmosphere.timeOfDay)}</span>
            </div>
            <div className="rounded-2xl bg-slate-800/90 p-4 text-sm leading-relaxed text-white/95">
              <div className="mb-1 text-xs font-semibold text-amber-300">Mẹ</div>
              “Trời Sài Gòn vừa tạnh mưa rồi đó con. Có ra ngoài bắt xe buýt hay đi dạo quanh khu trọ thì nhớ mang theo áo khoác kẻo lạnh nha.”
            </div>
            <button
              type="button"
              onClick={() => engineRef.current?.closeModal()}
              className="mt-4 w-full cursor-pointer rounded-xl bg-white/10 py-2 text-xs font-semibold text-white hover:bg-white/20"
            >
              Đóng điện thoại (E / Esc)
            </button>
          </div>
        </div>
      )}

      {/* Room 6.07 Authentic Handwritten Note Modal */}
      {snap?.activeModal === "note" && (
        <div
          onClick={() => engineRef.current?.closeModal()}
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ fontFamily: "'Patrick Hand', cursive" }}
            className="w-80 -rotate-1 rounded-md border border-amber-300/40 bg-[#f6e8b8] p-6 text-lg leading-relaxed text-slate-800 shadow-2xl"
          >
            <div className="mb-2 text-xl font-bold text-slate-900">Ghi chú — Phòng 6.07</div>
            <p>- Tiền trọ 462/14 Lý Thái Tổ: đóng trước ngày 5</p>
            <p>- Ra Hẻm 462/14 bắt xe Buýt Tuyến 06</p>
            <p>- Rẽ Đường 3/2 đi thẳng ra Bitexco Quận 1</p>
            <p>- Đi dọc bờ sông lên Công viên Landmark 81</p>
            <button
              type="button"
              onClick={() => engineRef.current?.closeModal()}
              className="mt-4 w-full cursor-pointer rounded bg-slate-800/15 py-1.5 font-sans text-xs font-semibold text-slate-800 hover:bg-slate-800/25"
            >
              Gấp tờ giấy lại (E / Esc)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
