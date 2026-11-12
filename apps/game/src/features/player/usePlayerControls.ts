import { useEffect, useRef, useState, useCallback } from "react";
import type { PlayerControlsState } from "./types";

export interface PlayerControlsOptions {
  /**
   * When false, gameplay input is paused: keys and triggers are cleared once, pointer lock is
   * released, and keyboard, mouse move, mouse down and Ctrl are ignored. Defaults to true.
   */
  enabled?: boolean;
}

export function usePlayerControls(
  _domElementRef?: React.RefObject<HTMLElement | null>,
  options: PlayerControlsOptions = {}
) {
  const enabled = options.enabled ?? true;
  const [isLocked, setIsLocked] = useState(false);

  // Read by the event handlers so toggling does not re-register listeners
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // High-frequency 60 FPS mutable input state
  const keysRef = useRef<PlayerControlsState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jump: false,
    punch: false,
    block: false,
    inspect: false,
    interact: false,
  });

  const mouseMovementRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const punchTriggerRef = useRef(false);
  const inspectTriggerRef = useRef(false);
  const interactTriggerRef = useRef(false);

  const lockPointer = useCallback(() => {
    try {
      if (document.pointerLockElement !== document.body) {
        document.body.requestPointerLock?.();
      }
    } catch (e) {
      console.warn("Pointer lock request error:", e);
    }
  }, []);

  const unlockPointer = useCallback(() => {
    try {
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    } catch (e) {
      console.warn("Pointer unlock error:", e);
    }
  }, []);

  const togglePointerLock = useCallback(() => {
    if (document.pointerLockElement) {
      unlockPointer();
    } else {
      lockPointer();
    }
  }, [lockPointer, unlockPointer]);

  useEffect(() => {
    const handlePointerLockChange = () => {
      const locked = Boolean(document.pointerLockElement);
      setIsLocked(locked);
    };

    const handlePointerLockError = (err: Event) => {
      console.warn("Pointer lock error:", err);
      setIsLocked(false);
    };

    const handleBlur = () => {
      // Clear movement keys only when browser window loses focus
      keysRef.current.forward = false;
      keysRef.current.backward = false;
      keysRef.current.left = false;
      keysRef.current.right = false;
      keysRef.current.sprint = false;
      keysRef.current.jump = false;
      keysRef.current.punch = false;
      keysRef.current.block = false;
      keysRef.current.inspect = false;
      keysRef.current.interact = false;
    };

    document.addEventListener("pointerlockchange", handlePointerLockChange);
    document.addEventListener("pointerlockerror", handlePointerLockError);
    window.addEventListener("blur", handleBlur);

    return () => {
      if (document.pointerLockElement) {
        try {
          document.exitPointerLock?.();
        } catch {
          // Guard
        }
      }
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      document.removeEventListener("pointerlockerror", handlePointerLockError);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // Pause transition: clear held input once and release the pointer
  useEffect(() => {
    if (enabled) return;
    const keys = keysRef.current;
    (Object.keys(keys) as (keyof PlayerControlsState)[]).forEach((k) => {
      keys[k] = false;
    });
    mouseMovementRef.current.x = 0;
    mouseMovementRef.current.y = 0;
    punchTriggerRef.current = false;
    inspectTriggerRef.current = false;
    interactTriggerRef.current = false;
    unlockPointer();
  }, [enabled, unlockPointer]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!enabledRef.current) {
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Toggle cursor lock with Ctrl key
      if (e.key === "Control" || e.code === "ControlLeft" || e.code === "ControlRight") {
        e.preventDefault();
        togglePointerLock();
        return;
      }

      const code = e.code;
      const key = e.key ? e.key.toLowerCase() : "";

      // Locomotion keys (supports standard QWERTY + Vietnamese Telex IME like 'ư')
      if (code === "KeyW" || code === "ArrowUp" || key === "w" || key === "ư") {
        keysRef.current.forward = true;
      } else if (code === "KeyS" || code === "ArrowDown" || key === "s") {
        keysRef.current.backward = true;
      } else if (code === "KeyA" || code === "ArrowLeft" || key === "a") {
        keysRef.current.left = true;
      } else if (code === "KeyD" || code === "ArrowRight" || key === "d") {
        keysRef.current.right = true;
      } else if (code === "ShiftLeft" || code === "ShiftRight" || key === "shift") {
        keysRef.current.sprint = true;
      } else if (code === "Space") {
        e.preventDefault();
        keysRef.current.jump = true;
      }

      // Punch alternative key: F (E removed per user instruction)
      else if (code === "KeyF" || key === "f") {
        if (!e.repeat) {
          keysRef.current.punch = true;
          punchTriggerRef.current = true;
        }
      }

      // Interaction key: E (interact with guitar, door, evidence)
      else if (code === "KeyE" || key === "e") {
        if (!e.repeat) {
          keysRef.current.interact = true;
          interactTriggerRef.current = true;
        }
      }

      // Inspect viewmodel arms: T or I
      else if (code === "KeyT" || code === "KeyI" || key === "t" || key === "i") {
        if (!e.repeat) {
          keysRef.current.inspect = true;
          inspectTriggerRef.current = true;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      const key = e.key ? e.key.toLowerCase() : "";

      if (code === "KeyW" || code === "ArrowUp" || key === "w" || key === "ư") {
        keysRef.current.forward = false;
      } else if (code === "KeyS" || code === "ArrowDown" || key === "s") {
        keysRef.current.backward = false;
      } else if (code === "KeyA" || code === "ArrowLeft" || key === "a") {
        keysRef.current.left = false;
      } else if (code === "KeyD" || code === "ArrowRight" || key === "d") {
        keysRef.current.right = false;
      } else if (code === "ShiftLeft" || code === "ShiftRight" || key === "shift") {
        keysRef.current.sprint = false;
      } else if (code === "Space") {
        keysRef.current.jump = false;
      } else if (code === "KeyF" || key === "f") {
        keysRef.current.punch = false;
      } else if (code === "KeyE" || key === "e") {
        keysRef.current.interact = false;
      } else if (code === "KeyT" || code === "KeyI" || key === "t" || key === "i") {
        keysRef.current.inspect = false;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (enabledRef.current && document.pointerLockElement) {
        mouseMovementRef.current.x += e.movementX;
        mouseMovementRef.current.y += e.movementY;
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!enabledRef.current) {
        return;
      }
      if (!document.pointerLockElement) {
        lockPointer();
        return;
      }

      if (e.button === 0) {
        // Left Click = Punch Strike & Combo
        keysRef.current.punch = true;
        punchTriggerRef.current = true;
      } else if (e.button === 2) {
        // Right Click = Defensive Guard / Block
        keysRef.current.block = true;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        keysRef.current.punch = false;
      } else if (e.button === 2) {
        keysRef.current.block = false;
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      // Prevent browser right-click context menu when pointer is locked or in game canvas
      if (document.pointerLockElement) {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("contextmenu", handleContextMenu);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [lockPointer, togglePointerLock]);

  const consumeMovement = useCallback(() => {
    const delta = { ...mouseMovementRef.current };
    mouseMovementRef.current.x = 0;
    mouseMovementRef.current.y = 0;
    return delta;
  }, []);

  const consumePunchTrigger = useCallback(() => {
    if (punchTriggerRef.current) {
      punchTriggerRef.current = false;
      return true;
    }
    return false;
  }, []);

  const consumeInspectTrigger = useCallback(() => {
    if (inspectTriggerRef.current) {
      inspectTriggerRef.current = false;
      return true;
    }
    return false;
  }, []);

  const consumeInteractTrigger = useCallback(() => {
    if (interactTriggerRef.current) {
      interactTriggerRef.current = false;
      return true;
    }
    return false;
  }, []);

  return {
    keysRef,
    isLocked,
    lockPointer,
    unlockPointer,
    togglePointerLock,
    consumeMovement,
    consumePunchTrigger,
    consumeInspectTrigger,
    consumeInteractTrigger,
  };
}
