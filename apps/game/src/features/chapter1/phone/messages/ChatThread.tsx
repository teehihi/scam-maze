// One conversation: bubbles for the other side and for Alex, a time under each, a typing moment
// before the other side answers, and the replies Alex can send now as buttons.
// A reply is a game action: pressing it records Alex's line and the answer in the game state, costs
// the time the action costs and can change what happens next. Free typing is not offered, because
// the game cannot judge arbitrary text; the replies are the written options of the scenario.
// Only lines that already happened are shown. The answer to a reply stays hidden until it is sent.
import React, { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DeviceActionView, DeviceItemView } from "../../../../game/narrative/device";
import { useGameLocale } from "../../../../i18n/useGameLocale";
import { avatarColor } from "../../room/desktop/desktopTheme";
import { actionLabel, type Tx } from "../../device/deviceFormat";
import { LineListen } from "../../device/LineListen";
import { UI } from "../../theme";
import { PHONE_COLORS, phoneThemeFor, tileBackground } from "../phoneTheme";
import { clockLabel, otherActions, replyActions, threadBubbles, weekdayOf } from "./chatModel";
import { useTypingReveal } from "./useTypingReveal";

const WEEKDAY_KEYS = [
  "hud.status.weekday.1",
  "hud.status.weekday.2",
  "hud.status.weekday.3",
  "hud.status.weekday.4",
  "hud.status.weekday.5",
  "hud.status.weekday.6",
  "hud.status.weekday.7",
] as const;

export interface ChatThreadProps {
  item: DeviceItemView;
  onBack: () => void;
  onUseItem: (itemId: string, actionId: string) => void;
}

/** Round avatar with the first letter of the name. The color depends on the name only: it never says who can be trusted. */
export const ChatAvatar: React.FC<{ name: string; size: number }> = ({ name, size }) => (
  <span
    aria-hidden="true"
    className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
    style={{ width: size, height: size, background: avatarColor(name), fontSize: Math.round(size * 0.45) }}
  >
    {name.trim().charAt(0).toUpperCase()}
  </span>
);

const TypingDots: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex justify-start" data-testid="chat-typing" role="status" aria-label={label}>
    <span className="flex items-center gap-1 rounded-2xl rounded-bl-md border px-3 py-2.5" style={{ background: "rgba(255,255,255,0.08)", borderColor: PHONE_COLORS.glassBorder }}>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          aria-hidden="true"
          className="block h-1.5 w-1.5 rounded-full bg-[#a9bccb] motion-safe:animate-pulse"
          style={{ animationDelay: `${index * 160}ms` }}
        />
      ))}
    </span>
  </div>
);

export const ChatThread: React.FC<ChatThreadProps> = ({ item, onBack, onUseItem }) => {
  const { t: translate } = useTranslation("chapter1");
  const t = translate as unknown as Tx;
  const locale = useGameLocale();
  const theme = phoneThemeFor("messages");
  const { shown, typing } = useTypingReveal(item.conversation);
  const bubbles = threadBubbles(item, shown);
  const settled = shown >= item.conversation.length;
  const replies = settled ? replyActions(item) : [];
  const others = otherActions(item);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [bubbles.length, typing]);

  const sendButton = (action: DeviceActionView, reply: boolean) => (
    <li key={action.id} className="space-y-1">
      <button
        type="button"
        className={reply ? "flex w-full items-center rounded-2xl border px-3 py-2 text-left text-sm font-medium leading-snug motion-safe:transition-colors cursor-pointer hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8fe0e8] disabled:cursor-not-allowed disabled:opacity-50" : UI.buttonSecondary}
        style={reply ? { background: "rgba(56,189,248,0.12)", borderColor: "rgba(56,189,248,0.5)", color: PHONE_COLORS.text } : undefined}
        disabled={!action.available}
        aria-describedby={action.blocked === null ? undefined : `blocked-${item.id}-${action.id}`}
        data-testid={`device-action-${item.id}-${action.id}`}
        onClick={() => onUseItem(item.id, action.id)}
      >
        <span className="min-w-0 break-words">{actionLabel(t, locale, action)}</span>
      </button>
      {action.blocked !== null && (
        <p id={`blocked-${item.id}-${action.id}`} className="px-1 text-[12px] leading-snug" style={{ color: PHONE_COLORS.textMuted }}>
          {t(`device.blocked.${action.blocked}`)}
        </p>
      )}
    </li>
  );

  let lastDay = -1;
  return (
    <article className="flex min-h-0 flex-1 flex-col gap-2" data-testid={`device-item-${item.id}`} aria-label={t("phone.chat.threadLabel", { name: item.title })}>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" className={UI.buttonSecondary} onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>{t("device.back")}</span>
        </button>
        <ChatAvatar name={item.title} size={32} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 break-words text-sm font-bold leading-tight" style={{ color: PHONE_COLORS.text }}>
            {item.title}
          </h3>
          {item.from !== null && item.from !== item.title && (
            <p className="line-clamp-2 break-words text-[12px] leading-snug" style={{ color: PHONE_COLORS.textMuted }}>
              {item.from}
            </p>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5" data-testid="conversation-history" role="log" aria-live="polite">
        {bubbles.map((bubble) => {
          const day = weekdayOf(bubble.atMinute);
          const divider = day !== lastDay;
          lastDay = day;
          return (
            <React.Fragment key={bubble.key}>
              {divider && (
                <p className="py-1 text-center text-[12px] font-semibold" style={{ color: PHONE_COLORS.textMuted }}>
                  {t(WEEKDAY_KEYS[day - 1])}
                </p>
              )}
              <div
                className={`flex flex-col ${bubble.side === "out" ? "items-end" : "items-start"}`}
                data-testid={bubble.lineKey === null ? "chat-opening" : `conversation-line-${bubble.lineKey}`}
                data-speaker={bubble.side === "out" ? "alex" : "other"}
              >
                <div
                  className={`max-w-[88%] rounded-2xl border px-3 py-2 text-sm leading-snug ${bubble.side === "out" ? "rounded-br-md" : "rounded-bl-md"}`}
                  style={
                    bubble.side === "out"
                      ? { background: tileBackground(theme), borderColor: "transparent", color: "#ffffff" }
                      : { background: "rgba(255,255,255,0.08)", borderColor: PHONE_COLORS.glassBorder, color: PHONE_COLORS.text }
                  }
                >
                  {/* Plain text only: a web address in a message is never a link. */}
                  <p className="whitespace-pre-line break-words">{bubble.text}</p>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1 px-1 text-[12px]" style={{ color: PHONE_COLORS.textMuted }}>
                  <span>{bubble.side === "out" ? t("phone.chat.you") : item.title}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{clockLabel(bubble.atMinute)}</span>
                  {bubble.lineKey !== null && <LineListen lineKey={bubble.lineKey} text={bubble.text} voiceId={bubble.voiceId} />}
                </div>
              </div>
            </React.Fragment>
          );
        })}
        {typing && <TypingDots label={t("phone.chat.typing", { name: item.title })} />}
        <div ref={endRef} />
      </div>
      <div className="shrink-0 space-y-2 border-t pt-2" style={{ borderColor: PHONE_COLORS.glassBorder }} data-testid="chat-replies">
        {replies.length > 0 && (
          <section aria-label={t("phone.chat.replyHeading")} className="space-y-1.5">
            <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: PHONE_COLORS.textMuted }}>
              {t("phone.chat.replyHeading")}
            </p>
            <ul className="space-y-1.5">{replies.map((action) => sendButton(action, true))}</ul>
          </section>
        )}
        {others.length > 0 && settled && (
          <section aria-label={t("phone.chat.actionsHeading")} className="space-y-1.5">
            <ul className="space-y-1.5">{others.map((action) => sendButton(action, false))}</ul>
          </section>
        )}
        {replies.length === 0 && others.length === 0 && settled && (
          <p className="text-[12px] leading-snug" style={{ color: PHONE_COLORS.textMuted }} data-testid="chat-no-reply">
            {t("phone.chat.noReply")}
          </p>
        )}
      </div>
    </article>
  );
};
