import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  Clock3,
  FileText,
  MessageSquareText,
  Save,
  Search,
  StickyNote,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FatigueLevel, RestMode } from "../../../game/narrative/fatigue";
import type { ThesisTaskView } from "../../../game/narrative/world";
import {
  findSessionInterruptions,
  simulateThesisSession,
  type ThesisFocusMode,
} from "../../../game/narrative/thesisSession";
import type { ThesisDraftSectionId, ThesisResearchNoteId } from "../../../game/narrative/types";
import { elapsedMinutes } from "../../../game/narrative/world";
import { useGameLocale } from "../../../i18n";
import { UI } from "../theme";
import { formatDuration, type DurationText } from "./formatDuration";

export type ThesisTone = "dark" | "paper";

export interface ThesisDeepWorkContext {
  state: import("../../../game/narrative/types").ChapterState;
  scenario: import("../../../game/narrative/types").ScenarioDefinition;
  baseMinutesPerPercent: number;
  fatigueConfig: import("../../../game/narrative/fatigue").FatigueConfig;
  /** Keeps the manuscript draft alive while the laptop switches between apps. */
  documentDraft?: React.MutableRefObject<{ content: Record<string, string>; savedContent: Record<string, string> }>;
  onPreviewMinutesOffset?: (offsetMinutes: number | null) => void;
  onInspectInterruption?: (appHint?: "email" | "chat" | "bank" | "phone") => void;
  onSaveDraft?: (sectionId: ThesisDraftSectionId, content: string) => void;
  onResumeSession?: () => void;
  onEndSession?: () => void;
}

export interface ThesisPanelProps {
  tone?: ThesisTone;
  progress: number;
  sessionMinutes: number;
  sessionPercent: number;
  freeWorkMaxPercent: number;
  timeLeftMinutes: number;
  tasks: readonly ThesisTaskView[];
  onWork: (minutes: number, focusMode?: ThesisFocusMode, sessionElapsedMinutes?: number) => void;
  onTask: (taskId: string, researchNotes?: ThesisResearchNoteId[]) => void;
  /** Open Alex's laptop so planning never grants thesis progress by itself. */
  onOpenDocument?: () => void;
  fatigue?: { level: FatigueLevel; slowdownPercent: number };
  rest?: { napMinutes: number; sleepMinutes: number; onRest: (mode: RestMode) => void };
  deepWork?: ThesisDeepWorkContext;
}

type ThesisSectionId = "introduction" | "findings" | "full-draft";
type Localized = { en: string; vi: string };

interface ThesisSection {
  id: ThesisSectionId;
  taskId: string;
  heading: Localized;
  subheading: Localized;
  initialText: Localized;
  comment: Localized;
  anchor: Localized;
  anchorLocation: Localized;
}

const SECTIONS: readonly ThesisSection[] = [
  {
    id: "introduction",
    taskId: "draft.intro-review",
    heading: { en: "1. Introduction & literature review", vi: "1. Mở đầu & tổng quan tài liệu" },
    subheading: { en: "1.2 Research context", vi: "1.2 Bối cảnh nghiên cứu" },
    initialText: {
      en: "Digital payment systems are now part of everyday student life in Ho Chi Minh City. This study examines how graduating international students decide whether an online request is legitimate when administrative deadlines create pressure.\n\nResearch on phishing has often focused on technical indicators such as suspicious links and sender addresses. Less attention has been paid to how uncertainty about university procedures shapes the way students respond. This study addresses that gap through semi-structured interviews with graduating students in the city.\n\nThe study asks how students verify unexpected requests for money or account information, and what makes that verification easier or harder.",
      vi: "Thanh toán số đã trở thành một phần trong đời sống hằng ngày của sinh viên tại Thành phố Hồ Chí Minh. Nghiên cứu này tìm hiểu cách sinh viên quốc tế sắp tốt nghiệp xác định một yêu cầu trực tuyến có đáng tin hay không khi áp lực thời hạn hành chính xuất hiện.\n\nCác nghiên cứu về lừa đảo trực tuyến thường tập trung vào dấu hiệu kỹ thuật như đường dẫn đáng ngờ và địa chỉ người gửi. Ít nghiên cứu chú ý đến việc sự không rõ ràng trong quy trình của trường ảnh hưởng thế nào đến cách sinh viên phản hồi. Nghiên cứu này tìm hiểu khoảng trống đó qua các cuộc phỏng vấn bán cấu trúc với sinh viên sắp tốt nghiệp tại thành phố.\n\nNghiên cứu đặt câu hỏi sinh viên xác minh các yêu cầu bất ngờ về tiền hoặc thông tin tài khoản ra sao, và điều gì khiến việc xác minh dễ hoặc khó hơn.",
    },
    comment: {
      en: "The context is clear. Tighten the gap in paragraph two: explain what existing studies do not tell us about the moment a student is under deadline pressure. Keep the research question aligned with the interview material.",
      vi: "Bối cảnh đã rõ. Hãy làm rõ khoảng trống ở đoạn hai: những nghiên cứu hiện có chưa cho ta biết điều gì về khoảnh khắc sinh viên chịu áp lực thời hạn? Giữ câu hỏi nghiên cứu bám sát tư liệu phỏng vấn.",
    },
    anchor: {
      en: "Less attention has been paid to how uncertainty about university procedures shapes the way students respond.",
      vi: "Ít nghiên cứu chú ý đến việc sự không rõ ràng trong quy trình của trường ảnh hưởng thế nào đến cách sinh viên phản hồi.",
    },
    anchorLocation: { en: "Introduction · paragraph 2", vi: "Mở đầu · đoạn 2" },
  },
  {
    id: "findings",
    taskId: "draft.findings",
    heading: { en: "3. Findings", vi: "3. Kết quả nghiên cứu" },
    subheading: { en: "3.1 How students verify a request", vi: "3.1 Cách sinh viên xác minh yêu cầu" },
    initialText: {
      en: "Across the interviews, students described checking an unexpected request against a channel they already knew, such as a saved university portal or a previously used phone number. Some said they would ask a classmate first when they were unsure which office to contact.\n\n[Reconcile this paragraph with the interview coding sheet before sending the draft. Do not turn a small interview sample into a claim about all students.]\n\nThe accounts suggest that verification is not a single technical check. Students weigh the time it takes to contact someone against the possibility of missing a deadline.",
      vi: "Trong các cuộc phỏng vấn, sinh viên kể rằng họ đối chiếu yêu cầu bất ngờ với một kênh đã biết, chẳng hạn cổng thông tin trường đã lưu hoặc số điện thoại từng sử dụng. Một số bạn cho biết sẽ hỏi bạn cùng lớp trước khi biết nên liên hệ phòng ban nào.\n\n[Đối chiếu đoạn này với bảng mã hóa phỏng vấn trước khi gửi bản thảo. Không khái quát từ một mẫu phỏng vấn nhỏ thành kết luận về tất cả sinh viên.]\n\nNhững chia sẻ cho thấy xác minh không chỉ là một bước kiểm tra kỹ thuật. Sinh viên cân nhắc thời gian cần để liên hệ người khác với nguy cơ bỏ lỡ thời hạn.",
    },
    comment: {
      en: "Please separate what participants actually said from your interpretation. Check the coded interview notes beside this document; keep the sample size visible and avoid claims beyond it.",
      vi: "Hãy tách lời người tham gia thực sự nói khỏi phần diễn giải của em. Đối chiếu ghi chú phỏng vấn đã mã hóa ở cạnh tài liệu; nêu rõ quy mô mẫu và tránh kết luận vượt quá dữ liệu.",
    },
    anchor: {
      en: "Across the interviews, students described checking an unexpected request against a channel they already knew,",
      vi: "Trong các cuộc phỏng vấn, sinh viên kể rằng họ đối chiếu yêu cầu bất ngờ với một kênh đã biết,",
    },
    anchorLocation: { en: "Findings · paragraph 1", vi: "Kết quả · đoạn 1" },
  },
  {
    id: "full-draft",
    taskId: "draft.final",
    heading: { en: "Full draft · final read-through", vi: "Toàn văn · đọc soát lần cuối" },
    subheading: { en: "Before sending to your supervisor", vi: "Trước khi gửi giảng viên hướng dẫn" },
    initialText: {
      en: "The interviews suggest that students' responses to unexpected online requests are shaped by both their digital habits and their understanding of university procedures. When the correct contact point is easy to find, students can pause to verify a request without feeling that they are risking a deadline.\n\nThis study is limited by its small, locally recruited sample. The findings describe these participants' accounts and should not be generalized to all international students. Further research could compare students across institutions and examine how clearer administrative communication changes verification behavior.\n\n[Read the full document once. Check that the research question, findings and limitations use the same terms.]",      vi: "Các cuộc phỏng vấn cho thấy phản ứng của sinh viên trước yêu cầu trực tuyến bất ngờ chịu ảnh hưởng từ cả thói quen số lẫn hiểu biết về quy trình của trường. Khi dễ tìm đúng nơi liên hệ, sinh viên có thể dừng lại để xác minh mà không cảm thấy mình đang mạo hiểm bỏ lỡ thời hạn.\n\nNghiên cứu bị giới hạn bởi mẫu nhỏ được tuyển tại địa phương. Kết quả mô tả chia sẻ của những người tham gia này và không nên khái quát cho toàn bộ sinh viên quốc tế. Các nghiên cứu tiếp theo có thể so sánh sinh viên giữa các trường và xem xét cách truyền đạt hành chính rõ ràng hơn tác động đến hành vi xác minh.\n\n[Đọc lại toàn văn một lượt. Kiểm tra câu hỏi nghiên cứu, kết quả và phần giới hạn có dùng thuật ngữ nhất quán không.]",
    },
    comment: {
      en: "One last pass: make sure the conclusion does not claim more than the interviews support. Then save the version you would actually send me.",
      vi: "Đọc lại lần cuối: đảm bảo kết luận không nói quá những gì phỏng vấn hỗ trợ. Sau đó lưu phiên bản em thực sự muốn gửi cho tôi.",
    },
    anchor: {
      en: "The interviews suggest that students' responses to unexpected online requests are shaped by both their digital habits",
      vi: "Các cuộc phỏng vấn cho thấy phản ứng của sinh viên trước yêu cầu trực tuyến bất ngờ chịu ảnh hưởng từ cả thói quen số",
    },
    anchorLocation: { en: "Conclusion · opening paragraph", vi: "Kết luận · đoạn mở đầu" },
  },

];

const RESEARCH_NOTES: readonly { id: ThesisResearchNoteId | "coding-sheet"; text: Localized }[] = [
  { id: "coding-sheet", text: { en: "Interview coding sheet · 24 graduating students · Ho Chi Minh City", vi: "Bảng mã hóa phỏng vấn · 24 sinh viên sắp tốt nghiệp · TP. Hồ Chí Minh" } },
  { id: "saved-channel", text: { en: "9 of 24 participants described checking a saved portal or a contact they had used before.", vi: "9 trong số 24 người tham gia kể rằng họ kiểm tra cổng thông tin đã lưu hoặc liên hệ từng sử dụng." } },
  { id: "classmate", text: { en: "6 of 24 participants said they asked a classmate when they could not identify the right office.", vi: "6 trong số 24 người tham gia cho biết họ hỏi bạn cùng lớp khi không biết nên liên hệ phòng ban nào." } },
  { id: "sample-limit", text: { en: "Working note: these are interview counts, not estimates for the wider student population.", vi: "Ghi chú: đây là số đếm trong phỏng vấn, không phải ước tính cho toàn bộ sinh viên." } },
];

const FINDING_SYNTHESIS_OPTIONS: readonly { id: "saved-channel" | "classmate"; text: Localized }[] = [
  {
    id: "saved-channel",
    text: {
      en: "In this interview sample, 9 of 24 participants described checking a saved portal or a contact they had used before. This count describes these interviews, not all students.",
      vi: "Trong mẫu phỏng vấn này, 9 trong số 24 người tham gia kể rằng họ kiểm tra cổng thông tin đã lưu hoặc liên hệ từng sử dụng. Số liệu này mô tả các cuộc phỏng vấn, không đại diện cho mọi sinh viên.",
    },
  },
  {
    id: "classmate",
    text: {
      en: "In this interview sample, 6 of 24 participants said they asked a classmate when they could not identify the right office. This count describes these interviews, not all students.",
      vi: "Trong mẫu phỏng vấn này, 6 trong số 24 người tham gia cho biết họ hỏi bạn cùng lớp khi không biết nên liên hệ phòng ban nào. Số liệu này mô tả các cuộc phỏng vấn, không đại diện cho mọi sinh viên.",
    },
  },
];

function paragraphIndexAtAnchor(text: string, anchor: string): number {
  return text.split(/\n\s*\n/).findIndex((paragraph) => paragraph.includes(anchor));
}

function paragraphAtIndex(text: string, index: number): string {
  return index < 0 ? "" : (text.split(/\n\s*\n/)[index] ?? "");
}

function insertAtSelection(value: string, insertion: string, textarea: HTMLTextAreaElement | null) {
  const start = textarea?.selectionStart ?? value.length;
  const end = textarea?.selectionEnd ?? start;
  const nextValue = `${value.slice(0, start)}${insertion}${value.slice(end)}`;
  return { value: nextValue, cursor: start + insertion.length };
}

/** A small, diegetic word processor: the player revises Alex's actual manuscript, not a typing game. */
export const ThesisPanel: React.FC<ThesisPanelProps> = ({
  tone = "dark", progress, sessionMinutes: legacySessionMinutes, freeWorkMaxPercent, timeLeftMinutes,
  tasks, onWork, onTask, onOpenDocument, fatigue, rest, deepWork,
}) => {
  const { t } = useTranslation("chapter1");
  const isVi = useGameLocale() === "vi";
  const text = t as unknown as DurationText;
  const [sectionId, setSectionId] = useState<ThesisSectionId>("introduction");
  const [findingFocus, setFindingFocus] = useState<"saved-channel" | "classmate" | null>(null);
  const [content, setContent] = useState<Record<ThesisSectionId, string>>(() => Object.fromEntries(
    SECTIONS.map((section) => [section.id, deepWork?.state.world.thesisDraft[section.id] ?? deepWork?.documentDraft?.current.content[section.id] ?? section.initialText[isVi ? "vi" : "en"]]),
  ) as Record<ThesisSectionId, string>);
  const [savedContent, setSavedContent] = useState<Record<ThesisSectionId, string>>(() => Object.fromEntries(
    SECTIONS.map((section) => [section.id, deepWork?.state.world.thesisDraft[section.id] ?? deepWork?.documentDraft?.current.savedContent[section.id] ?? section.initialText[isVi ? "vi" : "en"]]),
  ) as Record<ThesisSectionId, string>);
  const [saveMessage, setSaveMessage] = useState("");
  const [findQuery, setFindQuery] = useState("");
  const [plannedWorkMinutes, setPlannedWorkMinutes] = useState(60);
  const [focusMode, setFocusMode] = useState<ThesisFocusMode>("normal");
  const pausedForInterruption = deepWork?.state.world.thesisWorkSession ?? null;
  const [lastSession, setLastSession] = useState<{ minutes: number; progressGain: number; fatigueGain: number; interrupted: boolean } | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const activeSection = SECTIONS.find((section) => section.id === sectionId) ?? SECTIONS[0];
  const activeTask = tasks.find((task) => task.id === activeSection.taskId);
  const currentText = content[sectionId];
  const initialText = activeSection.initialText[isVi ? "vi" : "en"];
  const hasChanges = savedContent[sectionId] !== currentText;
  // Require a revision to the comment's anchored paragraph, never a minimum edit length.
  const anchor = activeSection.anchor[isVi ? "vi" : "en"];
  const anchorParagraphIndex = paragraphIndexAtAnchor(initialText, anchor);
  const hasRevision = paragraphAtIndex(currentText, anchorParagraphIndex) !== paragraphAtIndex(initialText, anchorParagraphIndex);
  const findingCountNotes = RESEARCH_NOTES.filter((note) => note.id === "saved-channel" || note.id === "classmate");
  const hasCitedFindingCount = findingCountNotes.some((note) => currentText.includes(note.text[isVi ? "vi" : "en"]))
    || FINDING_SYNTHESIS_OPTIONS.some((option) => currentText.includes(option.text[isVi ? "vi" : "en"]));
  const sampleLimitNote = RESEARCH_NOTES.find((note) => note.id === "sample-limit")!;
  const hasSampleLimitation = currentText.includes(sampleLimitNote.text[isVi ? "vi" : "en"])
    || FINDING_SYNTHESIS_OPTIONS.some((option) => currentText.includes(option.text[isVi ? "vi" : "en"]));
  const hasRequiredFindingEvidence = sectionId !== "findings" || (hasCitedFindingCount && hasSampleLimitation);
  const canCompleteTask = Boolean(activeTask && !activeTask.done && activeTask.blocked === null);
  const isLocked = Boolean(activeTask && !activeTask.done && activeTask.blocked === "locked");
  const words = useMemo(() => currentText.trim().split(/\s+/).filter(Boolean).length, [currentText]);
  const atLimit = progress >= freeWorkMaxPercent;
  const timeUp = timeLeftMinutes <= 0;
  const sessionMinutes = Math.max(1, Math.min(240, timeLeftMinutes, plannedWorkMinutes));
  const sessionSimulation = useMemo(() => {
    if (!deepWork) return null;
    return simulateThesisSession({
      startElapsedMinutes: elapsedMinutes(deepWork.state, deepWork.scenario),
      plannedMinutes: sessionMinutes,
      startFatigue: deepWork.state.resources.fatigue,
      startProgress: progress + (deepWork.state.world.thesisWorkRemainderUnits ?? 0) / 1000,
      freeWorkMaxPercent,
      baseMinutesPerPercent: deepWork.baseMinutesPerPercent,
      mode: focusMode,
      fatigueConfig: deepWork.fatigueConfig,
    });
  }, [deepWork, focusMode, freeWorkMaxPercent, progress, sessionMinutes]);
  const sessionInterruptions = useMemo(() => {
    if (!deepWork || !sessionSimulation || sessionSimulation.effectiveMinutesSpent < 1) return [];
    return findSessionInterruptions(deepWork.state, deepWork.scenario, sessionSimulation.effectiveMinutesSpent, focusMode);
  }, [deepWork, focusMode, sessionSimulation]);
  const nextInterruption = sessionInterruptions.find((item) => item.atSessionMinute < (sessionSimulation?.effectiveMinutesSpent ?? 0)) ?? null;

  const updateText = useCallback((next: string) => {
    setContent((previous) => ({ ...previous, [sectionId]: next }));
    if (deepWork?.documentDraft) deepWork.documentDraft.current.content[sectionId] = next;
    setSaveMessage("");
  }, [deepWork?.documentDraft, sectionId]);

  const saveDocument = useCallback(() => {
    if (!hasChanges || timeUp || activeTask?.blocked === "time" || activeTask?.blocked === "complete") return;
    setSavedContent((previous) => ({ ...previous, [sectionId]: currentText }));
    if (deepWork?.documentDraft) deepWork.documentDraft.current.savedContent[sectionId] = currentText;
    deepWork?.onSaveDraft?.(sectionId, currentText);
    setSaveMessage(isVi ? "Đã lưu vào thesis-draft.docx" : "Saved to thesis-draft.docx");
  }, [activeTask, currentText, deepWork?.documentDraft, deepWork?.onSaveDraft, hasChanges, isVi, sectionId, timeUp]);

  const resolveComment = useCallback(() => {
    if (!hasRevision || !hasRequiredFindingEvidence || !canCompleteTask || !activeTask || timeUp) return;
    setSavedContent((previous) => ({ ...previous, [sectionId]: currentText }));
    if (deepWork?.documentDraft) deepWork.documentDraft.current.savedContent[sectionId] = currentText;
    deepWork?.onSaveDraft?.(sectionId, currentText);
    setSaveMessage(isVi ? "Đã lưu vào thesis-draft.docx" : "Saved to thesis-draft.docx");
    const appliedNotes = RESEARCH_NOTES
      .filter((note) => note.id !== "coding-sheet" && (
        currentText.includes(note.text[isVi ? "vi" : "en"])
        || FINDING_SYNTHESIS_OPTIONS.some((option) => option.id === note.id && currentText.includes(option.text[isVi ? "vi" : "en"]))
      ))
      .map((note) => note.id as ThesisResearchNoteId);
    onTask(activeTask.id, appliedNotes);
  }, [activeTask, canCompleteTask, currentText, deepWork?.documentDraft, deepWork?.onSaveDraft, hasRequiredFindingEvidence, hasRevision, isVi, onTask, sectionId, timeUp]);

  const jumpToComment = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const anchor = activeSection.anchor[isVi ? "vi" : "en"];
    const index = currentText.indexOf(anchor);
    if (index < 0) return;
    editor.focus();
    editor.setSelectionRange(index, index + anchor.length);
  }, [activeSection, currentText, isVi]);

  const insertNote = useCallback((note: (typeof RESEARCH_NOTES)[number]) => {
    const inserted = insertAtSelection(currentText, note.text[isVi ? "vi" : "en"], editorRef.current);
    updateText(inserted.value);
    requestAnimationFrame(() => {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(inserted.cursor, inserted.cursor);
    });
  }, [currentText, isVi, updateText]);

  const insertFindingSynthesis = useCallback(() => {
    const option = FINDING_SYNTHESIS_OPTIONS.find((candidate) => candidate.id === findingFocus);
    if (!option || currentText.includes(option.text[isVi ? "vi" : "en"])) return;
    const paragraphs = currentText.split(/\n\s*\n/);
    const index = paragraphIndexAtAnchor(initialText, activeSection.anchor[isVi ? "vi" : "en"]);
    if (index < 0 || !paragraphs[index]) return;
    paragraphs[index] = `${paragraphs[index].trim()} ${option.text[isVi ? "vi" : "en"]}`;
    updateText(paragraphs.join("\n\n"));
    setFindingFocus(null);
  }, [activeSection, currentText, findingFocus, initialText, isVi, updateText]);

  const previewSessionSegment = useCallback((minutes: number, mode: ThesisFocusMode, sessionElapsedMinutes = 0) => {
    if (!deepWork) return null;
    const startElapsedMinutes = elapsedMinutes(deepWork.state, deepWork.scenario);
    const input = {
      startElapsedMinutes,
      sessionElapsedMinutes,
      plannedMinutes: minutes,
      startFatigue: deepWork.state.resources.fatigue,
      startProgress: progress + (deepWork.state.world.thesisWorkRemainderUnits ?? 0) / 1000,
      freeWorkMaxPercent,
      baseMinutesPerPercent: deepWork.baseMinutesPerPercent,
      mode,
      fatigueConfig: deepWork.fatigueConfig,
    } as const;
    const block = simulateThesisSession(input);
    const interruption = findSessionInterruptions(deepWork.state, deepWork.scenario, block.effectiveMinutesSpent, mode)
      .find((item) => item.atSessionMinute < block.effectiveMinutesSpent);
    const spent = interruption ? Math.min(block.effectiveMinutesSpent, interruption.atSessionMinute) : block.effectiveMinutesSpent;
    return {
      interruption,
      simulation: interruption ? simulateThesisSession({ ...input, plannedMinutes: spent }) : block,
    };
  }, [deepWork, freeWorkMaxPercent, progress]);

  const runWorkSession = useCallback((minutes: number, mode: ThesisFocusMode) => {
    if (!deepWork || timeUp || atLimit || minutes < 1 || pausedForInterruption) return;
    const preview = previewSessionSegment(minutes, mode);
    if (!preview || preview.simulation.effectiveMinutesSpent < 1) return;
    deepWork.onPreviewMinutesOffset?.(null);
    // The reducer owns event ordering and stores any remainder in ChapterState; this UI estimate
    // is only for the post-action summary, never the source of the session boundary.
    onWork(minutes, mode);
    setLastSession({
      minutes: preview.simulation.effectiveMinutesSpent,
      progressGain: preview.simulation.progressGain,
      fatigueGain: preview.simulation.fatigueGain,
      interrupted: preview.interruption !== null,
    });
  }, [atLimit, deepWork, onWork, pausedForInterruption, previewSessionSegment, timeUp]);

  const resumeWorkSession = useCallback(() => {
    if (!deepWork || !pausedForInterruption) return;
    const preview = previewSessionSegment(
      pausedForInterruption.remainingMinutes,
      pausedForInterruption.mode,
      pausedForInterruption.elapsedMinutes,
    );
    deepWork.onResumeSession?.();
    if (preview) {
      setLastSession({
        minutes: preview.simulation.effectiveMinutesSpent,
        progressGain: preview.simulation.progressGain,
        fatigueGain: preview.simulation.fatigueGain,
        interrupted: preview.interruption !== null,
      });
    }
  }, [deepWork, pausedForInterruption, previewSessionSegment]);

  const setSessionDuration = useCallback((value: number) => {
    const next = Math.max(15, Math.min(240, Math.floor(value || 15)));
    setPlannedWorkMinutes(next);
    deepWork?.onPreviewMinutesOffset?.(next);
  }, [deepWork]);

  const findNext = useCallback(() => {
    const editor = editorRef.current;
    const needle = findQuery.trim();
    if (!editor || !needle) return;
    const start = editor.selectionEnd;
    const lower = currentText.toLocaleLowerCase();
    const foundAt = lower.indexOf(needle.toLocaleLowerCase(), start);
    const index = foundAt >= 0 ? foundAt : lower.indexOf(needle.toLocaleLowerCase());
    if (index >= 0) {
      editor.focus();
      editor.setSelectionRange(index, index + needle.length);
    }
  }, [currentText, findQuery]);

  React.useEffect(() => () => deepWork?.onPreviewMinutesOffset?.(null), [deepWork?.onPreviewMinutesOffset]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveDocument();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveDocument]);

  // The schedule overlay remains a compact planning surface; actual document revisions happen in the laptop's paper-tone editor.
  if (!deepWork || tone === "dark") {
    return (
      <section aria-labelledby="thesis-panel-heading" data-testid="thesis-panel" className={tone === "dark" ? UI.card : ""}>
        <h3 id="thesis-panel-heading" className={tone === "dark" ? UI.label : "text-sm font-semibold text-slate-700"}>{t("planner.thesis.heading")}</h3>
        <p className="mt-2 text-sm" data-testid="thesis-progress">{t("planner.thesis.progress", { value: progress })}</p>
        <p className="mt-1 text-xs text-slate-500" data-testid="thesis-limit">{t("planner.thesis.limit")}</p>
        <p className="mt-1 text-xs text-slate-500">{t("planner.thesis.session", { time: formatDuration(text, legacySessionMinutes) })}</p>
        <p className="mt-2 text-xs">{isVi ? "Mở bản thảo trên laptop để đọc nhận xét và chỉnh sửa nội dung." : "Open the draft on your laptop to review comments and revise the document."}</p>
        {onOpenDocument && <button type="button" className={`${UI.buttonPrimary} mt-3`} data-testid="thesis-open-document" onClick={() => onOpenDocument()}>{isVi ? "Mở bản thảo" : "Open thesis draft"}</button>}
        {fatigue && fatigue.level !== "rested" && <p className="mt-2 text-xs" data-testid="thesis-fatigue">{t(`planner.thesis.fatigueNote.${fatigue.level}`, { percent: fatigue.slowdownPercent })}</p>}
        {rest && <div className="mt-3 flex gap-2" data-testid="rest-panel"><button type="button" data-testid="rest-nap" disabled={timeUp} onClick={() => rest.onRest("nap")}>{t("planner.thesis.nap", { time: formatDuration(text, rest.napMinutes) })}</button><button type="button" data-testid="rest-sleep" disabled={timeUp} onClick={() => rest.onRest("sleep")}>{t("planner.thesis.sleep", { time: formatDuration(text, rest.sleepMinutes) })}</button></div>}
      </section>
    );
  }

  const completedSections = tasks.filter((task) => task.done).length;
  const pageTone = tone === "paper" ? "bg-[#f8fafc] text-[#253247]" : "bg-[#111b2b] text-slate-100";
  const mutedTone = tone === "paper" ? "text-slate-500" : "text-slate-400";
  const borderTone = tone === "paper" ? "border-slate-200" : "border-white/10";
  const translate = (value: Localized) => value[isVi ? "vi" : "en"];

  return (
    <section aria-labelledby="thesis-panel-heading" data-testid="thesis-panel" className={`flex h-full min-h-0 flex-col overflow-hidden rounded-lg ${pageTone}`}>
      <div className={`flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2 ${borderTone} bg-white/70 text-slate-700`}>
        <div className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-blue-700" /><h3 id="thesis-panel-heading" className="truncate text-xs font-semibold" data-testid="thesis-progress">thesis-draft.docx</h3></div>
        <div className="flex shrink-0 items-center gap-3 text-[10px] text-slate-500"><span className="flex items-center gap-1" data-testid="thesis-save-status">{hasChanges ? <Clock3 className="h-3 w-3 text-amber-600" /> : <Check className="h-3 w-3 text-emerald-600" />}{saveMessage || (hasChanges ? (isVi ? "Chưa lưu thay đổi" : "Unsaved changes") : (isVi ? "Đã lưu" : "Saved"))}</span><span className="hidden sm:inline">{isVi ? `Tiến độ ${Math.round(progress)}%` : `Progress ${Math.round(progress)}%`}</span></div>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-[#f1f4f9] px-3 py-1.5 text-[10px] text-slate-600">
        <span className="text-[9px] font-medium uppercase tracking-wide text-slate-400">{isVi ? "Đang chỉnh sửa" : "Document editor"}</span>
        <div className="ml-auto flex min-w-0 items-center gap-1.5">
          <div className="flex h-7 min-w-0 items-center gap-1 rounded-md border border-[#d9e0eb] bg-white px-1.5"><Search className="h-3 w-3 shrink-0 text-slate-400" /><input aria-label={isVi ? "Tìm trong tài liệu" : "Find in document"} value={findQuery} onChange={(event) => setFindQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") findNext(); }} placeholder={isVi ? "Tìm" : "Find"} className="w-16 bg-transparent text-[10px] text-slate-700 outline-none sm:w-28" /><button type="button" aria-label={isVi ? "Tìm tiếp" : "Find next"} onClick={findNext} className="shrink-0 text-[10px] font-medium text-blue-700">↵</button></div>
          <button type="button" data-testid="thesis-save" onClick={saveDocument} disabled={!hasChanges || timeUp || activeTask?.blocked === "time" || activeTask?.blocked === "complete"} className="flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-[#315aa8] px-2.5 text-[10px] font-semibold text-white hover:bg-[#274b91] disabled:cursor-not-allowed disabled:bg-slate-300"><Save className="h-3 w-3" />{isVi ? "Lưu" : "Save"}</button>
        </div>
      </div>

      {deepWork && <section className="shrink-0 border-b border-slate-200 bg-[#f7f9fc] px-3 py-2.5" data-testid="thesis-session-planner">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[145px] flex-1">
            <div className="flex items-center justify-between gap-2"><label htmlFor="thesis-session-duration" className="text-[10px] font-semibold text-slate-700">{isVi ? "Phiên làm việc" : "Work session"}</label><div className="flex items-center gap-1"><input id="thesis-session-duration" aria-label={isVi ? "Số phút làm luận văn" : "Thesis work minutes"} data-testid="thesis-session-minutes" type="number" min={Math.min(15, Math.max(1, timeLeftMinutes))} max={Math.min(240, timeLeftMinutes)} step={1} value={sessionMinutes} onChange={(event) => setSessionDuration(Number(event.target.value))} className="w-14 rounded border border-slate-300 bg-white px-1.5 py-1 text-right text-[10px] text-slate-700" /><span className="text-[9px] text-slate-500">{isVi ? "phút" : "min"}</span></div></div>
            <input aria-label={isVi ? "Thanh chọn thời lượng làm luận văn" : "Thesis session length slider"} data-testid="thesis-session-slider" type="range" min={Math.min(15, Math.max(1, timeLeftMinutes))} max={Math.max(1, Math.min(240, timeLeftMinutes))} step={1} value={sessionMinutes} onChange={(event) => setSessionDuration(Number(event.target.value))} className="mt-1 w-full accent-blue-700" />
          </div>
          <div className="flex items-center gap-1" role="group" aria-label={isVi ? "Chọn nhịp làm việc" : "Choose work pace"}>
            {(["normal", "deep", "rush"] as const).map((mode) => <button key={mode} type="button" data-testid={`thesis-focus-${mode}`} aria-pressed={focusMode === mode} onClick={() => setFocusMode(mode)} className={`rounded-md border px-2 py-1.5 text-[9px] font-semibold ${focusMode === mode ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{mode === "normal" ? (isVi ? "Bình thường" : "Steady") : mode === "deep" ? (isVi ? "Tập trung sâu" : "Deep focus") : (isVi ? "Nước rút" : "Sprint")}</button>)}
          </div>
          <button type="button" data-testid="thesis-start-session" disabled={!sessionSimulation || sessionSimulation.effectiveMinutesSpent < 1 || Boolean(pausedForInterruption) || atLimit || timeUp} onClick={() => runWorkSession(sessionMinutes, focusMode)} className="rounded-md bg-[#315aa8] px-3 py-2 text-[10px] font-semibold text-white hover:bg-[#274b91] disabled:cursor-not-allowed disabled:bg-slate-300">{isVi ? `Bắt đầu ${sessionMinutes} phút` : `Start ${sessionMinutes}-min block`}</button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] leading-relaxed text-slate-600" data-testid="thesis-session-preview">
          <span>{isVi ? `Dự kiến +${sessionSimulation?.progressGain ?? 0}% (~${sessionSimulation?.wordsGain ?? 0} từ)` : `Estimated +${sessionSimulation?.progressGain ?? 0}% (~${sessionSimulation?.wordsGain ?? 0} words)`}</span>
          {fatigue && <span>{isVi ? `Mệt mỏi +${sessionSimulation?.fatigueGain ?? 0}` : `Fatigue +${sessionSimulation?.fatigueGain ?? 0}`}</span>}
          <span>{isVi ? `Nhịp Flow ${sessionSimulation?.peakFlowMinutes ?? 0}p · quá tải ${sessionSimulation?.burnoutMinutes ?? 0}p` : `Flow ${sessionSimulation?.peakFlowMinutes ?? 0}m · burnout ${sessionSimulation?.burnoutMinutes ?? 0}m`}</span>
          {nextInterruption && <span className="font-medium text-amber-800">{isVi ? "Có thể bị ngắt giữa phiên" : "An interruption may break this block"}</span>}
        </div>
        <p className="mt-1 text-[9px] text-slate-500">{focusMode === "normal" ? (isVi ? "Nhịp cân bằng; thông báo thường vẫn có thể chen vào." : "Balanced pace; routine notifications may interrupt.") : focusMode === "deep" ? (isVi ? "Tắt thông báo thường; cảnh báo khẩn vẫn có thể ngắt phiên." : "Routine notifications are muted; urgent alerts can still break through.") : (isVi ? "Khởi động nhanh nhưng xuống sức sớm và dễ quá tải." : "Fast start, but fatigue rises quickly and burnout comes sooner.")}</p>
        {pausedForInterruption && <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2.5" data-testid="thesis-session-interruption">
          <p className="text-[10px] font-semibold text-amber-950">{pausedForInterruption.interruption.title[isVi ? "vi" : "en"]} · {isVi ? `phút ${pausedForInterruption.interruption.atSessionMinute}` : `minute ${pausedForInterruption.interruption.atSessionMinute}`}</p>
          <p className="mt-1 text-[9px] leading-relaxed text-amber-900">{pausedForInterruption.interruption.body[isVi ? "vi" : "en"]}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pausedForInterruption.interruption.appHint && <button type="button" data-testid="thesis-check-interruption" onClick={() => { const hint = pausedForInterruption.interruption.appHint; deepWork.onInspectInterruption?.(hint); }} className="rounded bg-amber-800 px-2 py-1 text-[9px] font-semibold text-white">{isVi ? "Mở điện thoại kiểm tra" : "Check on phone"}</button>}
            {pausedForInterruption.interruption.kind === "eye_strain" && rest && <button type="button" data-testid="thesis-interruption-rest" disabled={timeUp} onClick={() => rest.onRest("nap")} className="rounded border border-amber-300 bg-white px-2 py-1 text-[9px] font-semibold text-amber-950 disabled:opacity-50">{isVi ? `Nghỉ ${rest.napMinutes} phút` : `Take ${rest.napMinutes}-min break`}</button>}
            {pausedForInterruption.remainingMinutes > 0 && <button type="button" data-testid="thesis-resume-session" onClick={resumeWorkSession} className="rounded border border-amber-300 bg-white px-2 py-1 text-[9px] font-semibold text-amber-950">{isVi ? `Bỏ qua, viết tiếp ${pausedForInterruption.remainingMinutes} phút` : `Ignore and resume ${pausedForInterruption.remainingMinutes} min`}</button>}
            <button type="button" data-testid="thesis-end-session" onClick={() => deepWork.onEndSession?.()} className="rounded border border-amber-300 bg-white px-2 py-1 text-[9px] text-amber-950">{isVi ? "Kết thúc phiên" : "End session"}</button>
          </div>
        </div>}
        {lastSession && <p className={`mt-2 text-[9px] ${lastSession.interrupted ? "text-amber-800" : "text-emerald-700"}`} data-testid="thesis-last-session">{isVi ? `Đã làm ${lastSession.minutes} phút · +${lastSession.progressGain}% · mệt mỏi +${lastSession.fatigueGain}${lastSession.interrupted ? " · bị ngắt" : ""}` : `Worked ${lastSession.minutes} min · +${lastSession.progressGain}% · fatigue +${lastSession.fatigueGain}${lastSession.interrupted ? " · interrupted" : ""}`}</p>}
      </section>}

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(130px,auto)] overflow-hidden md:grid-cols-[118px_minmax(0,1fr)_210px] md:grid-rows-1">
        <aside className={`hidden border-r p-2.5 md:block ${borderTone}`}>
          <div className={`mb-2 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide ${mutedTone}`}><BookOpen className="h-3 w-3" />{isVi ? "Điều hướng" : "Navigation"}</div>
          <div className="space-y-0.5">{SECTIONS.map((section, index) => {
            const task = tasks.find((item) => item.id === section.taskId);
            const selected = section.id === sectionId;
            return <button key={section.id} type="button" onClick={() => { setSectionId(section.id); setSaveMessage(""); }} className={`flex w-full items-start gap-1.5 rounded-md px-2 py-2 text-left text-[10px] leading-snug ${selected ? "bg-blue-50 font-semibold text-blue-800" : "text-slate-600 hover:bg-white/70"}`}>
              {task?.done ? <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" /> : <span className="mt-0.5 w-3 shrink-0 text-center text-slate-400">{index + 1}</span>}<span>{translate(section.heading)}</span>
            </button>;
          })}</div>
          <div className={`mt-4 border-t pt-3 ${borderTone}`}><div className={`mb-1.5 text-[9px] font-semibold uppercase tracking-wide ${mutedTone}`}>{isVi ? "Tiến độ bản thảo" : "Draft status"}</div><div className="h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600 transition-[width]" style={{ width: `${Math.min(100, progress)}%` }} /></div><p className="mt-1 text-[9px] text-slate-500">{Math.round(progress)}% · {completedSections}/3 {isVi ? "lượt sửa đã xong" : "revisions complete"}</p></div>
        </aside>

        <main className="thesis-scroll min-h-0 min-w-0 overflow-y-auto bg-[#e8edf4] p-3 sm:p-4" onWheel={(event) => event.stopPropagation()}>
          <div className="mx-auto min-h-full max-w-[720px] bg-white px-6 py-5 shadow-[0_2px_12px_rgba(33,47,67,0.12)] sm:px-10 sm:py-6">
            <div className="mb-5 border-b border-slate-200 pb-3 text-center"><p className="text-[9px] uppercase tracking-[0.22em] text-slate-400">{isVi ? "Khóa luận tốt nghiệp" : "Undergraduate thesis"}</p><p className="mt-1 font-serif text-sm font-semibold text-slate-800">{isVi ? "Xác minh yêu cầu trực tuyến trong đời sống sinh viên" : "Verifying online requests in student life"}</p><p className="mt-1 text-[9px] text-slate-400">Alex · {isVi ? "Bản thảo chương 3" : "Chapter 3 draft"} · {isVi ? "Thứ Ba, 17:00" : "Tuesday, 17:00"}</p></div>
            <h4 className="font-serif text-[17px] font-semibold text-slate-800">{translate(activeSection.heading)}</h4><p className="mt-1 font-serif text-[12px] font-semibold text-slate-700">{translate(activeSection.subheading)}</p>
            {sectionId === "full-draft" && <div className="mt-3 space-y-3 border-b border-slate-200 pb-4 font-serif text-[11px] leading-relaxed text-slate-600">
              <section><h5 className="mb-1 font-sans text-[9px] font-semibold uppercase tracking-wide text-slate-400">{translate(SECTIONS[0].heading)}</h5><p className="whitespace-pre-wrap">{content.introduction}</p></section>
              <section><h5 className="mb-1 font-sans text-[9px] font-semibold uppercase tracking-wide text-slate-400">{translate(SECTIONS[1].heading)}</h5><p className="whitespace-pre-wrap">{content.findings}</p></section>
              <h5 className="font-sans text-[10px] font-semibold text-slate-700">{isVi ? "Kết luận & giới hạn nghiên cứu — chỉnh sửa bên dưới" : "Conclusion & limitations — revise below"}</h5>
            </div>}
            <textarea ref={editorRef} aria-label={isVi ? `Chỉnh sửa ${activeSection.heading.vi}` : `Edit ${activeSection.heading.en}`} data-testid="thesis-document-editor" value={currentText} onChange={(event) => updateText(event.target.value)} spellCheck className="mt-3 min-h-[250px] w-full resize-y border-0 bg-transparent p-0 font-serif text-[12px] leading-[1.85] text-slate-700 outline-none focus:ring-0 sm:min-h-[310px]" />
            <div className="mt-4 flex flex-wrap items-center justify-between border-t border-slate-100 pt-2 text-[9px] text-slate-400"><span>{isVi ? `${words} từ trong phần này` : `${words} words in this section`}</span><span>{isVi ? "Trang 12 · APA 7" : "Page 12 · APA 7"}</span></div>
            {isLocked && <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] leading-relaxed text-amber-900">{isVi ? "Phần này sẽ mở sau khi xử lý các nhận xét ở phần trước. Em vẫn có thể chỉnh sửa bản nháp." : "This section unlocks after you resolve the earlier comments. You can still edit the draft."}</p>}
            <div className="mt-4 border-t border-slate-100 pt-3 text-[10px] leading-relaxed text-slate-500">{isVi ? "Có thể lưu nháp bất cứ lúc nào. Khi thấy phần sửa đã ổn, hãy xử lý nhận xét của giảng viên ở bên cạnh." : "Save a draft whenever you like. When you are satisfied with the revision, resolve the supervisor's comment beside the document."}</div>
          </div>
        </main>

        <aside className={`thesis-scroll min-h-0 max-h-56 overflow-y-auto border-t bg-white/55 p-2.5 md:col-span-1 md:max-h-none md:border-l md:border-t-0 ${borderTone}`}>
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-slate-600"><MessageSquareText className="h-3.5 w-3.5 text-blue-700" />{isVi ? "Nhận xét" : "Comments"}</div>
          <div data-testid="thesis-supervisor-comment" className="rounded-md border border-blue-100 bg-blue-50/70 p-2.5">
            <div className="flex items-center gap-1.5"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#dce7ff] text-[9px] font-bold text-blue-800">N</span><span className="text-[9px] font-semibold text-slate-700">{isVi ? "TS. Nguyễn · Giảng viên hướng dẫn" : "Dr. Nguyen · Supervisor"}</span></div>
            <p className="mt-2 text-[9px] font-semibold text-blue-800">{translate(activeSection.anchorLocation)}</p>
            <blockquote className="mt-1 border-l-2 border-blue-200 pl-2 font-serif text-[9px] italic leading-relaxed text-slate-500">“{translate(activeSection.anchor)}”</blockquote>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-700">{translate(activeSection.comment)}</p>
            {sectionId === "findings" && !activeTask?.done && <div className="mt-2 rounded-md border border-violet-200 bg-violet-50/70 p-2" data-testid="thesis-synthesis-builder">
              <p className="text-[9px] font-semibold text-violet-950">{isVi ? "Tổng hợp kết quả" : "Synthesize the finding"}</p>
              <p className="mt-1 text-[9px] leading-relaxed text-slate-600">{isVi ? "Chọn một kết quả để làm trọng tâm. Cả hai đều là hướng phân tích hợp lệ; giữ kết luận trong phạm vi 24 cuộc phỏng vấn." : "Choose which result to foreground. Both are valid angles; keep the claim within these 24 interviews."}</p>
              <div className="mt-2 space-y-1">
                {FINDING_SYNTHESIS_OPTIONS.map((option) => <button key={option.id} type="button" data-testid={`thesis-synthesis-choice-${option.id}`} aria-pressed={findingFocus === option.id} onClick={() => setFindingFocus(option.id)} className={`w-full rounded border px-2 py-1.5 text-left text-[9px] leading-relaxed ${findingFocus === option.id ? "border-violet-500 bg-white text-violet-950 ring-1 ring-violet-300" : "border-violet-100 bg-white/60 text-slate-700 hover:bg-white"}`}>
                  <span className="mb-0.5 block font-semibold">{option.id === "saved-channel" ? (isVi ? "Kênh đã biết · 9/24" : "Known channel · 9/24") : (isVi ? "Hỏi bạn cùng lớp · 6/24" : "Ask a classmate · 6/24")}</span>
                  {isVi ? (option.id === "saved-channel" ? "Đối chiếu yêu cầu với portal hoặc số liên hệ từng dùng." : "Tìm đúng phòng ban nhờ bạn học khi chưa biết liên hệ ai.") : (option.id === "saved-channel" ? "Check a request against a portal or contact used before." : "Use peer support to identify the right office.")}
                </button>)}
              </div>
              {findingFocus && <p className="mt-2 rounded bg-white p-2 text-[9px] leading-relaxed text-slate-700" data-testid="thesis-synthesis-preview">{FINDING_SYNTHESIS_OPTIONS.find((option) => option.id === findingFocus)?.text[isVi ? "vi" : "en"]}</p>}
              <button type="button" data-testid="thesis-insert-synthesis" disabled={!findingFocus} onClick={insertFindingSynthesis} className="mt-2 w-full rounded bg-violet-700 px-2 py-1.5 text-[9px] font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300">{isVi ? "Chèn phần tổng hợp vào đoạn đang sửa" : "Add synthesis to the paragraph"}</button>
            </div>}
            {sectionId === "findings" && !activeTask?.done && <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/70 p-2 text-[9px] leading-relaxed" data-testid="thesis-evidence-checklist">
              <p className="mb-1 font-semibold text-amber-950">{isVi ? "Trước khi gửi phần kết quả" : "Before you submit these findings"}</p>
              <p className={hasCitedFindingCount ? "text-emerald-700" : "text-amber-900"}>{hasCitedFindingCount ? "✓" : "○"} {isVi ? "Dẫn ít nhất một số liệu phỏng vấn (9/24 hoặc 6/24)." : "Cite at least one interview count (9/24 or 6/24)."}</p>
              <p className={hasSampleLimitation ? "text-emerald-700" : "text-amber-900"}>{hasSampleLimitation ? "✓" : "○"} {isVi ? "Nêu rõ giới hạn của mẫu phỏng vấn." : "State the limitation of the interview sample."}</p>
            </div>}
            <button type="button" data-testid="thesis-jump-to-comment" onClick={jumpToComment} className="mt-2 text-[9px] font-semibold text-blue-700 hover:underline">{isVi ? "Đến đoạn được nhận xét" : "Go to passage"}</button>
            {activeTask?.done ? (
              <p className="mt-2 flex items-center gap-1 border-t border-blue-100 pt-2 text-[9px] font-semibold text-emerald-700" data-testid="thesis-comment-resolved"><Check className="h-3 w-3" />{isVi ? "Đã xử lý nhận xét" : "Comment resolved"}</p>
            ) : canCompleteTask && activeTask ? (
              <div className="mt-2 border-t border-blue-100 pt-2">
                {!hasRevision && <p className="mb-1.5 text-[9px] leading-relaxed text-slate-500">{isVi ? "Chỉnh sửa đoạn được đánh dấu trước; có thể lưu nháp mà chưa cần xử lý nhận xét." : "Revise the marked passage first. You can save a draft without resolving the comment."}</p>}
                {sectionId === "findings" && !hasRequiredFindingEvidence && <p className="mb-1.5 text-[9px] leading-relaxed text-amber-800">{isVi ? "Đối chiếu ít nhất một số liệu và giới hạn của mẫu trước khi xử lý nhận xét." : "Use at least one count and the sample limitation before resolving this comment."}</p>}
                <button type="button" data-testid="thesis-resolve-comment" onClick={resolveComment} disabled={!hasRevision || !hasRequiredFindingEvidence || timeUp} className="w-full rounded-md bg-[#315aa8] px-2 py-1.5 text-[9px] font-semibold text-white hover:bg-[#274b91] disabled:cursor-not-allowed disabled:bg-slate-300">{isVi ? "Đánh dấu đã xử lý" : "Resolve comment"}</button>
              </div>
            ) : null}
            <p className="mt-2 text-[9px] text-slate-400">{isVi ? "Hôm nay, 14:20" : "Today, 14:20"}</p>
          </div>
          <div className="mt-4 border-t border-slate-200 pt-3"><div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-slate-600"><StickyNote className="h-3.5 w-3.5 text-amber-700" />{isVi ? "Ghi chú phỏng vấn" : "Interview notes"}</div><div className="space-y-1.5" data-testid="thesis-research-notes">{RESEARCH_NOTES.map((note, index) => <div key={note.id} className={`rounded-md p-2 text-[9px] leading-relaxed ${index === 0 ? "bg-amber-50 font-medium text-amber-950" : "bg-slate-50 text-slate-600"}`}><p>{translate(note.text)}</p>{index > 0 && <button type="button" data-testid={`thesis-insert-note-${note.id}`} onClick={() => insertNote(note)} className="mt-1 text-[9px] font-semibold text-blue-700 hover:underline">{isVi ? "Chèn vào bản thảo" : "Insert into draft"}</button>}</div>)}</div></div>
          <div className="mt-4 border-t border-slate-200 pt-2 text-[9px] leading-relaxed text-slate-500"><div className="flex items-center gap-1"><Clock3 className="h-3 w-3" />{isVi ? `Còn ${Math.floor(timeLeftMinutes / 60)} giờ ${timeLeftMinutes % 60} phút` : `${Math.floor(timeLeftMinutes / 60)}h ${timeLeftMinutes % 60}m remaining`}</div>{fatigue && fatigue.level !== "rested" && <p className="mt-1" data-testid="thesis-fatigue">{t(`planner.thesis.fatigueNote.${fatigue.level}`, { percent: fatigue.slowdownPercent })}</p>}{atLimit && <p className="mt-1">{isVi ? "Tiến độ viết tự do đã đến giới hạn; các phần cần sửa vẫn có thể lưu." : "Free-writing progress is at its limit; required revisions can still be saved."}</p>}</div>
        </aside>
      </div>

    </section>
  );
};
