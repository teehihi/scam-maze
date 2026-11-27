// The list of conversations: the newest first, with an avatar, the name, the last line, its time and
// an unread mark. Opening a conversation reads it (the parent dispatches the open action).
import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { DeviceAppId } from "../../../../game/narrative/types";
import type { DeviceItemView } from "../../../../game/narrative/device";
import type { Tx } from "../../device/deviceFormat";
import { PHONE_COLORS } from "../phoneTheme";
import { ChatAvatar } from "./ChatThread";
import { clockLabel, lastActivity, sortChats } from "./chatModel";

export interface ChatListProps {
  chats: readonly DeviceItemView[];
  onOpen: (item: DeviceItemView) => void;
  /** Tells which list is on screen (see `DeviceApp`); null when it is closed. */
  onView?: (view: { app: DeviceAppId; itemIds: readonly string[] } | null) => void;
}

/** Text of the row: the last line, with "You:" in front of Alex's own line. */
function preview(item: DeviceItemView, t: Tx): string {
  const last = item.conversation.at(-1);
  if (last === undefined) return item.body;
  return last.speaker === "alex" ? t("phone.chat.previewYou", { text: last.text }) : last.text;
}

export const ChatList: React.FC<ChatListProps> = ({ chats, onOpen, onView }) => {
  const { t: translate } = useTranslation("chapter1");
  const t = translate as unknown as Tx;
  const sorted = sortChats(chats);
  const onViewRef = useRef(onView);
  onViewRef.current = onView;
  const ids = sorted.map((item) => item.id).join("|");
  useEffect(() => {
    onViewRef.current?.({ app: "messages", itemIds: ids === "" ? [] : ids.split("|") });
    return () => onViewRef.current?.(null);
  }, [ids]);
  if (sorted.length === 0) return null;
  return (
    <section aria-label={t("phone.chat.listHeading")} data-testid="device-app-messages">
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: PHONE_COLORS.textMuted }}>
        {t("phone.chat.listHeading")}
      </h3>
      <ul className="space-y-1.5">
        {sorted.map((item) => {
          const unread = item.tracksUnread && !item.read;
          return (
            <li key={item.id}>
              <button
                type="button"
                data-testid={`device-row-${item.id}`}
                onClick={() => onOpen(item)}
                className="flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left motion-safe:transition-colors cursor-pointer hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8fe0e8]"
                style={{ background: "rgba(0,0,0,0.3)", borderColor: "rgba(255,255,255,0.12)", color: PHONE_COLORS.text }}
              >
                <ChatAvatar name={item.title} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={`line-clamp-1 break-words text-sm ${unread ? "font-bold" : "font-semibold"}`}>{item.title}</span>
                    <span className="shrink-0 text-[12px] tabular-nums" style={{ color: PHONE_COLORS.textMuted }}>
                      {clockLabel(lastActivity(item))}
                    </span>
                  </span>
                  <span className={`line-clamp-2 break-words text-[13px] leading-snug ${unread ? "font-semibold" : ""}`} style={{ color: unread ? PHONE_COLORS.text : PHONE_COLORS.textMuted }}>
                    {preview(item, t)}
                  </span>
                </span>
                {unread && (
                  <>
                    <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PHONE_COLORS.notice }} />
                    <span className="sr-only">{t("device.unreadMark")}</span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
