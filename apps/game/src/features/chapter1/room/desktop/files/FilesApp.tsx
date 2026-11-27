// File Explorer of the laptop desktop: warm neutral colors, a folder list, file tiles with
// thumbnails and a preview. The files are the game's own device items of the Files app (the thesis,
// the saved portal, bank statement and security settings, and the evidence folder).
//
// Opening a folder or a file reads it and changes nothing else. The Evidence folder fills only when
// the player saves a record on purpose (an action of a mail, a page, the bank statement, a platform
// or a call), so looking at the app never creates evidence. File actions are the story's own device
// actions, each with its cost shown.
import React, { useRef, useState } from "react";
import { ArrowLeft, Bookmark, FileText, Folder, FolderCheck, Globe, Landmark, ShieldCheck, File as FileIcon, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DeviceItemView, DeviceView } from "../../../../../game/narrative/device";
import { useGameLocale } from "../../../../../i18n/useGameLocale";
import { actionLabel, formatWhen, type Tx } from "../../../device/deviceFormat";
import { themeFor } from "../desktopTheme";
import { useIsWide } from "../useContainerWidth";

export interface FilesAppProps {
  view: DeviceView;
  onOpenItem: (itemId: string) => void;
  onUseItem: (itemId: string, actionId: string) => void;
}

const INK = "#3a2a16";
const MUTED = "#7a6650";
const LINE = "#e3d6c2";
const PAPER = "#fffdf9";
const SOFT = "#f6ecdc";
const ACCENT = "#b8691f";
const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b8691f]";
const BUTTON = `inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#b8691f] px-4 py-2 text-sm font-semibold text-white motion-safe:transition-colors hover:bg-[#9b5614] disabled:cursor-not-allowed disabled:bg-[#e6d8c4] disabled:text-[#8a7861] ${FOCUS}`;

const FOLDER_ORDER = ["thesis", "portal", "evidence", "bank", "security", "bookmarks"] as const;
type IconType = LucideIcon;
const FOLDER_ICON: Readonly<Record<string, IconType>> = {
  thesis: FileText,
  portal: Globe,
  evidence: FolderCheck,
  bank: Landmark,
  security: ShieldCheck,
  bookmarks: Bookmark,
};
const THUMB_COLORS: Readonly<Record<string, { bg: string; fg: string }>> = {
  thesis: { bg: "#e7eefb", fg: "#3a63c2" },
  portal: { bg: "#dff3f1", fg: "#0b8a86" },
  evidence: { bg: "#fbe9d3", fg: "#b8691f" },
  bank: { bg: "#e1f3ec", fg: "#0a7d5a" },
  security: { bg: "#efe6f7", fg: "#6a47a8" },
  bookmarks: { bg: "#efeaff", fg: "#5b3fb0" },
};
const OTHER_THUMB = { bg: "#eee7da", fg: "#7a6650" };

function folderOf(item: DeviceItemView): string {
  return item.folder ?? "other";
}

export const FilesApp: React.FC<FilesAppProps> = ({ view, onOpenItem, onUseItem }) => {
  const { t: translate } = useTranslation("chapter1");
  const t = translate as unknown as Tx;
  const locale = useGameLocale();
  const theme = themeFor("device-files");
  const rootRef = useRef<HTMLDivElement>(null);
  const wide = useIsWide(rootRef, 640);

  const files = view.apps.files;
  const folderNames = [
    // The Evidence folder is always there, so the player knows where a saved record will go.
    ...FOLDER_ORDER.filter((name) => name === "evidence" || files.some((item) => folderOf(item) === name)),
    ...Array.from(new Set(files.map(folderOf))).filter((name) => !(FOLDER_ORDER as readonly string[]).includes(name)),
  ];
  const [folder, setFolder] = useState<string>("all");
  const activeFolder = folder === "all" || folderNames.includes(folder) ? folder : "all";
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const shown = activeFolder === "all" ? files : files.filter((item) => folderOf(item) === activeFolder);
  const current = selectedId === null ? null : (files.find((item) => item.id === selectedId) ?? null);
  const folderLabel = (name: string) => (name === "all" ? t("fileExplorer.all") : t(`fileExplorer.folder.${name}`, { defaultValue: name }));
  const count = (name: string) => (name === "all" ? files.length : files.filter((item) => folderOf(item) === name).length);

  const open = (item: DeviceItemView) => {
    setSelectedId(item.id);
    if (!item.read) onOpenItem(item.id);
  };

  const rail = (
    <nav aria-label={t("fileExplorer.folders")} data-testid="files-folders" className={wide ? "w-44 shrink-0 space-y-1 border-r p-3" : "flex gap-1.5 overflow-x-auto border-b p-2"} style={{ borderColor: LINE, background: SOFT }}>
      {["all", ...folderNames].map((name) => {
        const Icon = name === "all" ? Folder : (FOLDER_ICON[name] ?? FileIcon);
        const selected = activeFolder === name;
        return (
          <button
            key={name}
            type="button"
            data-testid={`files-folder-${name}`}
            aria-current={selected ? "true" : undefined}
            onClick={() => {
              setFolder(name);
              setSelectedId(null);
            }}
            className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium motion-safe:transition-colors ${FOCUS} ${wide ? "w-full" : ""} ${
              selected ? "bg-white shadow-sm" : "hover:bg-white/60"
            }`}
            style={{ color: selected ? ACCENT : INK, boxShadow: selected ? `inset 3px 0 0 ${ACCENT}` : undefined }}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{folderLabel(name)}</span>
            <span className="shrink-0 text-xs tabular-nums" style={{ color: MUTED }}>
              {count(name)}
            </span>
          </button>
        );
      })}
    </nav>
  );

  const grid = (
    <section aria-label={folderLabel(activeFolder)} data-testid="files-grid" className="min-w-0 flex-1 p-4">
      {activeFolder === "evidence" && (
        <p className="mb-3 rounded-lg px-3 py-2 text-xs" style={{ background: SOFT, color: MUTED }} data-testid="files-evidence-note">
          {t("fileExplorer.evidenceNote")}
        </p>
      )}
      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center" data-testid="files-empty">
          <Folder className="h-9 w-9" style={{ color: "#c9b79b" }} aria-hidden="true" />
          <p className="text-sm" style={{ color: MUTED }}>
            {t(activeFolder === "evidence" ? "fileExplorer.evidenceEmpty" : "fileExplorer.empty")}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-3">
          {shown.map((item) => {
            const name = folderOf(item);
            const Icon = FOLDER_ICON[name] ?? FileIcon;
            const colors = THUMB_COLORS[name] ?? OTHER_THUMB;
            const selected = current?.id === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  data-testid={`device-row-${item.id}`}
                  aria-current={selected ? "true" : undefined}
                  onClick={() => open(item)}
                  className={`group flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border p-2 text-center motion-safe:transition-colors hover:bg-white ${FOCUS}`}
                  style={{ borderColor: selected ? ACCENT : "transparent", background: selected ? PAPER : undefined }}
                >
                  <span aria-hidden="true" className="relative flex h-16 w-14 items-center justify-center rounded-md border" style={{ background: colors.bg, borderColor: LINE, boxShadow: "0 2px 4px rgba(58,42,22,0.12)" }}>
                    <span className="absolute right-0 top-0 h-3 w-3 rounded-bl-md" style={{ background: "rgba(255,255,255,0.7)" }} />
                    <Icon className="h-6 w-6" style={{ color: colors.fg }} />
                  </span>
                  <span className="line-clamp-2 break-words text-xs font-medium leading-tight" style={{ color: INK }}>
                    {item.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  const preview =
    current === null ? null : (
      <article aria-label={t("fileExplorer.preview")} data-testid={`files-preview-${current.id}`} className={`min-w-0 space-y-3 p-4 ${wide ? "w-[19rem] shrink-0 border-l" : ""}`} style={{ borderColor: LINE, background: PAPER }}>
        {!wide && (
          <button type="button" className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${FOCUS}`} style={{ borderColor: LINE, color: INK }} onClick={() => setSelectedId(null)} data-testid="files-back">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t("fileExplorer.back")}
          </button>
        )}
        <header>
          <h3 className="break-words text-base font-bold" style={{ color: INK }}>
            {current.title}
          </h3>
          <p className="mt-0.5 text-xs" style={{ color: MUTED }}>
            {folderLabel(folderOf(current))} | {formatWhen(t, current.arrivedAtMinute)}
          </p>
          {current.detail && (
            <p className="mt-0.5 break-all text-xs" style={{ color: MUTED }}>
              {current.detail}
            </p>
          )}
        </header>
        <p className="whitespace-pre-line break-words text-sm leading-relaxed" style={{ color: INK }}>
          {current.body}
        </p>
        {current.actions.length > 0 && (
          <ul className="space-y-2">
            {current.actions.map((action) => (
              <li key={action.id} className="space-y-1">
                <button type="button" className={BUTTON} disabled={!action.available} data-testid={`device-action-${current.id}-${action.id}`} onClick={() => onUseItem(current.id, action.id)}>
                  {actionLabel(t, locale, action)}
                </button>
                {action.blocked !== null && (
                  <p className="text-xs" style={{ color: MUTED }}>
                    {t(`device.blocked.${action.blocked}`)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </article>
    );

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col" data-testid="files-app" style={{ background: theme.bodyBg, color: INK }}>
      <header className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-1 border-b px-4 py-2 text-xs" style={{ borderColor: LINE, background: SOFT, color: MUTED }}>
        <span data-testid="files-backup">{view.files.backupSecured ? t("device.files.backupYes") : t("device.files.backupNo")}</span>
        <span data-testid="files-evidence-count">{t("device.files.evidenceValue", { value: view.files.evidenceCount })}</span>
      </header>
      <div className={`flex min-h-0 flex-1 ${wide ? "flex-row" : "flex-col"}`}>
        {rail}
        <div className="flex min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain" onWheel={(event) => event.stopPropagation()}>
          {wide ? (
            <>
              {grid}
              {preview}
            </>
          ) : (
            (preview ?? grid)
          )}
        </div>
      </div>
    </div>
  );
};
