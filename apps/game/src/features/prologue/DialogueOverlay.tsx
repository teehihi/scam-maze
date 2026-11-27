import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { createWheelStepper } from "../../components/ui/wheelStep";
import { KEYCAP, SHADOW, stop } from "./PrologueHud";
import { lineKey, optionKey, visibleOptions, type DialogueGraph, type DialogueState } from "./quest/dialogue";

const ICON_CHAT = "/assets/ui/hud/scammaze-chat-icon-512.png";
const ICON_MOUSE = "/assets/ui/hud/mouse.webp";

export interface DialogueOverlayProps {
  graph: DialogueGraph;
  state: DialogueState;
  /** Name shown over the line, already translated. */
  speaker: string;
  onChoose: (optionId: string) => void;
  /** Move on from a line that has no replies. */
  onAdvance: () => void;
  /** Leave the conversation early (Escape). */
  onClose: () => void;
  onHoverSound?: () => void;
}

/**
 * Street conversation in the style of an action game: a dark band at the bottom with the speaker's
 * name and line, and the player's replies as a separate list on the right. The highlighted reply
 * shows the F key and a pointer that slides gently. A line with no replies shows "continue".
 *
 * Keys: Up and Down (or the mouse wheel / trackpad scroll) move the highlight, with the hover sound; F picks the highlighted reply (or continues); Escape leaves. A click anywhere continues a line without replies.
 */
export const DialogueOverlay: React.FC<DialogueOverlayProps> = ({ graph, state, speaker, onChoose, onAdvance, onClose, onHoverSound }) => {
  const { t } = useTranslation("worlds");
  const text = (key: string) => (t as unknown as (k: string) => string)(key.replace(/^worlds:/, ""));
  const options = visibleOptions(graph, state);
  const [active, setActive] = useState(0);
  const lastNode = useRef<string | null>(null);
  const first = useRef<HTMLButtonElement | null>(null);
  const node = state.node;

  // Moves the highlight by one reply and plays the hover sound.
  const move = useCallback(
    (delta: number) => {
      if (options.length < 2) return;
      setActive((i) => (i + delta + options.length) % options.length);
      onHoverSound?.();
    },
    [options.length, onHoverSound],
  );

  // Wheel or trackpad: one swipe is one step (see `createWheelStepper`).
  const stepper = useRef(createWheelStepper());
  const onWheel = (event: React.WheelEvent) => {
    const step = stepper.current(event.deltaY, event.deltaMode, performance.now());
    if (step !== 0) move(step);
  };

  // A new line starts with the first reply highlighted.
  useEffect(() => {
    if (lastNode.current !== node) {
      lastNode.current = node;
      setActive(0);
    }
    first.current?.focus({ preventScroll: true });
  }, [node]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      const confirm = event.code === "KeyF";
      if (options.length === 0) {
        if (confirm) {
          event.preventDefault();
          onAdvance();
        }
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        move(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        move(-1);
      } else if (confirm) {
        event.preventDefault();
        onChoose(options[Math.min(active, options.length - 1)].id);
      }
    };
    // Capture phase: the page's own Escape handling must not also open the pause menu.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [options, active, move, onChoose, onAdvance, onClose]);

  if (node === null) return null;
  const line = text(lineKey(graph, node));

  return (
    <div className="absolute inset-0 z-[64] select-none" onMouseDown={stop} onWheel={onWheel} onClick={(event) => {
      stop(event);
      // A line with no replies: a click anywhere moves on.
      if (options.length === 0) onAdvance();
    }}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-black/85 via-black/55 to-transparent" />
      {options.length > 0 && (
        <ul aria-label={text("quests.dialogue.replies")} className="absolute bottom-[26%] right-[clamp(1rem,7vw,8rem)] flex w-full max-w-md flex-col items-stretch gap-2">
          {options.map((option, index) => {
            const on = index === active;
            return (
              <li key={option.id} className="flex items-center gap-2">
                <span aria-hidden="true" className={`flex shrink-0 items-center gap-1.5 transition-opacity duration-300 ${on ? "opacity-100" : "opacity-0"}`}>
                  {options.length > 1 && <img src={ICON_MOUSE} alt="" width={20} height={32} draggable={false} className="h-8 w-5 shrink-0 opacity-85" />}
                  <kbd className={`${KEYCAP} !bg-white !text-[#171521]`}>F</kbd>
                  <span className="dialogue-nudge text-sm leading-none text-white">&#9654;</span>
                </span>
                <button
                  ref={index === 0 ? first : undefined}
                  type="button"
                  onClick={() => onChoose(option.id)}
                  onPointerEnter={() => {
                    if (!on) onHoverSound?.();
                    setActive(index);
                  }}
                  className={`relative flex min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-full border px-4 py-2 text-left outline-none transition-colors duration-200 delay-100 cursor-pointer ${on ? "border-white/80 text-[#171521]" : "border-white/30 bg-black/55 text-zinc-100"}`}
                >
                  {/* The highlight sweeps in from the left; on the way out it just fades. */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 origin-left bg-white/90"
                    style={{
                      transform: on ? "scaleX(1)" : "scaleX(0)",
                      opacity: on ? 1 : 0,
                      transition: on ? "transform 380ms cubic-bezier(0.22,1,0.36,1), opacity 120ms" : "opacity 220ms ease-out, transform 0s linear 220ms",
                    }}
                  />
                  <img src={ICON_CHAT} alt="" width={22} height={22} draggable={false} className={`relative h-[22px] w-[22px] shrink-0 transition-[filter] duration-300 ${on ? "invert" : ""}`} />
                  <span className="relative text-base font-medium leading-snug">{text(optionKey(graph, option.id))}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div role="dialog" aria-labelledby="dialogue-speaker" aria-describedby="dialogue-line" className="absolute inset-x-0 bottom-0 px-[clamp(1rem,8vw,9rem)] pb-[clamp(1.5rem,6vh,4rem)]">
        <div className={`mx-auto max-w-4xl ${SHADOW}`}>
          <p id="dialogue-speaker" className="font-menu text-2xl font-bold uppercase tracking-[0.08em] text-[#b9a5f5]">
            {speaker}
          </p>
          <div aria-hidden="true" className="mt-1 h-px w-full bg-gradient-to-r from-[#b9a5f5]/80 via-[#b9a5f5]/30 to-transparent" />
          <p id="dialogue-line" aria-live="polite" className="mt-2 text-xl leading-relaxed text-[#f3efe4]">
            {line}
          </p>
          {options.length === 0 && (
            <p className="mt-3 font-menu text-sm font-semibold uppercase tracking-[0.14em] text-zinc-200">
              {text("quests.dialogue.continue")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
