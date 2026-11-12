import { useEffect, useRef } from "react";
import type { ChapterStore } from "../../../game/narrative/store";
import type { WebAudioEngine } from "../../../game/voice/webAudioEngine";
import { useChapterState } from "../useChapterState";

/**
 * Non-speech call sounds: ringtone, connect click, room ambience and the tension drone.
 * Presentation only: it reads the chapter state and never changes it.
 *
 * The engine is shared with `useVoicePlayback` (one `webAudioEngine` per chapter page, owned by
 * the page), so it is passed in. A null engine (no audio support, tests) makes every effect a no-op.
 */

export interface CallAudioOptions {
  store: ChapterStore;
  engine: WebAudioEngine | null;
  /** True while the pause menu is on top: all call sounds stop and resume afterwards. */
  paused: boolean;
  reducedStress: boolean;
  /** Master gain 0..1: the sfx volume, 0 when sound is off. */
  masterGain: number;
}

export function useCallAudio({
  store,
  engine,
  paused,
  reducedStress,
  masterGain,
}: CallAudioOptions): void {
  const status = useChapterState(store, (s) => s.call.status);
  const callId = useChapterState(store, (s) => s.call.current);
  const pressure = useChapterState(store, (s) => s.pressure);

  const ringing = status === "ringing";
  const active = status === "active";

  // Master gain follows the sfx volume.
  useEffect(() => {
    engine?.setMasterGain(Math.min(1, Math.max(0, masterGain)));
  }, [engine, masterGain]);

  // Ringtone only while ringing and not paused.
  useEffect(() => {
    if (!engine || paused || !ringing) return undefined;
    engine.startRingtone(reducedStress);
    return () => engine.stopRingtone();
  }, [engine, paused, ringing, reducedStress]);

  // Connect click once per call, when it becomes active (not again after a pause).
  const clickedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!active) {
      clickedFor.current = null;
      return;
    }
    if (!engine || paused) return;
    const key = callId ?? "call";
    if (clickedFor.current === key) return;
    clickedFor.current = key;
    engine.playConnectClick();
  }, [engine, paused, active, callId]);

  // Room ambience while the chapter runs; quieter during a call.
  useEffect(() => {
    if (!engine || paused) return undefined;
    engine.startAmbience(active);
    return () => engine.stopAmbience();
    // `active` is applied by the next effect so a call start does not restart the ambience.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, paused]);
  useEffect(() => {
    if (!engine || paused) return;
    engine.setAmbienceInCall(active);
  }, [engine, paused, active]);

  // Tension from pressure while a call is active, 0 otherwise.
  useEffect(() => {
    if (!engine) return undefined;
    engine.setTension(active && !paused ? pressure : 0, reducedStress);
    return undefined;
  }, [engine, paused, active, pressure, reducedStress]);

  // Everything stops on unmount or when the engine is replaced.
  useEffect(() => {
    if (!engine) return undefined;
    return () => {
      engine.stopRingtone();
      engine.stopAmbience();
      engine.setTension(0, true);
    };
  }, [engine]);
}
