import { useEffect, useRef, useCallback } from "react";

interface VehicleAudioProps {
  enabled?: boolean;
  volume?: number;
  doorSoundPath?: string;
  driveSoundPath?: string;
  stopSoundPath?: string;
  stopCarSoundPath?: string;
  indicatorSoundPath?: string;
}

/**
 * Loudness of the vehicle sounds relative to the SFX volume setting (about +5 dB).
 * Gains may exceed 1; the output limiter below keeps the mix from clipping.
 */
const VEHICLE_GAIN_BOOST = 1.8;
const MAX_VEHICLE_GAIN = 2.0;
const vehicleGain = (base: number, volume: number) => Math.min(MAX_VEHICLE_GAIN, base * volume * VEHICLE_GAIN_BOOST);

export function useVehicleAudio({
  enabled = true,
  volume = 1.5,
  doorSoundPath = "/assets/audio/closedoorlx.mp3",
  driveSoundPath = "/assets/audio/drive.wav",
  stopSoundPath = "/assets/audio/stop.mp3",
  stopCarSoundPath = "/assets/audio/stopCar.mp3",
  indicatorSoundPath = "/assets/audio/indicator.mp3",
}: VehicleAudioProps) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  /** Every vehicle sound goes through this limiter before reaching the speakers. */
  const outputRef = useRef<AudioNode | null>(null);

  // Audio buffers pre-decoded in memory
  const doorBufferRef = useRef<AudioBuffer | null>(null);
  const driveBufferRef = useRef<AudioBuffer | null>(null);
  const stopBufferRef = useRef<AudioBuffer | null>(null);
  const stopCarBufferRef = useRef<AudioBuffer | null>(null);
  const indicatorBufferRef = useRef<AudioBuffer | null>(null);

  // Active audio source nodes
  const doorSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const doorGainRef = useRef<GainNode | null>(null);
  const startSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startGainRef = useRef<GainNode | null>(null);
  const driveSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const driveGainRef = useRef<GainNode | null>(null);
  const stopSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const stopGainRef = useRef<GainNode | null>(null);
  const indicatorSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const indicatorGainRef = useRef<GainNode | null>(null);

  // Track state to avoid redundant restarts
  const isDrivingSoundActiveRef = useRef(false);

  const initAudio = useCallback(() => {
    if (audioCtxRef.current) return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    limiter.connect(ctx.destination);
    audioCtxRef.current = ctx;
    outputRef.current = limiter;
  }, []);

  // Pre-load and decode all sound files on mount
  useEffect(() => {
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    fetch(doorSoundPath)
      .then((res) => res.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .then((decoded) => {
        doorBufferRef.current = decoded;
      })
      .catch((err) => console.warn("Failed to load car door sound:", err));

    fetch(driveSoundPath)
      .then((res) => res.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .then((decoded) => {
        driveBufferRef.current = decoded;
      })
      .catch((err) => console.warn("Failed to load car drive sound:", err));

    fetch(stopSoundPath)
      .then((res) => res.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .then((decoded) => {
        stopBufferRef.current = decoded;
      })
      .catch((err) => console.warn("Failed to load car stop sound:", err));

    fetch(stopCarSoundPath)
      .then((res) => res.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .then((decoded) => {
        stopCarBufferRef.current = decoded;
      })
      .catch((err) => console.warn("Failed to load car stopCar sound:", err));
    fetch(indicatorSoundPath)
      .then((res) => res.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .then((decoded) => {
        indicatorBufferRef.current = decoded;
      })
      .catch((err) => console.warn("Failed to load turn signal sound:", err));

    return () => {
      ctx.close().catch(() => {});
      audioCtxRef.current = null;
      outputRef.current = null;
      indicatorSourceRef.current = null;
      indicatorGainRef.current = null;
    };
  }, [doorSoundPath, driveSoundPath, stopSoundPath, stopCarSoundPath, indicatorSoundPath, initAudio]);

  /** Play car door close sound on enter. Calls onEnded when complete */
  const playDoorSound = useCallback(
    (onEnded?: () => void) => {
      if (!enabled) {
        onEnded?.();
        return;
      }
      initAudio();
      const ctx = audioCtxRef.current;
      const buffer = doorBufferRef.current;
      if (!ctx || !buffer) {
        onEnded?.();
        return;
      }

      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vehicleGain(0.9, volume), ctx.currentTime);

      source.connect(gain);
      gain.connect(outputRef.current ?? ctx.destination);

      let endedCalled = false;
      const handleEnded = () => {
        if (!endedCalled) {
          endedCalled = true;
          onEnded?.();
        }
      };

      source.onended = handleEnded;
      const fallbackMs = Math.max(500, Math.floor(buffer.duration * 1000));
      const fallbackTimer = setTimeout(handleEnded, fallbackMs + 100);

      source.start(0);
      doorSourceRef.current = source;
      doorGainRef.current = gain;

      return () => clearTimeout(fallbackTimer);
    },
    [enabled, volume, initAudio]
  );

  /** Play start ignition sound on entering car. Calls onEnded when complete */
  const playStartSound = useCallback(
    (onEnded?: () => void) => {
      if (!enabled) {
        onEnded?.();
        return;
      }
      initAudio();
      const ctx = audioCtxRef.current;
      const buffer = driveBufferRef.current;
      if (!ctx || !buffer) {
        // Audio not yet decoded; fallback timer so gameplay proceeds
        const timer = setTimeout(() => onEnded?.(), 2000);
        return () => clearTimeout(timer);
      }

      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      if (startSourceRef.current) {
        try {
          startSourceRef.current.stop();
          startSourceRef.current.disconnect();
        } catch {}
        startSourceRef.current = null;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = false;
      source.playbackRate.setValueAtTime(1.0, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vehicleGain(0.9, volume), ctx.currentTime);

      source.connect(gain);
      gain.connect(outputRef.current ?? ctx.destination);

      let endedCalled = false;
      const handleEnded = () => {
        if (!endedCalled) {
          endedCalled = true;
          onEnded?.();
        }
      };

      source.onended = handleEnded;
      const fallbackMs = Math.max(500, Math.floor(buffer.duration * 1000));
      const fallbackTimer = setTimeout(handleEnded, fallbackMs + 100);

      source.start(0);
      startSourceRef.current = source;
      startGainRef.current = gain;

      return () => clearTimeout(fallbackTimer);
    },
    [enabled, volume, initAudio]
  );

  /** Play stopCar sound on exiting vehicle */
  const playStopCarSound = useCallback(() => {
    if (!enabled) return;
    initAudio();
    const ctx = audioCtxRef.current;
    const buffer = stopCarBufferRef.current;
    if (!ctx || !buffer) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vehicleGain(0.95, volume), ctx.currentTime);

    source.connect(gain);
    gain.connect(outputRef.current ?? ctx.destination);
    source.start(0);
  }, [enabled, volume, initAudio]);

  /** Play drive sound when accelerating forward/backward */
  const playDriveSound = useCallback(
    (speed: number) => {
      if (!enabled) return;
      initAudio();
      const ctx = audioCtxRef.current;
      const buffer = driveBufferRef.current;
      if (!ctx || !buffer) return;

      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      // If already playing drive sound, update playback pitch according to speed
      if (isDrivingSoundActiveRef.current && driveSourceRef.current) {
        const absSpeed = Math.abs(speed);
        const pitch = 0.95 + Math.min(0.4, (absSpeed / 18.0) * 0.35);
        driveSourceRef.current.playbackRate.setValueAtTime(pitch, ctx.currentTime);
        return;
      }

      // If stop sound is active, fade it out quickly
      if (stopSourceRef.current && stopGainRef.current) {
        const now = ctx.currentTime;
        stopGainRef.current.gain.linearRampToValueAtTime(0.001, now + 0.1);
        const prevStop = stopSourceRef.current;
        setTimeout(() => {
          try {
            prevStop.stop();
            prevStop.disconnect();
          } catch {}
        }, 120);
        stopSourceRef.current = null;
        stopGainRef.current = null;
      }

      // Create drive sound loop
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.playbackRate.setValueAtTime(1.0, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(vehicleGain(0.85, volume), ctx.currentTime + 0.15);

      source.connect(gain);
      gain.connect(outputRef.current ?? ctx.destination);
      source.start(0);

      driveSourceRef.current = source;
      driveGainRef.current = gain;
      isDrivingSoundActiveRef.current = true;
    },
    [enabled, volume, initAudio]
  );

  /** Play stop sound when gas is released */
  const playStopSound = useCallback(() => {
    if (!enabled) return;
    initAudio();
    const ctx = audioCtxRef.current;
    const buffer = stopBufferRef.current;
    if (!ctx || !buffer) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    // Stop drive sound if active
    if (driveSourceRef.current && driveGainRef.current) {
      const now = ctx.currentTime;
      driveGainRef.current.gain.linearRampToValueAtTime(0.001, now + 0.15);
      const prevDrive = driveSourceRef.current;
      setTimeout(() => {
        try {
          prevDrive.stop();
          prevDrive.disconnect();
        } catch {}
      }, 180);
      driveSourceRef.current = null;
      driveGainRef.current = null;
    }
    isDrivingSoundActiveRef.current = false;

    // Start stop sound
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = false;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vehicleGain(0.85, volume), ctx.currentTime + 0.12);

    source.connect(gain);
    gain.connect(outputRef.current ?? ctx.destination);
    source.start(0);

    stopSourceRef.current = source;
    stopGainRef.current = gain;
  }, [enabled, volume, initAudio]);

  /** Turn signal ticking: loops from the start while on, fades out when switched off. */
  const setIndicator = useCallback(
    (on: boolean) => {
      const ctx = audioCtxRef.current;
      if (!on) {
        const source = indicatorSourceRef.current;
        const gain = indicatorGainRef.current;
        indicatorSourceRef.current = null;
        indicatorGainRef.current = null;
        if (ctx && source && gain) {
          gain.gain.cancelScheduledValues(ctx.currentTime);
          gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.08);
          setTimeout(() => {
            try {
              source.stop();
              source.disconnect();
            } catch {}
          }, 120);
        }
        return;
      }
      if (!enabled || indicatorSourceRef.current) return;
      initAudio();
      const buffer = indicatorBufferRef.current;
      const liveCtx = audioCtxRef.current;
      if (!liveCtx || !buffer) return;
      if (liveCtx.state === "suspended") liveCtx.resume().catch(() => {});
      const source = liveCtx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = liveCtx.createGain();
      gain.gain.setValueAtTime(0.001, liveCtx.currentTime);
      gain.gain.linearRampToValueAtTime(vehicleGain(0.7, volume), liveCtx.currentTime + 0.05);
      source.connect(gain);
      gain.connect(outputRef.current ?? liveCtx.destination);
      source.start(0);
      indicatorSourceRef.current = source;
      indicatorGainRef.current = gain;
    },
    [enabled, volume, initAudio],
  );

  /** Stop all driving/stop audio loops (called on exit) */
  const stopAll = useCallback(() => {
    isDrivingSoundActiveRef.current = false;
    setIndicator(false);
    const ctx = audioCtxRef.current;
    if (ctx) {
      const now = ctx.currentTime;
      if (doorGainRef.current) {
        doorGainRef.current.gain.linearRampToValueAtTime(0.001, now + 0.08);
      }
      if (startGainRef.current) {
        startGainRef.current.gain.linearRampToValueAtTime(0.001, now + 0.08);
      }
      if (driveGainRef.current) {
        driveGainRef.current.gain.linearRampToValueAtTime(0.001, now + 0.08);
      }
      if (stopGainRef.current) {
        stopGainRef.current.gain.linearRampToValueAtTime(0.001, now + 0.08);
      }
      setTimeout(() => {
        try {
          doorSourceRef.current?.stop();
          doorSourceRef.current?.disconnect();
          startSourceRef.current?.stop();
          startSourceRef.current?.disconnect();
          driveSourceRef.current?.stop();
          driveSourceRef.current?.disconnect();
          stopSourceRef.current?.stop();
          stopSourceRef.current?.disconnect();
        } catch {}
        doorSourceRef.current = null;
        doorGainRef.current = null;
        startSourceRef.current = null;
        startGainRef.current = null;
        driveSourceRef.current = null;
        driveGainRef.current = null;
        stopSourceRef.current = null;
        stopGainRef.current = null;
      }, 100);
    }
  }, [setIndicator]);

  return {
    playDoorSound,
    playStartSound,
    playDriveSound,
    playStopSound,
    playStopCarSound,
    setIndicator,
    stopAll,
  };
}
