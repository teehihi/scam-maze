// A phone call to a contact: it rings, the line picks up, the two sides take turns, and Alex ends
// the call. Each turn is a scenario action, so what Alex says, the time it costs and what it changes
// are recorded in the game state; this screen only presents them.
//   - Ringing and the first turn: the call is placed when the line picks up (not when the screen
//     opens), so a call that is ended while ringing changes nothing.
//   - The other side "speaks" with a short pause, and its line is played from a recorded clip when
//     there is one. The text is always shown as subtitles, in the language of the game.
//   - The turns Alex can take now are listed once the last line was shown. The answer to a turn is
//     never shown before the turn is taken.
//   - Ending the call stops the voice. Leaving the Calls app ends the call too; the lines already said
//     stay in the history of the contact.
import React, { useEffect, useRef, useState } from "react";
import { PhoneOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DeviceItemView } from "../../../../game/narrative/device";
import { useGameLocale } from "../../../../i18n/useGameLocale";
import { actionLabel, type Tx } from "../../device/deviceFormat";
import { LineListen } from "../../device/LineListen";
import { playLineVoice, stopLineVoice } from "../../device/lineVoice";
import { mission01LineVoiceUrl } from "../../voice/mission01Voice";
import { mission02VoiceUrl } from "../../voice/mission02Voice";
import { ChatAvatar } from "../messages/ChatThread";
import { clockLabel } from "../messages/chatModel";
import { useTypingReveal } from "../messages/useTypingReveal";
import { PHONE_COLORS, phoneThemeFor } from "../phoneTheme";
import { availableOpener, callTurns, formatDuration, OPENING_ACTION } from "./callModel";

/** How long the line rings before it picks up. */
export const RING_MS = 1600;

export interface CallScreenProps {
  contact: DeviceItemView;
  onUseItem: (itemId: string, actionId: string) => void;
  /** Leave the call screen (after the call ended). */
  onLeave: () => void;
  /** Ringing time in milliseconds. Tests use a short one. */
  ringMs?: number;
}

type Phase = "ringing" | "connected" | "ended";

export const CallScreen: React.FC<CallScreenProps> = ({ contact, onUseItem, onLeave, ringMs = RING_MS }) => {
  const { t: translate } = useTranslation("chapter1");
  const t = translate as unknown as Tx;
  const locale = useGameLocale();
  const theme = phoneThemeFor("calls");
  const [phase, setPhase] = useState<Phase>("ringing");
  const [seconds, setSeconds] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(contact);
  latest.current = contact;
  const lines = contact.conversation;
  const { shown, typing } = useTypingReveal(lines);
  const initialShown = useRef(lines.length);
  const endRef = useRef<HTMLDivElement>(null);

  // The line rings, then picks up. The opening action is done when the line picks up.
  useEffect(() => {
    if (phase !== "ringing") return undefined;
    const id = window.setTimeout(() => {
      setPhase("connected");
      const opener = availableOpener(latest.current);
      if (opener !== undefined) onUseItem(latest.current.id, OPENING_ACTION);
    }, ringMs);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, attempt, ringMs]);

  useEffect(() => {
    if (phase !== "connected") return undefined;
    const id = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  // A line of the other side that appears now is played from its clip, if it has one.
  useEffect(() => {
    if (phase !== "connected" || shown <= initialShown.current) return;
    const line = lines[shown - 1];
    if (line === undefined || line.speaker !== "other") return;
    const clipUrl = mission02VoiceUrl(line.voiceId, locale) ?? mission01LineVoiceUrl(line.key, locale);
    void playLineVoice(line.key, line.text, locale, clipUrl, { synthetic: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, phase]);

  useEffect(() => () => stopLineVoice(), []);
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [shown, typing, phase]);

  const end = () => {
    stopLineVoice();
    setPhase("ended");
  };
  const callAgain = () => {
    initialShown.current = contact.conversation.length;
    setSeconds(0);
    setAttempt((value) => value + 1);
    setPhase("ringing");
  };

  const settled = shown >= lines.length;
  const turns = phase === "connected" && settled ? callTurns(contact) : [];
  const status =
    phase === "ringing"
      ? t("phone.dialer.calling", { name: contact.title })
      : phase === "connected"
        ? typing
          ? t("phone.dialer.speaking", { name: contact.title })
          : t("phone.dialer.connected")
        : t("phone.dialer.ended");
  const nothingToAsk = phase === "connected" && settled && turns.length === 0;

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3" data-testid="call-screen" data-phase={phase} aria-label={t("phone.dialer.callWith", { name: contact.title })}>
      <div className="flex shrink-0 flex-col items-center gap-1 pt-1 text-center">
        <span className="relative">
          <ChatAvatar name={contact.title} size={64} />
          {phase === "ringing" && (
            <span aria-hidden="true" className="absolute -inset-1.5 rounded-full border-2 motion-safe:animate-ping" style={{ borderColor: theme.accent }} />
          )}
        </span>
        <h3 className="line-clamp-2 break-words text-base font-bold leading-tight" style={{ color: PHONE_COLORS.text }}>
          {contact.title}
        </h3>
        {/* Plain text only: the number is never a link. */}
        {contact.detail !== null && (
          <p className="text-sm tabular-nums" style={{ color: PHONE_COLORS.textMuted }}>
            {contact.detail}
          </p>
        )}
        <p className="text-sm font-semibold" style={{ color: theme.accent }} data-testid="call-status" role="status">
          {status}
          {phase !== "ringing" && (
            <span className="ml-2 tabular-nums" aria-label={t("phone.call.duration")} data-testid="call-duration">
              {formatDuration(seconds)}
            </span>
          )}
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto" data-testid="conversation-history" role="log" aria-live="polite">
        {phase !== "ringing" &&
          lines.slice(0, shown).map((line) => (
            <div
              key={line.key}
              className={`flex flex-col ${line.speaker === "alex" ? "items-end" : "items-start"}`}
              data-testid={`conversation-line-${line.key}`}
              data-speaker={line.speaker}
            >
              <div
                className="max-w-[90%] rounded-xl border px-2.5 py-1.5 text-sm leading-snug"
                style={
                  line.speaker === "alex"
                    ? { background: "rgba(122,208,79,0.18)", borderColor: "rgba(122,208,79,0.5)", color: PHONE_COLORS.text }
                    : { background: "rgba(255,255,255,0.08)", borderColor: PHONE_COLORS.glassBorder, color: PHONE_COLORS.text }
                }
              >
                <p className="whitespace-pre-line break-words">{line.text}</p>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1 px-1 text-[12px]" style={{ color: PHONE_COLORS.textMuted }}>
                <span>{line.speaker === "alex" ? t("phone.chat.you") : contact.title}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{clockLabel(line.atMinute)}</span>
                <LineListen lineKey={line.key} text={line.text} voiceId={line.voiceId} />
              </div>
            </div>
          ))}
        {phase === "ended" && (
          <p className="pt-1 text-center text-sm" style={{ color: PHONE_COLORS.textMuted }} data-testid="call-ended-note">
            {t("phone.dialer.endedLong", { name: contact.title, time: formatDuration(seconds) })}
          </p>
        )}
        {nothingToAsk && (
          <p className="pt-1 text-center text-[13px] leading-snug" style={{ color: PHONE_COLORS.textMuted }} data-testid="call-no-script">
            {t("phone.dialer.noScript", { name: contact.title })}
          </p>
        )}
        <div ref={endRef} />
      </div>

      {turns.length > 0 && (
        <section aria-label={t("phone.dialer.chooseReply")} className="shrink-0 space-y-1.5" data-testid="call-turns">
          <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: PHONE_COLORS.textMuted }}>
            {t("phone.dialer.chooseReply")}
          </p>
          <ul className="space-y-1.5">
            {turns.map((action) => (
              <li key={action.id} className="space-y-1">
                <button
                  type="button"
                  disabled={!action.available}
                  aria-describedby={action.blocked === null ? undefined : `blocked-${contact.id}-${action.id}`}
                  data-testid={`device-action-${contact.id}-${action.id}`}
                  onClick={() => onUseItem(contact.id, action.id)}
                  className="flex w-full items-center rounded-2xl border px-3 py-2 text-left text-sm font-medium leading-snug motion-safe:transition-colors cursor-pointer hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8fe0e8] disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: "rgba(122,208,79,0.12)", borderColor: "rgba(122,208,79,0.5)", color: PHONE_COLORS.text }}
                >
                  <span className="min-w-0 break-words">{actionLabel(t, locale, action)}</span>
                </button>
                {action.blocked !== null && (
                  <p id={`blocked-${contact.id}-${action.id}`} className="px-1 text-[12px] leading-snug" style={{ color: PHONE_COLORS.textMuted }}>
                    {t(`device.blocked.${action.blocked}`)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex shrink-0 gap-2">
        {phase !== "ended" ? (
          <button
            type="button"
            onClick={end}
            data-testid="call-end"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white motion-safe:transition-colors cursor-pointer hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8fe0e8]"
            style={{ background: "#d64545" }}
          >
            <PhoneOff className="h-4 w-4" aria-hidden="true" />
            {t("phone.call.hangUp")}
          </button>
        ) : (
          <>
            <button type="button" className="flex flex-1 items-center justify-center rounded-xl border px-3 py-2.5 text-sm font-semibold cursor-pointer hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8fe0e8]" style={{ borderColor: PHONE_COLORS.glassBorder, color: PHONE_COLORS.text }} onClick={callAgain} data-testid="call-again">
              {t("phone.dialer.callAgain")}
            </button>
            <button type="button" className="flex flex-1 items-center justify-center rounded-xl px-3 py-2.5 text-sm font-bold text-[#0f1b0b] cursor-pointer hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8fe0e8]" style={{ background: theme.tileFrom }} onClick={onLeave} data-testid="call-leave">
              {t("phone.dialer.backToContacts")}
            </button>
          </>
        )}
      </div>
    </section>
  );
};
