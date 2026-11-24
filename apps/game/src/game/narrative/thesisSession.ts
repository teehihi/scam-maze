// Pure deterministic Deep-Work Thesis Session Engine (Warm-up -> Flow -> Burnout).
// Zero React/Three.js imports — safe for reducer, save/replay determinism, UI curve preview, and Vitest.

import {
  DEFAULT_FATIGUE_CONFIG,
  workFatigue,
  workSlowdown,
  type FatigueConfig,
} from "./fatigue";
import type { ChapterState, ScenarioDefinition } from "./types";
import { elapsedMinutes, gameplayConfig, triggerFiresAt } from "./world";

export type ThesisFocusMode = "normal" | "deep" | "rush";
export type ThesisFlowPhase = "warmup" | "flow" | "burnout";

export const THESIS_FOCUS_MODES: readonly ThesisFocusMode[] = ["normal", "deep", "rush"];
export const THESIS_TOTAL_WORDS = 10_000;
export const THESIS_MIN_SESSION_MINUTES = 15;
export const THESIS_MAX_SESSION_MINUTES = 240;

export interface FocusModeProfile {
  readonly mode: ThesisFocusMode;
  readonly outputMultiplier: number;
  readonly fatigueMultiplier: number;
  readonly warmupMinutes: number;
  readonly burnoutStartMinute: number;
  /** When true, routine incoming messages/emails are held silently until the session finishes. */
  readonly suppressRoutineInterruptions: boolean;
}

export const FOCUS_MODE_PROFILES: Readonly<Record<ThesisFocusMode, FocusModeProfile>> = {
  normal: {
    mode: "normal",
    outputMultiplier: 1.0,
    fatigueMultiplier: 1.0,
    warmupMinutes: 20,
    burnoutStartMinute: 105,
    suppressRoutineInterruptions: false,
  },
  deep: {
    mode: "deep",
    outputMultiplier: 1.2,
    fatigueMultiplier: 1.12,
    warmupMinutes: 15,
    burnoutStartMinute: 120,
    suppressRoutineInterruptions: true,
  },
  rush: {
    mode: "rush",
    outputMultiplier: 1.32,
    fatigueMultiplier: 1.55,
    warmupMinutes: 10,
    burnoutStartMinute: 75,
    suppressRoutineInterruptions: false,
  },
};

/** Story starts at Tuesday 17:00 (`elapsedMinutes = 0`). Returns 24h clock hour [0..24). */
export function storyClockHourAt(elapsedMinutes: number): number {
  return ((17 * 60 + elapsedMinutes) % (24 * 60) + 24 * 60) % (24 * 60) / 60;
}

/** Circadian alertness modifier: late night (01:00–05:00) drains focus and increases fatigue. */
export function circadianAt(elapsedMinutes: number): {
  outputMult: number;
  fatigueMult: number;
  isLateNight: boolean;
} {
  const h = storyClockHourAt(elapsedMinutes);
  if (h >= 1 && h < 5) {
    return { outputMult: 0.78, fatigueMult: 1.3, isLateNight: true };
  }
  if (h >= 23 || h < 1) {
    return { outputMult: 0.92, fatigueMult: 1.12, isLateNight: false };
  }
  return { outputMult: 1.0, fatigueMult: 1.0, isLateNight: false };
}

/**
 * Instantaneous non-linear cognitive productivity multiplier at `minuteInSession` (0..240):
 * - Warm-up (0..warmupMinutes): ramps 0.58 -> 1.00
 * - Peak Flow (warmupMinutes..burnoutStart): smooth arch peaking at ~1.34x
 * - Burnout (> burnoutStart): decays smoothly toward 0.42x while fatigue accelerates
 */
export function sessionCurveAt(
  minuteInSession: number,
  mode: ThesisFocusMode,
): { phase: ThesisFlowPhase; rate: number; extraFatigueMult: number } {
  const p = FOCUS_MODE_PROFILES[mode];
  if (minuteInSession < p.warmupMinutes) {
    const t = Math.max(0, minuteInSession) / Math.max(1, p.warmupMinutes);
    return {
      phase: "warmup",
      rate: (0.58 + 0.42 * t) * p.outputMultiplier,
      extraFatigueMult: 0.9,
    };
  }
  if (minuteInSession <= p.burnoutStartMinute) {
    const span = Math.max(1, p.burnoutStartMinute - p.warmupMinutes);
    const u = (minuteInSession - p.warmupMinutes) / span; // 0..1 across Flow window
    // Smooth parabolic arch: 1.00 at edges, 1.34 at peak flow!
    const arch = 1.0 + 0.34 * Math.sin(u * Math.PI);
    return {
      phase: "flow",
      rate: arch * p.outputMultiplier,
      extraFatigueMult: 1.0,
    };
  }
  const over = minuteInSession - p.burnoutStartMinute;
  // Exponential burnout decay toward 0.42 floor.
  const decay = 0.42 + 0.58 * Math.exp(-over / 55);
  const burnoutStrain = 1.0 + Math.min(0.65, over / 90);
  return {
    phase: "burnout",
    rate: decay * p.outputMultiplier,
    extraFatigueMult: burnoutStrain,
  };
}

export interface ThesisSessionSample {
  minuteOffset: number;
  phase: ThesisFlowPhase;
  rate: number;
  cumulativeProgress: number;
  fatigue: number;
}

export interface ThesisSessionSimulationInput {
  startElapsedMinutes: number;
  plannedMinutes: number;
  startFatigue: number;
  startProgress: number;
  freeWorkMaxPercent: number;
  baseMinutesPerPercent: number;
  mode: ThesisFocusMode;
  fatigueConfig?: FatigueConfig;
}

export interface ThesisSessionSimulation {
  mode: ThesisFocusMode;
  plannedMinutes: number;
  effectiveMinutesSpent: number;
  progressGain: number;
  wordsGain: number;
  fatigueGain: number;
  endFatigue: number;
  peakFlowMinutes: number;
  burnoutMinutes: number;
  hitsLateNight: boolean;
  samples: ThesisSessionSample[];
}

/**
 * Pure deterministic minute-by-minute integrator for a deep-work thesis session.
 * Returns exact integer progressGain, wordsGain, fatigueGain, and sampled curve points for UI preview.
 */
export function simulateThesisSession(
  input: ThesisSessionSimulationInput,
): ThesisSessionSimulation {
  const fatigueCfg = input.fatigueConfig ?? DEFAULT_FATIGUE_CONFIG;
  const profile = FOCUS_MODE_PROFILES[input.mode];
  const planned = Math.max(0, Math.floor(input.plannedMinutes));
  const room = Math.max(0, input.freeWorkMaxPercent - input.startProgress);
  const baseRatePerMinute = 1 / Math.max(1, input.baseMinutesPerPercent);

  let rawProgress = 0;
  let runningFatigue = input.startFatigue;
  let rawFatigueGain = 0;
  let peakFlowMinutes = 0;
  let burnoutMinutes = 0;
  let hitsLateNight = false;
  let effectiveMinutesSpent = 0;
  const samples: ThesisSessionSample[] = [];

  const stepSize = 1;
  for (let m = 0; m < planned; m += stepSize) {
    if (Math.floor(rawProgress) >= room && room > 0) {
      break;
    }
    const storyMin = input.startElapsedMinutes + m;
    const curve = sessionCurveAt(m, input.mode);
    const circ = circadianAt(storyMin);
    if (circ.isLateNight) hitsLateNight = true;
    if (curve.phase === "flow") peakFlowMinutes += stepSize;
    if (curve.phase === "burnout") burnoutMinutes += stepSize;

    const fatigueSlow = workSlowdown(runningFatigue, fatigueCfg);
    const effectiveRate = (curve.rate * circ.outputMult) / Math.max(1, fatigueSlow);
    rawProgress += baseRatePerMinute * effectiveRate * stepSize;

    const baseFatiguePerMin =
      fatigueCfg.enabled && fatigueCfg.perThesisHour > 0
        ? fatigueCfg.perThesisHour / 60
        : 0;
    const deltaF =
      baseFatiguePerMin *
      profile.fatigueMultiplier *
      curve.extraFatigueMult *
      circ.fatigueMult *
      stepSize;
    rawFatigueGain += deltaF;
    runningFatigue = Math.min(100, input.startFatigue + rawFatigueGain);
    effectiveMinutesSpent = m + stepSize;

    if (m % 5 === 0 || m === planned - 1) {
      samples.push({
        minuteOffset: m + stepSize,
        phase: curve.phase,
        rate: Number(effectiveRate.toFixed(2)),
        cumulativeProgress: Math.min(room, Number(rawProgress.toFixed(2))),
        fatigue: Math.round(runningFatigue),
      });
    }
  }

  const progressGain = Math.min(room, Math.floor(rawProgress + 0.0001));
  // Ensure fatigue uses the exact engine config when fatigue is disabled.
  const fatigueGain = fatigueCfg.enabled
    ? Math.max(
        Math.round(rawFatigueGain),
        effectiveMinutesSpent > 0 ? Math.min(100 - input.startFatigue, workFatigue(Math.round(effectiveMinutesSpent * 0.6), fatigueCfg)) : 0,
      )
    : 0;
  const endFatigue = Math.min(100, input.startFatigue + fatigueGain);

  return {
    mode: input.mode,
    plannedMinutes: planned,
    effectiveMinutesSpent,
    progressGain,
    wordsGain: progressGain * Math.round(THESIS_TOTAL_WORDS / 100),
    fatigueGain,
    endFatigue,
    peakFlowMinutes,
    burnoutMinutes,
    hitsLateNight,
    samples,
  };
}

export type SessionInterruptionKind =
  | "story_event"
  | "device_item"
  | "eye_strain"
  | "minh_ping"
  | "citation_gap";

export interface SessionInterruption {
  id: string;
  atSessionMinute: number;
  kind: SessionInterruptionKind;
  urgent: boolean;
  /** Localized short title + description (EN/VI). */
  title: { en: string; vi: string };
  body: { en: string; vi: string };
  /** Target laptop/phone app hint if the player chooses to pause and check now. */
  appHint?: "email" | "chat" | "bank" | "phone";
}

/**
 * Deterministically predicts interruptions arriving inside `(startElapsed, startElapsed + plannedMinutes]`.
 * Combines real scheduled Mission 01–05 events/emails/messages with organic deep-work dilemmas on longer blocks.
 */
export function findSessionInterruptions(
  state: ChapterState,
  scenario: ScenarioDefinition,
  plannedMinutes: number,
  mode: ThesisFocusMode,
): SessionInterruption[] {
  const start = elapsedMinutes(state, scenario);
  const end = start + plannedMinutes;
  const profile = FOCUS_MODE_PROFILES[mode];
  const found: SessionInterruption[] = [];

  // 1. Real scheduled narrative events arriving inside this writing block!
  for (const ev of scenario.events ?? []) {
    if (Object.hasOwn(state.world.events, ev.id)) continue;
    const at = triggerFiresAt(ev.trigger, state, scenario, end);
    if (at === null || at <= start || at > end) continue;
    const isUrgent = /security|bank|clearance|emergency|immigration|portal|urgent/i.test(ev.id);
    if (profile.suppressRoutineInterruptions && !isUrgent) continue;
    found.push({
      id: `ev:${ev.id}`,
      atSessionMinute: Math.max(1, at - start),
      kind: "story_event",
      urgent: isUrgent,
      appHint: isUrgent ? "bank" : "chat",
      title: isUrgent
        ? { en: "Urgent Alert Arrived", vi: "Cảnh báo khẩn vừa đến" }
        : { en: "New Story Notification", vi: "Thông báo mới trên thiết bị" },
      body: isUrgent
        ? {
            en: "Your phone vibrated face-down with an urgent account/clearance alert. Pause to verify now, or push through your Flow?",
            vi: "Điện thoại rung mạnh vì một cảnh báo tài khoản/xác nhận khẩn. Dừng lại kiểm tra ngay hay gạt qua để giữ nhịp Flow?",
          }
        : {
            en: "A new message just popped up while you're drafting Chapter 3. Stopping now will break your current Flow.",
            vi: "Một thông báo mới vừa hiện lên khi bạn đang viết Chương 3. Dừng lại lúc này sẽ làm đứt mạch tập trung.",
          },
    });
  }

  // 2. Real scheduled device items (mail, messages, bank alerts) arriving inside this writing block!
  for (const item of scenario.deviceItems ?? []) {
    if (!item.arrives || Object.hasOwn(state.device.items, item.id)) continue;
    const at = triggerFiresAt(item.arrives, state, scenario, end);
    if (at === null || at <= start || at > end) continue;
    const isUrgent = item.app === "bank" || /clearance|bank|alert|lock|security/i.test(item.id);
    if (profile.suppressRoutineInterruptions && !isUrgent) continue;
    const appHint = item.app === "mail" ? "email" : item.app === "bank" ? "bank" : "chat";
    found.push({
      id: `item:${item.id}`,
      atSessionMinute: Math.max(1, at - start),
      kind: "device_item",
      urgent: isUrgent,
      appHint,
      title:
        item.app === "mail"
          ? { en: "New Email on Laptop", vi: "Email mới vừa gửi tới" }
          : item.app === "bank"
            ? { en: "Bank App Alert!", vi: "Cảnh báo từ ứng dụng Ngân hàng!" }
            : { en: "Incoming Phone Message", vi: "Tin nhắn mới trên điện thoại" },
      body:
        item.app === "bank"
          ? {
              en: "Your banking app just pinged with transaction activity! Ignoring this in Deep Focus could cost real money.",
              vi: "Ứng dụng ngân hàng vừa báo biến động bất thường! Bỏ qua lúc này để cày tiếp có thể gây thiệt hại thật.",
            }
          : item.app === "mail"
            ? {
                en: "An email just landed in your student inbox. Check it now (breaks Flow) or finish your writing block first?",
                vi: "Một email vừa gửi tới hộp thư sinh viên. Dừng viết để mở ngay (đứt Flow) hay hoàn thành phiên viết trước?",
              }
            : {
                en: "Someone just texted your phone. Answer now or keep your head down in the thesis?",
                vi: "Có tin nhắn vừa gửi tới điện thoại. Mở xem ngay hay tập trung viết nốt khóa luận?",
              },
    });
  }

  // 3. Organic deterministic deep-work dilemmas on longer sessions (>= 90m) when no scripted interruption precedes them.
  if (plannedMinutes >= 90) {
    const cfg = gameplayConfig(scenario);
    const sim = simulateThesisSession({
      startElapsedMinutes: start,
      plannedMinutes,
      startFatigue: state.resources.fatigue,
      startProgress: state.resources.thesisProgress,
      freeWorkMaxPercent: cfg.thesisFreeWorkMaxPercent,
      baseMinutesPerPercent: cfg.thesisMinutesPerPercent,
      mode,
      fatigueConfig: cfg.fatigue,
    });
    const eyeStrainSample = sim.samples.find((s) => s.fatigue >= 72 && s.minuteOffset >= 35);
    if (eyeStrainSample) {
      found.push({
        id: `dilemma:eye_strain:${start}`,
        atSessionMinute: eyeStrainSample.minuteOffset,
        kind: "eye_strain",
        urgent: false,
        title: {
          en: "Eye Strain & Blurred Lines",
          vi: "Mỏi mắt & bắt đầu mất tập trung",
        },
        body: {
          en: "Your vision is blurring over Chapter 3 citations and your typing speed is dropping. Stop early to rest, or force yourself through Burnout?",
          vi: "Chữ trên màn hình bắt đầu nhòe đi và tốc độ gõ chậm rõ rệt. Dừng sớm để nghỉ hay cố ép bản thân vượt ngưỡng quá tải?",
        },
      });
    } else if (!profile.suppressRoutineInterruptions) {
      const checkMinute = Math.min(plannedMinutes - 15, 65);
      found.push({
        id: `dilemma:citation:${start}`,
        atSessionMinute: checkMinute,
        kind: "citation_gap",
        urgent: false,
        title: {
          en: "Missing Table 3.2 Citation",
          vi: "Thiếu nguồn trích dẫn Bảng 3.2",
        },
        body: {
          en: "Dr. Nguyễn flagged an unverified citation in Section 3.2. Pause to cross-check your folder now, or leave a [TODO] tag and protect your Flow?",
          vi: "TS. Nguyễn từng đánh dấu thiếu nguồn ở Mục 3.2. Dừng lại tra cứu tài liệu ngay hay đánh dấu [TODO] để giữ mạch Flow?",
        },
      });
    }
  }

  // Sort chronologically and deduplicate very close timestamps (within 5 minutes).
  found.sort((a, b) => a.atSessionMinute - b.atSessionMinute);
  const deduped: SessionInterruption[] = [];
  for (const item of found) {
    const prev = deduped[deduped.length - 1];
    if (prev && item.atSessionMinute - prev.atSessionMinute < 5) {
      if (item.urgent && !prev.urgent) deduped[deduped.length - 1] = item;
      continue;
    }
    deduped.push(item);
  }
  return deduped;
}

/** Realistic evolving manuscript snippets shown live inside the Word-style thesis draft view. */
export const THESIS_MANUSCRIPT_SECTIONS: readonly {
  minProgress: number;
  heading: { en: string; vi: string };
  comment: { en: string; vi: string };
  draftText: { en: string; vi: string };
}[] = [
  {
    minProgress: 0,
    heading: {
      en: "3.1 Research Methodology & Student Sample",
      vi: "3.1 Phương pháp nghiên cứu & Mẫu sinh viên",
    },
    comment: {
      en: "Dr. Nguyễn: Tighten the sample justification for District 10 & District 5 respondents before Friday.",
      vi: "TS. Nguyễn: Cần làm rõ lý do chọn mẫu sinh viên khu vực Quận 10 & Quận 5 trước hạn thứ Sáu.",
    },
    draftText: {
      en: "Semi-structured interviews were conducted with 24 undergraduate students navigating high-pressure academic deadlines in Ho Chi Minh City. Findings indicate that cognitive load and time scarcity directly correlate with reduced verification behavior when confronted with official-looking digital notices...",
      vi: "Phỏng vấn bán cấu trúc được thực hiện với 24 sinh viên đại học đang đối mặt áp lực hạn chót học thuật tại TP.HCM. Kết quả cho thấy tình trạng quá tải nhận thức và áp lực thời gian tỷ lệ thuận trực tiếp với việc suy giảm hành vi kiểm chứng khi tiếp nhận thông báo số giả mạo cơ quan chính thức...",
    },
  },
  {
    minProgress: 70,
    heading: {
      en: "3.2 Urgency Framing & Social Proof Traps",
      vi: "3.2 Khung áp lực khẩn cấp & Bẫy bằng chứng xã hội",
    },
    comment: {
      en: "Minh: Added our interview quotes here — verify Table 3.2 percentages once you finish the analysis.",
      vi: "Minh: Mình đã dán trích dẫn phỏng vấn vào đây — cậu đối chiếu lại số liệu Bảng 3.2 sau khi viết xong phân tích nhé.",
    },
    draftText: {
      en: "Across 18 documented social-engineering attempts targeting university cohorts, attackers systematically combined institutional authority cues (student clearance, administrative portals) with compressed response windows under 30 minutes. Participants experiencing fatigue above baseline were 2.4× more likely to bypass secondary channel checks...",
      vi: "Trong 18 tình huống lừa đảo kỹ nghệ xã hội nhắm vào sinh viên được ghi nhận, kẻ gian kết hợp có hệ thống dấu hiệu uy tín tổ chức (xác nhận tốt nghiệp, cổng đào tạo) cùng khung thời gian phản hồi ép dưới 30 phút. Người tham gia đang trong trạng thái mệt mỏi có xác suất bỏ qua bước kiểm chứng chéo cao gấp 2,4 lần...",
    },
  },
  {
    minProgress: 85,
    heading: {
      en: "3.3 Synthesis & Final Pre-Submission Review",
      vi: "3.3 Tổng hợp kết quả & Rà soát trước khi nộp",
    },
    comment: {
      en: "Dr. Nguyễn: Strong draft. Finalize the District 5 participant verification and keep an offline backup before uploading.",
      vi: "TS. Nguyễn: Bản thảo tốt. Hoàn thiện xác nhận phỏng vấn Quận 5 và nhớ sao lưu ngoại tuyến trước khi tải lên cổng nộp bài.",
    },
    draftText: {
      en: "In conclusion, digital resilience among university students is not solely a function of technical literacy, but an interplay between rest, financial buffer, and institutional verification habits. Implementing a deliberate pause protocol prior to credential entry or financial transfer reduces susceptibility across all five observed vectors...",
      vi: "Kết luận cho thấy năng lực chống chịu số của sinh viên không chỉ phụ thuộc vào hiểu biết kỹ thuật, mà là sự tương tác giữa trạng thái nghỉ ngơi, vùng đệm tài chính và thói quen xác minh chính thức. Thiết lập nguyên tắc dừng kiểm chứng trước khi nhập mật khẩu hoặc chuyển tiền giúp giảm mạnh rủi ro trên cả năm nhóm kịch bản...",
    },
  },
];

export interface ThesisMicroDecisionOption {
  id: string;
  effect: "flow_boost" | "sprint_burst" | "clear_strain";
  label: { en: string; vi: string };
  outcomeStamp: { en: string; vi: string };
  /** Temporary UI pace multiplier adjustment for the rest of this active session. */
  paceDelta: number;
  /** Temporary visual eye-strain offset (-0.35 clears late-night fatigue haze, +0.2 adds push strain). */
  strainDelta: number;
}

export interface ThesisMicroDecision {
  id: string;
  minProgress: number;
  prompt: { en: string; vi: string };
  options: readonly [
    ThesisMicroDecisionOption,
    ThesisMicroDecisionOption,
    ThesisMicroDecisionOption,
  ];
}

/** Tactile inline manuscript micro-decisions that surface mid-session inside the Word editor. */
export const THESIS_MICRO_DECISIONS: readonly ThesisMicroDecision[] = [
  {
    id: "sample_rigor",
    minProgress: 0,
    prompt: {
      en: "Margin snag: Table 3.1 sample counts don't quite match Minh's raw CSV from District 10. How do you handle it?",
      vi: "Vướng số liệu: Bảng 3.1 hơi lệch với file CSV thô của Minh ở Quận 10. Bạn xử lý thế nào?",
    },
    options: [
      {
        id: "cross_check",
        effect: "flow_boost",
        label: {
          en: "Cross-check Minh's CSV & lock the table",
          vi: "Đối chiếu lại CSV của Minh & chốt bảng chuẩn",
        },
        outcomeStamp: {
          en: "✓ Verified against raw interview sheet — Peak Flow locked",
          vi: "✓ Đã đối chiếu bảng phỏng vấn gốc — Mạch Flow vững vàng",
        },
        paceDelta: 0.14,
        strainDelta: -0.05,
      },
      {
        id: "placeholder_sprint",
        effect: "sprint_burst",
        label: {
          en: "Drop a [CHECK] tag and sprint ahead",
          vi: "Đánh dấu [CHECK] rồi đẩy nhanh sang đoạn tiếp",
        },
        outcomeStamp: {
          en: "⚡ Drafting burst active — remember to double-check later",
          vi: "⚡ Đang tăng tốc gõ — nhớ quay lại rà số liệu sau",
        },
        paceDelta: 0.24,
        strainDelta: 0.18,
      },
      {
        id: "sip_coffee",
        effect: "clear_strain",
        label: {
          en: "Sip iced coffee, stretch eyes for 60s",
          vi: "Uống ngụm cà phê sữa đá, thả lỏng mắt 60 giây",
        },
        outcomeStamp: {
          en: "☕ Vision refreshed — steadier cadence for the long haul",
          vi: "☕ Mắt dịu lại — nhịp gõ ổn định và đỡ mỏi hơn",
        },
        paceDelta: 0.05,
        strainDelta: -0.35,
      },
    ],
  },
  {
    id: "citation_framing",
    minProgress: 70,
    prompt: {
      en: "Dr. Nguyễn's margin note asks for a concrete Vietnamese student case study in Section 3.2.",
      vi: "Ghi chú lề của TS. Nguyễn yêu cầu bổ sung một tình huống thực tế của sinh viên VN vào Mục 3.2.",
    },
    options: [
      {
        id: "cite_transcript",
        effect: "flow_boost",
        label: {
          en: "Quote the verified District 5 interview cleanly",
          vi: "Trích dẫn chuẩn lời phỏng vấn sinh viên Quận 5",
        },
        outcomeStamp: {
          en: "✓ Case study anchored — Supervisor rubric satisfied",
          vi: "✓ Đã gắn tình huống thực tế — Đạt tiêu chí giảng viên",
        },
        paceDelta: 0.16,
        strainDelta: -0.05,
      },
      {
        id: "rapid_outline",
        effect: "sprint_burst",
        label: {
          en: "Draft rapid bullet synthesis in one push",
          vi: "Gạch ý nhanh một mạch để giữ tốc độ",
        },
        outcomeStamp: {
          en: "⚡ High-speed synthesis — heavy keyboard rhythm",
          vi: "⚡ Tổng hợp tốc độ cao — nhịp gõ căng tay",
        },
        paceDelta: 0.25,
        strainDelta: 0.18,
      },
      {
        id: "dim_brightness",
        effect: "clear_strain",
        label: {
          en: "Lower laptop glare & roll shoulders",
          vi: "Hạ độ sáng màn hình laptop & xoay vai đỡ mỏi",
        },
        outcomeStamp: {
          en: "🌙 Screen glare softened — late-night focus preserved",
          vi: "🌙 Đã dịu ánh sáng màn hình — giữ tỉnh táo tốt hơn",
        },
        paceDelta: 0.06,
        strainDelta: -0.35,
      },
    ],
  },
  {
    id: "final_backup",
    minProgress: 85,
    prompt: {
      en: "Final synthesis is rolling smoothly — Saigon traffic hums outside Room 6.07. Next move?",
      vi: "Phần kết luận đang trôi rất mượt — ngoài cửa sổ phòng 6.07 Sài Gòn vẫn rì rầm. Bước tiếp theo?",
    },
    options: [
      {
        id: "local_backup",
        effect: "flow_boost",
        label: {
          en: "Save an offline PDF snapshot & polish citations",
          vi: "Sao lưu bản PDF ngoại tuyến & trau chuốt trích dẫn",
        },
        outcomeStamp: {
          en: "✓ Offline backup saved — calm final-stretch Flow",
          vi: "✓ Đã sao lưu ngoại tuyến — tâm lý vững vàng chặng cuối",
        },
        paceDelta: 0.15,
        strainDelta: -0.08,
      },
      {
        id: "finish_sprint",
        effect: "sprint_burst",
        label: {
          en: "Eyes on the finish line — push full speed",
          vi: "Nhìn thẳng vạch đích — tăng tốc viết hết đoạn",
        },
        outcomeStamp: {
          en: "⚡ Final sprint engaged — word counter flying",
          vi: "⚡ Nước rút chặng cuối — số từ tăng vùn vụt",
        },
        paceDelta: 0.26,
        strainDelta: 0.16,
      },
      {
        id: "open_window_air",
        effect: "clear_strain",
        label: {
          en: "Breathe cool night air by the balcony door",
          vi: "Hít một hơi gió đêm từ cửa sổ phòng 6.07",
        },
        outcomeStamp: {
          en: "🌬️ Fresh air cleared the mental fog",
          vi: "🌬️ Gió đêm làm tan cơn buồn ngủ",
        },
        paceDelta: 0.06,
        strainDelta: -0.38,
      },
    ],
  },
];

/** Picks the matching inline academic micro-decision for Alex's current thesis progress. */
export function pickSessionMicroDecision(progress: number): ThesisMicroDecision {
  let pick = THESIS_MICRO_DECISIONS[0];
  for (const item of THESIS_MICRO_DECISIONS) {
    if (progress >= item.minProgress) pick = item;
  }
  return pick;
}
