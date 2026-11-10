import { useEffect, useRef, useState, useCallback } from "react";

export interface PlayerControlsState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jump: boolean;
  punch: boolean;
  inspect: boolean;
}

export function usePlayerControls(domElementRef?: React.RefObject<HTMLElement | null>) {
  const [isLocked, setIsLocked] = useState(false);

  // Mutable refs for high-frequency 60 FPS animation/physics without React re-render lag
  const keysRef = useRef<PlayerControlsState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jump: false,
    punch: false,
    inspect: false,
  });

  const mouseMovementRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const punchTriggerRef = useRef(false);
  const inspectTriggerRef = useRef(false);

  const lockPointer = useCallback(() => {
    const el = domElementRef?.current || document.body;
    try {
      if (document.pointerLockElement !== el) {
        el.requestPointerLock?.();
      }
    } catch (e) {
      console.warn("Pointer lock request error:", e);
    }
  }, [domElementRef]);

  const unlockPointer = useCallback(() => {
    try {
      if (document.pointerLockElement) {
        document.exitPointerLock();
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
      console.warn("Pointer lock error event:", err);
      setIsLocked(false);
    };

    document.addEventListener("pointerlockchange", handlePointerLockChange);
    document.addEventListener("pointerlockerror", handlePointerLockError);

    return () => {
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      document.removeEventListener("pointerlockerror", handlePointerLockError);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl key: toggle pointer lock (show/hide mouse cursor)
      if (e.code === "ControlLeft" || e.code === "ControlRight" || e.key === "Control") {
        e.preventDefault();
        togglePointerLock();
        return;
      }

      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          keysRef.current.forward = true;
          break;
        case "KeyS":
        case "ArrowDown":
          keysRef.current.backward = true;
          break;
        case "KeyA":
          keysRef.current.left = true;
          break;
        case "KeyD":
          keysRef.current.right = true;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          keysRef.current.sprint = true;
          break;
        case "Space":
          e.preventDefault();
          keysRef.current.jump = true;
          break;
        // Mac Trackpad alternative keys for punch: F or E
        case "KeyF":
        case "KeyE":
          if (!e.repeat) {
            keysRef.current.punch = true;
            punchTriggerRef.current = true;
          }
          break;
        // Inspect animation: T or I
        case "KeyT":
        case "KeyI":
          if (!e.repeat) {
            keysRef.current.inspect = true;
            inspectTriggerRef.current = true;
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          keysRef.current.forward = false;
          break;
        case "KeyS":
        case "ArrowDown":
          keysRef.current.backward = false;
          break;
        case "KeyA":
          keysRef.current.left = false;
          break;
        case "KeyD":
          keysRef.current.right = false;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          keysRef.current.sprint = false;
          break;
        case "Space":
          keysRef.current.jump = false;
          break;
        case "KeyF":
        case "KeyE":
          keysRef.current.punch = false;
          break;
        case "KeyT":
        case "KeyI":
          keysRef.current.inspect = false;
          break;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Accumulate mouse deltas when locked
      if (document.pointerLockElement) {
        mouseMovementRef.current.x += e.movementX;
        mouseMovementRef.current.y += e.movementY;
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Left Click = Punch (only once pointer is locked; first click only acquires lock)
      if (e.button === 0) {
        if (!document.pointerLockElement) {
          lockPointer();
        } else {
          keysRef.current.punch = true;
          punchTriggerRef.current = true;
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        keysRef.current.punch = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [lockPointer, togglePointerLock]);

  // Method for animation loop to consume and clear accumulated mouse movement
  const consumeMovement = useCallback(() => {
    const movement = { ...mouseMovementRef.current };
    mouseMovementRef.current.x = 0;
    mouseMovementRef.current.y = 0;
    return movement;
  }, []);

  // Method to check and consume a one-shot punch trigger
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

  return {
    keysRef,
    isLocked,
    lockPointer,
    unlockPointer,
    togglePointerLock,
    consumeMovement,
    consumePunchTrigger,
    consumeInspectTrigger,
  };
}
