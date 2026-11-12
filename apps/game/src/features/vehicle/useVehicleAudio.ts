import { useCallback, useEffect, useRef } from "react";
import { VehicleAudio, DEFAULT_VEHICLE_SOUNDS, type VehicleAudioOptions } from "./vehicleAudio";

/** React wrapper around `VehicleAudio` for the R3F maps; same API as before. */
export function useVehicleAudio({
  enabled = true,
  volume = 1.5,
  doorSoundPath = DEFAULT_VEHICLE_SOUNDS.doorSoundPath,
  driveSoundPath = DEFAULT_VEHICLE_SOUNDS.driveSoundPath,
  stopSoundPath = DEFAULT_VEHICLE_SOUNDS.stopSoundPath,
  stopCarSoundPath = DEFAULT_VEHICLE_SOUNDS.stopCarSoundPath,
  indicatorSoundPath = DEFAULT_VEHICLE_SOUNDS.indicatorSoundPath,
}: VehicleAudioOptions) {
  const audioRef = useRef<VehicleAudio | null>(null);

  useEffect(() => {
    const audio = new VehicleAudio({
      doorSoundPath,
      driveSoundPath,
      stopSoundPath,
      stopCarSoundPath,
      indicatorSoundPath,
    });
    audioRef.current = audio;
    return () => {
      audio.dispose();
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, [doorSoundPath, driveSoundPath, stopSoundPath, stopCarSoundPath, indicatorSoundPath]);

  // Settings are read at play time, as before.
  const audio = audioRef.current;
  if (audio) {
    audio.enabled = enabled;
    audio.volume = volume;
  }
  const sync = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.enabled = enabled;
      a.volume = volume;
    }
    return a;
  }, [enabled, volume]);

  const playDoorSound = useCallback(
    (onEnded?: () => void) => {
      const a = sync();
      if (a) a.playDoorSound(onEnded);
      else onEnded?.();
    },
    [sync],
  );
  const playStartSound = useCallback(
    (onEnded?: () => void) => {
      const a = sync();
      if (a) a.playStartSound(onEnded);
      else onEnded?.();
    },
    [sync],
  );
  const playDriveSound = useCallback((speed: number) => sync()?.playDriveSound(speed), [sync]);
  const playStopSound = useCallback(() => sync()?.playStopSound(), [sync]);
  const playStopCarSound = useCallback(() => sync()?.playStopCarSound(), [sync]);
  const setIndicator = useCallback((on: boolean) => sync()?.setIndicator(on), [sync]);
  const stopAll = useCallback(() => audioRef.current?.stopAll(), []);

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
