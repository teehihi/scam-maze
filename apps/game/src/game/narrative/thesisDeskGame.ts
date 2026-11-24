// Pure, deterministic interactive gameplay content & matching logic for Alex's Thesis Desk
// ("Draft · Stamp · Proofread": Monkeytype-style accent-tolerant flow typing + Papers-Please
// drag-and-drop evidence stamping + Red-Pen proofreading).

export interface LocalizedStr {
  en: string;
  vi: string;
}

export interface DeskEvidenceCard {
  id: string;
  badge: string;
  title: LocalizedStr;
  detail: LocalizedStr;
  stampLabel: LocalizedStr;
  /** True for legitimate academic sources; false for unverified rumors / traps. */
  verified: boolean;
}

export interface DeskTypeStep {
  id: string;
  kind: "type";
  sectionTitle: LocalizedStr;
  leadIn: LocalizedStr;
  /** Short, rhythmic phrase the player physically types (accent-tolerant for VI). */
  targetPhrase: LocalizedStr;
  tail: LocalizedStr;
  wordsReward: number;
  minutesReward: number;
}

export interface DeskCiteStep {
  id: string;
  kind: "cite";
  sectionTitle: LocalizedStr;
  beforeSlot: LocalizedStr;
  afterSlot: LocalizedStr;
  /** Prompt shown in the amber drop slot on the Word page. */
  slotHint: LocalizedStr;
  /** Which evidence card ID from the desk tray correctly verifies this claim. */
  correctCardId: string;
  /** The 3 cards placed on the right-hand Research Desk for this step. */
  cardIds: readonly [string, string, string];
  wordsReward: number;
  minutesReward: number;
}

export interface DeskProofreadSegment {
  id: string;
  text: LocalizedStr;
  isError: boolean;
  correction?: LocalizedStr;
}

export interface DeskProofreadStep {
  id: string;
  kind: "proofread";
  sectionTitle: LocalizedStr;
  instruction: LocalizedStr;
  segments: readonly DeskProofreadSegment[];
  wordsReward: number;
  minutesReward: number;
}

export type ThesisDeskStep = DeskTypeStep | DeskCiteStep | DeskProofreadStep;

/** Accent-insensitive normalization so Vietnamese players can type effortlessly with or without Unikey. */
export function normalizeDeskChar(ch: string): string {
  return ch
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();
}

export function matchDeskKey(typedKey: string, expectedChar: string): boolean {
  if (typedKey.length !== 1) return false;
  return normalizeDeskChar(typedKey) === normalizeDeskChar(expectedChar);
}

/** Research slips lying on Alex's right-hand desk tray. */
export const DESK_EVIDENCE_CARDS: Record<string, DeskEvidenceCard> = {
  minh_csv: {
    id: "minh_csv",
    badge: "CSV",
    title: { en: "Minh's Raw Survey (D10)", vi: "Bảng CSV Minh — Q.10" },
    detail: {
      en: "24 UEH students · 62% skipped checks under <30m urgency.",
      vi: "24 SV UEH · 62% bỏ qua kiểm chứng khi bị ép dưới 30 phút.",
    },
    stampLabel: { en: "[Minh CSV, n=24 ✓]", vi: "[CSV Minh, n=24 ✓]" },
    verified: true,
  },
  coba_interview: {
    id: "coba_interview",
    badge: "REC",
    title: { en: "Cô Ba Interview (D5)", vi: "Ghi âm Cô Ba — Q.5" },
    detail: {
      en: "Shopkeeper quote on spotting fake transfer screenshots.",
      vi: "Trích dẫn thật về cách nhận diện bill chuyển khoản giả.",
    },
    stampLabel: { en: "[D5 Interview ✓]", vi: "[Phỏng vấn Q.5 ✓]" },
    verified: true,
  },
  ueh_report: {
    id: "ueh_report",
    badge: "PDF",
    title: { en: "UEH Anti-Fraud Bulletin", vi: "Báo cáo An toàn UEH" },
    detail: {
      en: "Official Student Affairs domain checklist (.edu.vn only).",
      vi: "Hướng dẫn đối chiếu tên miền chính thức Phòng Đào tạo.",
    },
    stampLabel: { en: "[UEH Bulletin 2026 ✓]", vi: "[Báo cáo UEH 2026 ✓]" },
    verified: true,
  },
  fb_rumor: {
    id: "fb_rumor",
    badge: "???",
    title: { en: "Viral Facebook Post", vi: "Bài đăng tin đồn Facebook" },
    detail: {
      en: "Anonymous screenshot · '99% students hacked via WiFi!'",
      vi: "Ảnh chụp ẩn danh · Không có số liệu kiểm chứng.",
    },
    stampLabel: { en: "[Unverified!]", vi: "[Chưa kiểm chứng!]" },
    verified: false,
  },
  ai_fake_cite: {
    id: "ai_fake_cite",
    badge: "AI?",
    title: { en: "Unchecked AI Citation", vi: "Trích dẫn AI chưa soát" },
    detail: {
      en: "Journal of Cyber Magic (2029) — DOI does not exist.",
      vi: "Tạp chí không tồn tại — dễ bị hội đồng đánh rớt.",
    },
    stampLabel: { en: "[Hallucinated!]", vi: "[Trích dẫn ảo!]" },
    verified: false,
  },
};

/**
 * Curated rotating deck of interactive drafting, citation-stamping, and red-pen proofreading steps.
 * Every 3 steps ≈ 1 full 60m–90m thesis session block with rich variety and zero idle waiting.
 */
export const THESIS_DESK_STEPS: readonly ThesisDeskStep[] = [
  {
    id: "step_type_urgency",
    kind: "type",
    sectionTitle: { en: "3.1 Urgency & Cognitive Load", vi: "3.1 Áp lực thời gian & Nhận thức" },
    leadIn: {
      en: "When confronted with a 30-minute deadline notice, exhausted students frequently bypass ",
      vi: "Khi đối mặt thông báo khẩn ép hạn 30 phút, sinh viên mệt mỏi thường bỏ qua bước ",
    },
    targetPhrase: { en: "source verification", vi: "kiem chung cheo" },
    tail: {
      en: " and click unfamiliar portal links.",
      vi: " và bấm thẳng vào đường dẫn lạ.",
    },
    wordsReward: 180,
    minutesReward: 22,
  },
  {
    id: "step_cite_d10",
    kind: "cite",
    sectionTitle: { en: "3.1 Student Sample Data", vi: "3.1 Dữ liệu khảo sát sinh viên" },
    beforeSlot: {
      en: "Empirical interviews conducted across District 10 campuses ",
      vi: "Kết quả phỏng vấn thực địa tại khu vực Quận 10 ",
    },
    afterSlot: {
      en: " confirm that sleep deprivation doubles credential-phishing susceptibility.",
      vi: " xác nhận thiếu ngủ làm tăng gấp đôi nguy cơ lộ tài khoản.",
    },
    slotHint: {
      en: "Drag Minh's D10 CSV here",
      vi: "Kéo Bảng CSV Minh (Q.10) vào đây",
    },
    correctCardId: "minh_csv",
    cardIds: ["minh_csv", "fb_rumor", "ueh_report"],
    wordsReward: 240,
    minutesReward: 24,
  },
  {
    id: "step_proof_sample",
    kind: "proofread",
    sectionTitle: { en: "3.1 Methodology Proofread", vi: "3.1 Rà soát lỗi phương pháp" },
    instruction: {
      en: "Red Pen: Click the factual mistake in this draft sentence to strike & fix it!",
      vi: "Bút đỏ: Bấm vào đoạn sai sự thật trong câu thảo để gạch sửa ngay!",
    },
    segments: [
      {
        id: "seg_a",
        text: { en: "Our primary cohort comprised ", vi: "Nhóm khảo sát chính gồm " },
        isError: false,
      },
      {
        id: "seg_err",
        text: { en: "240 retired bankers in Hanoi", vi: "240 nhân viên ngân hàng ở Hà Nội" },
        isError: true,
        correction: {
          en: "24 graduating students in Ho Chi Minh City",
          vi: "24 sinh viên năm cuối tại TP.HCM",
        },
      },
      {
        id: "seg_c",
        text: {
          en: " preparing for final thesis defense.",
          vi: " đang chuẩn bị bảo vệ khóa luận tốt nghiệp.",
        },
        isError: false,
      },
    ],
    wordsReward: 200,
    minutesReward: 20,
  },
  {
    id: "step_type_domain",
    kind: "type",
    sectionTitle: { en: "3.2 Impersonation Signals", vi: "3.2 Dấu hiệu giả mạo tổ chức" },
    leadIn: {
      en: "Before entering any student password, always confirm the address matches the ",
      vi: "Trước khi nhập mật khẩu sinh viên, luôn kiểm tra địa chỉ có đúng ",
    },
    targetPhrase: { en: "official portal", vi: "cong chinh thuc" },
    tail: {
      en: " bookmarked directly from university records.",
      vi: " đã lưu sẵn từ kênh trường hay không.",
    },
    wordsReward: 190,
    minutesReward: 22,
  },
  {
    id: "step_cite_ueh",
    kind: "cite",
    sectionTitle: { en: "3.2 Institutional Verification", vi: "3.2 Quy trình xác minh trường" },
    beforeSlot: {
      en: "Cross-checking administrative clearance notices against ",
      vi: "Đối chiếu các email yêu cầu đóng phí xác nhận tốt nghiệp theo ",
    },
    afterSlot: {
      en: " neutralizes 94% of lookalike-domain login traps.",
      vi: " giúp chặn đứng 94% bẫy đăng nhập giả mạo tên miền.",
    },
    slotHint: {
      en: "Drag UEH Bulletin here",
      vi: "Kéo Báo cáo An toàn UEH vào đây",
    },
    correctCardId: "ueh_report",
    cardIds: ["ai_fake_cite", "ueh_report", "coba_interview"],
    wordsReward: 250,
    minutesReward: 24,
  },
  {
    id: "step_proof_otp",
    kind: "proofread",
    sectionTitle: { en: "3.2 Security Protocol Check", vi: "3.2 Soát quy tắc bảo mật" },
    instruction: {
      en: "Red Pen: Spot & slash the dangerous advice Dr. Nguyễn flagged!",
      vi: "Bút đỏ: Gạch bỏ lời khuyên nguy hiểm mà TS. Nguyễn vừa đánh dấu!",
    },
    segments: [
      {
        id: "seg_a",
        text: { en: "When receiving an urgent bank alert, students should ", vi: "Khi nhận cảnh báo ngân hàng khẩn, sinh viên nên " },
        isError: false,
      },
      {
        id: "seg_err",
        text: { en: "share the 6-digit OTP immediately", vi: "đọc ngay mã OTP 6 số để mở khóa" },
        isError: true,
        correction: {
          en: "hang up and call the bank's official hotline",
          vi: "cúp máy và gọi trực tiếp tổng đài ngân hàng",
        },
      },
      {
        id: "seg_c",
        text: { en: " to protect their tuition balance.", vi: " nhằm bảo vệ tiền học phí và tiền trọ." },
        isError: false,
      },
    ],
    wordsReward: 210,
    minutesReward: 20,
  },
  {
    id: "step_type_pause",
    kind: "type",
    sectionTitle: { en: "3.3 Resilience Protocol", vi: "3.3 Nguyên tắc chống chịu số" },
    leadIn: {
      en: "Introducing a deliberate two-minute pause breaks manufactured panic and restores ",
      vi: "Tạo khoảng dừng chủ động hai phút giúp phá vỡ cơn hoảng loạn giả tạo và lấy lại ",
    },
    targetPhrase: { en: "calm judgment", vi: "tinh tao phan doan" },
    tail: {
      en: " before any money or credentials leave the student's device.",
      vi: " trước khi tiền hoặc mật khẩu rời khỏi thiết bị.",
    },
    wordsReward: 200,
    minutesReward: 22,
  },
  {
    id: "step_cite_coba",
    kind: "cite",
    sectionTitle: { en: "3.3 Field Verification", vi: "3.3 Đối chứng thực tế Quận 5" },
    beforeSlot: {
      en: "Qualitative field notes from District 5 small merchants ",
      vi: "Ghi chép thực địa từ các tiểu thương tại Quận 5 ",
    },
    afterSlot: {
      en: " show that waiting for the bank SMS confirmation prevents forged-receipt losses.",
      vi: " chứng minh chỉ giao hàng khi tiền thật sự nổi trên ứng dụng ngân hàng.",
    },
    slotHint: {
      en: "Drag Cô Ba Interview here",
      vi: "Kéo Ghi âm Cô Ba (Q.5) vào đây",
    },
    correctCardId: "coba_interview",
    cardIds: ["fb_rumor", "minh_csv", "coba_interview"],
    wordsReward: 260,
    minutesReward: 24,
  },
];

/** Display version of the target phrase with authentic Vietnamese diacritics while matching accepts plain ASCII too! */
export const TARGET_PHRASE_DISPLAY_VI: Record<string, string> = {
  step_type_urgency: "kiểm chứng chéo",
  step_type_domain: "cổng chính thức",
  step_type_pause: "tỉnh táo phán đoán",
};

export function getDisplayTargetPhrase(step: DeskTypeStep, isVi: boolean): string {
  if (isVi && TARGET_PHRASE_DISPLAY_VI[step.id]) {
    return TARGET_PHRASE_DISPLAY_VI[step.id];
  }
  return isVi ? step.targetPhrase.vi : step.targetPhrase.en;
}
