// Canonical 5-mission Story NPC Registry, Verified Saigon Spatial Staging, Ambient Street Barks
// & RDR2/GTA-6 Style Branching Interactive Dialogue for Chapter 1 "LAST SUBMISSION: 72 GIỜ CUỐI".
// Pure TypeScript — zero React / Three.js imports; safe for reducer, UI, 3D Open World, and Vitest.

import type { PersistentFlags } from "../resources";

export type StoryNpcId =
  | "minh"
  | "linh"
  | "hung"
  | "unverified_driver"
  | "interviewee_q5"
  | "landlord_q10"
  | "recruiter_q1"
  | "maya"
  | "supervisor"
  | "training_office";

export type StoryNpcActivity =
  | "idle"
  | "talking"
  | "listening"
  | "phone"
  | "waiting_bus";

export type StoryNpcPropKind =
  | "cafe_laptop"
  | "phone_chat"
  | "phone_gold"
  | "helmet"
  | "clipboard"
  | "portfolio";

export interface LocalizedPair {
  en: string;
  vi: string;
}

export interface StoryNpcScheduleSlot {
  /** Inclusive elapsed minutes since Tuesday 17:00 (0..4320). */
  startMinute: number;
  endMinute: number;
  location: LocalizedPair;
  activity: StoryNpcActivity;
  inOpenWorld: boolean;
}

export interface StoryNpcWorldAnchor {
  x: number;
  y: number;
  z: number;
  yaw: number;
  height: number;
  modelFile: string;
  propKind: StoryNpcPropKind;
  /** Human-readable physical staging cue ("Beside the sidewalk café table"). */
  stagingCue: LocalizedPair;
  district: LocalizedPair;
  /**
   * Present when the NPC notices Alex and walks up to him (the street driver), then walks back to this spot. Distances
   * in metres; `minX`..`maxX` is the sidewalk band he keeps to. Absent: the NPC stays at the spot.
   */
  approach?: { noticeRadius: number; stopDistance: number; leash: number; minX: number; maxX: number };
}

export interface StoryNpcProfile {
  id: StoryNpcId;
  missions: readonly (1 | 2 | 3 | 4 | 5)[];
  name: LocalizedPair;
  role: LocalizedPair;
  shortTag: LocalizedPair;
  accentColor: string;
  /** Physical Saigon 3D open-world anchor (absent for phone-only/remote contacts like Maya). */
  worldAnchor?: StoryNpcWorldAnchor;
  schedule: readonly StoryNpcScheduleSlot[];
}

export interface StoryNpcRuntimeContext {
  elapsedMinutes: number;
  thesisProgress: number;
  fatigue: number;
  money: number;
  flags: Partial<PersistentFlags>;
}

export type StoryNpcMood = "calm" | "urgent" | "guarded" | "persuasive" | "supportive" | "defensive";

export interface StoryNpcReplyOption {
  id: string;
  /** Stable recording key for the NPC's spoken answer; absent on legacy dialogue until it is voiced. */
  voiceId?: string;
  /** Stable recording key for Alex's spoken version of this reply label. */
  labelVoiceId?: string;
  /** Short RDR2/GTA-6 style reply label shown next to [1] / [2] / [3]. */
  label: LocalizedPair;
  /** Tone badge for quick reading. */
  tone: "inquire" | "challenge" | "support" | "leave";
  /** NPC's immediate response line when Alex selects this reply. */
  response: LocalizedPair;
  /** Mood the NPC shifts into upon hearing this reply. */
  nextMood: StoryNpcMood;
  /** Optional subtle narrative/scam-awareness insight unlocked by asking the right question. */
  insight?: LocalizedPair;
}

export interface StoryNpcDialogueTurn {
  npcId: StoryNpcId;
  /** Stable voice/subtitle recording key for the opening spoken line. */
  openingVoiceId?: string;
  speaker: LocalizedPair;
  role: LocalizedPair;
  missionBadge: string;
  mood: StoryNpcMood;
  /** Natural ambient street callout when Alex passes within ~7.5m (before pressing [E]). */
  ambientBark: LocalizedPair;
  /** Stable recording key for the ambient callout; absent when it stays a written callout. */
  ambientVoiceId?: string;
  /** Opening spoken line when Alex engages the NPC. */
  lines: readonly LocalizedPair[];
  /** Interactive RDR2/GTA-6 style player replies ([1], [2], [3]). */
  replies: readonly StoryNpcReplyOption[];
  /** Optional subtle red-flag or mission-hook hint shown in the subtitle footer. */
  hookNote?: LocalizedPair;
}

const CURB_Y = 0.16;

export const STORY_NPC_CAST: readonly StoryNpcProfile[] = [
  {
    id: "minh",
    missions: [1, 2, 3, 4, 5],
    name: { en: "Minh", vi: "Minh" },
    role: { en: "Thesis Partner", vi: "Bạn cùng nhóm khóa luận" },
    shortTag: { en: "M01–M05 · Partner", vi: "NV 01–05 · Đồng đội" },
    accentColor: "#38bdf8",
    // Staged right beside the real sidewalk café table (`table-set` at x=4.4, z=-19) & bánh mì stall!
    worldAnchor: {
      x: 3.55,
      y: CURB_Y,
      z: -19.2,
      yaw: 1.32,
      height: 1.72,
      modelFile: "npc-minh.optimized.glb",
      propKind: "cafe_laptop",
      stagingCue: { en: "At the Lý Thái Tổ sidewalk café table", vi: "Bên bàn cà phê vỉa hè Lý Thái Tổ" },
      district: { en: "Lý Thái Tổ Sidewalk Café", vi: "Cà phê vỉa hè Lý Thái Tổ" },
    },
    schedule: [
      {
        startMinute: 0,
        endMinute: 1200,
        location: { en: "Lý Thái Tổ sidewalk café table", vi: "Bàn cà phê vỉa hè Lý Thái Tổ" },
        activity: "talking",
        inOpenWorld: true,
      },
      {
        startMinute: 1200,
        endMinute: 4320,
        location: { en: "Lý Thái Tổ café & UEH campus", vi: "Quán cà phê Lý Thái Tổ & UEH" },
        activity: "idle",
        inOpenWorld: true,
      },
    ],
  },
  {
    id: "linh",
    missions: [1],
    name: { en: "Linh", vi: "Linh" },
    role: { en: "Student from Another Faculty", vi: "Sinh viên khoa khác" },
    shortTag: { en: "M01 · Easy Money", vi: "NV 01 · Việc Nhẹ Lương Cao" },
    accentColor: "#f59e0b",
    // Staged under the shophouse awning right beside the parked PCX scooter (`x=4.4, z=-9.0`) near Hẻm 462/14.
    worldAnchor: {
      x: 3.65,
      y: CURB_Y,
      z: -8.15,
      yaw: -1.55,
      height: 1.64,
      modelFile: "npc-linh.optimized.glb",
      propKind: "phone_chat",
      stagingCue: { en: "By the parked scooter outside Hẻm 462/14", vi: "Cạnh xe máy trước đầu hẻm 462/14" },
      district: { en: "Lý Thái Tổ Shophouse Awning", vi: "Mái hiên đầu hẻm Lý Thái Tổ" },
    },
    schedule: [
      {
        startMinute: 0,
        endMinute: 1620,
        location: { en: "Outside Hẻm 462/14 awning", vi: "Trước đầu hẻm 462/14" },
        activity: "phone",
        inOpenWorld: true,
      },
    ],
  },
  {
    id: "hung",
    missions: [1],
    name: { en: "Hùng", vi: "Hùng" },
    role: { en: "Minh's Cousin's Friend", vi: "Bạn anh họ của Minh" },
    shortTag: { en: "M01 · Golden Platform", vi: "NV 01 · Sàn Đầu Tư Vàng" },
    accentColor: "#eab308",
    // Staged right at the Đường 3/2 commercial boulevard sidewalk café cluster (`z=-66.5`).
    worldAnchor: {
      x: 23.2,
      y: CURB_Y,
      z: -66.4,
      yaw: -3.05,
      height: 1.74,
      modelFile: "npc-napole.optimized.glb",
      propKind: "phone_gold",
      stagingCue: { en: "Outside the Đường 3/2 corner café", vi: "Trước quán cà phê phố Đường 3/2" },
      district: { en: "Đường 3/2 Commercial Strip", vi: "Phố thương mại Đường 3/2" },
    },
    schedule: [
      {
        startMinute: 0,
        endMinute: 2400,
        location: { en: "Đường 3/2 sidewalk café", vi: "Cà phê vỉa hè Đường 3/2" },
        activity: "talking",
        inOpenWorld: true,
      },
    ],
  },
  {
    id: "unverified_driver",
    missions: [2],
    name: { en: "Street Driver", vi: "Tài xế xe ngoài" },
    role: { en: "Unverified Ride Offer", vi: "Xe ôm tự do không qua app" },
    shortTag: { en: "M02 · The Ride", vi: "NV 02 · Chuyến Xe Ngoài" },
    accentColor: "#fb7185",
    // Staged RIGHT BESIDE his parked Honda Super Cub (`x=4.0, z=8.0`) at the south edge of Bus 06 stop!
    worldAnchor: {
      x: 3.25,
      y: CURB_Y,
      z: 7.6,
      yaw: -2.35,
      height: 1.69,
      // Owner-supplied scan, auto-rigged (scripts/rig-tpose.cjs `driver`); walks with the street NPC clips.
      modelFile: "npc-driver.optimized.glb",
      propKind: "helmet",
      // He spots a customer coming to the stop and walks over to make his offer, on the sidewalk only.
      approach: { noticeRadius: 9, stopDistance: 1.75, leash: 7, minX: 0.6, maxX: 6.2 },
      stagingCue: { en: "Leaning beside his parked Super Cub at Bus 06", vi: "Đứng cạnh chiếc xe máy ngay mép trạm Buýt 06" },
      district: { en: "Lý Thái Tổ Bus 06 Stop", vi: "Trạm Buýt 06 Lý Thái Tổ" },
    },
    schedule: [
      {
        startMinute: 0,
        endMinute: 2880,
        location: { en: "Beside parked bike at Bus 06 stop", vi: "Cạnh xe máy ở trạm xe buýt 06" },
        activity: "waiting_bus",
        inOpenWorld: true,
      },
    ],
  },
  {
    id: "landlord_q10",
    missions: [3],
    name: { en: "Mr. Tuấn", vi: "Anh Tuấn" },
    role: { en: "462/14 Boarding House Landlord", vi: "Chủ dãy trọ 462/14" },
    shortTag: { en: "M03 · The Rental", vi: "NV 03 · Cọc Phòng Trọ" },
    accentColor: "#a78bfa",
    // Staged INSIDE the 462/14 courtyard RIGHT IN FRONT OF his real Landlord Notice Board (`x=18.5, z=-6.8`)!
    worldAnchor: {
      x: 18.5,
      y: CURB_Y,
      z: -7.7,
      yaw: Math.PI,
      height: 1.75,
      modelFile: "npc-arthur.optimized.glb",
      propKind: "clipboard",
      stagingCue: { en: "By the courtyard notice board inside 462/14", vi: "Trước bảng thông báo trong sân trọ 462/14" },
      district: { en: "462/14 Courtyard", vi: "Sân dãy trọ 462/14" },
    },
    schedule: [
      {
        startMinute: 0,
        endMinute: 4320,
        location: { en: "462/14 courtyard notice board", vi: "Bảng thông báo sân trọ 462/14" },
        activity: "idle",
        inOpenWorld: true,
      },
    ],
  },
  {
    id: "recruiter_q1",
    missions: [3],
    name: { en: "Ms. Vy", vi: "Chị Vy" },
    role: { en: "Short-Term Project Recruiter", vi: "HR dự án ngắn hạn" },
    shortTag: { en: "M03 · The Job Offer", vi: "NV 03 · Lời Mời Tuyển Dụng" },
    accentColor: "#34d399",
    // Staged RIGHT BESIDE the Bitexco Plaza granite bench (`x=72.5, z=-176`) & tower sign (`x=69.5, z=-180`)!
    worldAnchor: {
      x: 73.4,
      y: CURB_Y,
      z: -176.2,
      yaw: -1.45,
      height: 1.66,
      modelFile: "npc-linmei.optimized.glb",
      propKind: "portfolio",
      stagingCue: { en: "By the Bitexco granite bench & plaza entrance", vi: "Cạnh ghế đá và sảnh chính Bitexco" },
      district: { en: "Bitexco Financial Plaza", vi: "Quảng trường Bitexco Q.1" },
    },
    schedule: [
      {
        startMinute: 0,
        endMinute: 4320,
        location: { en: "Bitexco Plaza District 1", vi: "Quảng trường Bitexco Quận 1" },
        activity: "phone",
        inOpenWorld: true,
      },
    ],
  },
  {
    id: "interviewee_q5",
    missions: [2],
    name: { en: "Cô Ba", vi: "Cô Ba" },
    role: { en: "District 5 Thesis Interviewee", vi: "Nhân vật phỏng vấn Q.5" },
    shortTag: { en: "M02 · Last Interview", vi: "NV 02 · Phỏng Vấn Cuối" },
    accentColor: "#60a5fa",
    // At her stall in the authored Chợ Lớn market (world/choLon.ts, cobaStall), facing the customer side.
    worldAnchor: {
      x: -18.35,
      y: CURB_Y,
      z: -130,
      yaw: 2.8,
      height: 1.58,
      // Owner-supplied scan, auto-rigged (scripts/rig-tpose.cjs `coba`).
      modelFile: "npc-coba.optimized.glb",
      propKind: "clipboard",
      stagingCue: { en: "At the market office main entrance in Chợ Lớn", vi: "Ở cửa chính văn phòng chợ tại Chợ Lớn" },
      district: { en: "Chợ Lớn Market Office · District 5", vi: "Văn phòng chợ Chợ Lớn · Quận 5" },
    },
    schedule: [
      {
        // Wednesday 11:00–14:00, matching the M02 travel and mission deadline window.
        startMinute: 1080,
        endMinute: 1260,
        location: { en: "Chợ Lớn market office main entrance", vi: "Cửa chính văn phòng chợ Chợ Lớn" },
        activity: "idle",
        inOpenWorld: true,
      },
    ],
  },
  {
    id: "maya",
    missions: [4],
    name: { en: "Maya", vi: "Maya" },
    role: { en: "Online Acquaintance", vi: "Người quen qua mạng" },
    shortTag: { en: "M04 · Quiet Message", vi: "NV 04 · Tin Nhắn Khuya" },
    accentColor: "#f472b6",
    schedule: [
      {
        startMinute: 1620,
        endMinute: 3780,
        location: { en: "Phone chat", vi: "Tin nhắn điện thoại" },
        activity: "phone",
        inOpenWorld: false,
      },
    ],
  },
  {
    id: "supervisor",
    missions: [1, 2, 3, 4, 5],
    name: { en: "Dr. Nguyễn", vi: "TS. Nguyễn" },
    role: { en: "Thesis Supervisor", vi: "Giảng viên hướng dẫn" },
    shortTag: { en: "M01–M05 · Supervisor", vi: "NV 01–05 · GVHD" },
    accentColor: "#818cf8",
    schedule: [
      {
        startMinute: 0,
        endMinute: 4320,
        location: { en: "UEH Faculty / Email", vi: "Khoa UEH / Email trường" },
        activity: "idle",
        inOpenWorld: false,
      },
    ],
  },
  {
    id: "training_office",
    missions: [1, 5],
    name: { en: "Training Office", vi: "Phòng Đào tạo" },
    role: { en: "Official Student Portal", vi: "Kênh xác minh chính thức" },
    shortTag: { en: "M01 & M05 · Official", vi: "NV 01 & 05 · Chính thức" },
    accentColor: "#2dd4bf",
    schedule: [
      {
        startMinute: 0,
        endMinute: 4320,
        location: { en: "UEH Academic Portal", vi: "Cổng Đào tạo UEH" },
        activity: "idle",
        inOpenWorld: false,
      },
    ],
  },
];

export const STORY_NPC_MAP: Readonly<Record<StoryNpcId, StoryNpcProfile>> = Object.fromEntries(
  STORY_NPC_CAST.map((npc) => [npc.id, npc]),
) as Record<StoryNpcId, StoryNpcProfile>;

/** All Story NPCs that have a physical 3D presence in the Saigon Open World. */
export const OPEN_WORLD_STORY_NPCS: readonly StoryNpcProfile[] = STORY_NPC_CAST.filter(
  (npc) => npc.worldAnchor != null,
);

/** Resolve the current schedule slot of a Story NPC at `elapsedMinutes` (0..4320). */
export function resolveNpcSchedule(
  npcId: StoryNpcId,
  elapsedMinutes: number,
): StoryNpcScheduleSlot | null {
  const profile = STORY_NPC_MAP[npcId];
  if (!profile) return null;
  return (
    profile.schedule.find(
      (slot) => elapsedMinutes >= slot.startMinute && elapsedMinutes <= slot.endMinute,
    ) ??
    profile.schedule[0] ??
    null
  );
}

/**
 * State-reactive dialogue & RDR2/GTA-6 branching replies across Missions 01–05.
 * Reacts directly to real `PersistentFlags`, thesis progress, and fatigue.
 */
export function resolveStoryNpcDialogue(
  npcId: StoryNpcId,
  ctx: StoryNpcRuntimeContext,
): StoryNpcDialogueTurn {
  const npc = STORY_NPC_MAP[npcId];
  const f = ctx.flags;

  switch (npcId) {
    case "minh": {
      if (f.accountCompromised) {
        return {
          npcId,
          speaker: npc.name,
          role: npc.role,
          missionBadge: "M01 · ACCOUNT RISK",
          mood: "urgent",
          ambientBark: {
            en: "Alex! Over here at the coffee table — my portal login just got kicked out twice!",
            vi: "Alex! Bên bàn cà phê này nè — cổng trường của mình vừa bị đá ra hai lần rồi!",
          },
          lines: [
            {
              en: "Alex, tell me you didn't type our student portal password into that clearance link... Someone just tried to log in from another device.",
              vi: "Alex, nói mình nghe cậu chưa gõ mật khẩu cổng sinh viên vào cái link xác nhận tốt nghiệp đó đi... Vừa có thiết bị lạ đăng nhập vào tài khoản kìa.",
            },
          ],
          replies: [
            {
              id: "minh_admit",
              tone: "support",
              label: { en: "I clicked it — what do we lock first?", vi: "Mình lỡ bấm rồi — giờ khóa gì trước?" },
              response: {
                en: "Back up Chapter 3 to an offline USB right now, change your password from the real UEH bookmark, and call the Training Office directly.",
                vi: "Chép ngay Chương 3 ra ổ ngoài, đổi mật khẩu bằng bookmark cổng UEH thật, rồi gọi thẳng Phòng Đào tạo báo khóa phiên cũ liền đi!",
              },
              nextMood: "urgent",
              insight: {
                en: "Containment step: Offline backup + official portal recovery reduces Mission 05 damage.",
                vi: "Cách xử lý: Sao lưu ngoại tuyến + xác minh kênh trường giúp giảm thiệt hại ở Nhiệm vụ 05.",
              },
            },
            {
              id: "minh_check_backup",
              tone: "inquire",
              label: { en: "Is our Chapter 3 draft safe?", vi: "Bản thảo Chương 3 của tụi mình còn an toàn không?" },
              response: {
                en: "I still have Tuesday afternoon's copy on my laptop, so we're not starting from zero — just don't trust any 'IT recovery' texts later.",
                vi: "Máy mình vẫn còn bản chiều thứ Ba nên chưa mất trắng đâu — nhớ từ giờ tới thứ Sáu tuyệt đối đừng tin mấy tin nhắn tự xưng 'hỗ trợ khôi phục' nhé.",
              },
              nextMood: "supportive",
            },
            {
              id: "minh_leave",
              tone: "leave",
              label: { en: "Heading back to Room 6.07 now.", vi: "Mình lên phòng 6.07 xử lý ngay." },
              response: {
                en: "Go! Text me the moment the Training Office confirms.",
                vi: "Lên liền đi! Phòng Đào tạo xác nhận xong thì nhắn mình ngay.",
              },
              nextMood: "urgent",
            },
          ],
          hookNote: {
            en: "Persistent risk active: compromised credentials echo into Mission 05.",
            vi: "Rủi ro dây chuyền: tài khoản bị lộ sẽ ảnh hưởng trực tiếp Nhiệm vụ 05.",
          },
        };
      }
      if (f.draftFinished || ctx.thesisProgress >= 100) {
        return {
          npcId,
          speaker: npc.name,
          role: npc.role,
          missionBadge: "M01 → M02",
          mood: "supportive",
          ambientBark: {
            en: "Alex! Grab an iced coffee — Chapter 3 is finally looking sharp!",
            vi: "Alex! Qua làm ly cà phê sữa đá đi — Chương 3 cuối cùng cũng ra dáng rồi!",
          },
          openingVoiceId: "m02.minh.setup",
          lines: [
            {
              en: "Chapter 3 finally looks solid! Don't forget our final District 5 interview at 11:30 tomorrow — Cô Ba hates waiting.",
              vi: "Chương 3 cuối cùng cũng ra dáng rồi đó! Nhớ buổi phỏng vấn cuối ở Quận 5 lúc 11:30 ngày mai nha — Cô Ba ghét bị trễ lắm.",
            },
          ],
          replies: [
            {
              id: "minh_m02_route",
              voiceId: "m02.minh.minh_m02_route",
              labelVoiceId: "m02.minh.minh_m02_route.alex",
              tone: "inquire",
              label: { en: "Best way down to District 5?", vi: "Mai đi Quận 5 bằng gì tiện nhất?" },
              response: {
                en: "Catch Bus 06 right up the street or book a verified app. Ignore that unmarked motorbike guy loitering by the bus stop — off-app cash rides aren't worth the risk.",
                vi: "Bắt xe Buýt 06 ngay đầu trạm kia hoặc đặt app đàng hoàng. Đừng nghe ông xe ôm tự do đứng ngoắc khách bên trạm — rẻ hơn vài chục ngàn mà chẳng có lịch sử hành trình đâu.",
              },
              nextMood: "supportive",
              insight: {
                en: "Mission 02 hint: Bus 06 & verified apps protect both safety and schedule.",
                vi: "Gợi ý Nhiệm vụ 02: Tuyến Buýt 06 và app chính thức đảm bảo an toàn lộ trình.",
              },
            },
            {
              id: "minh_m02_coba",
              voiceId: "m02.minh.minh_m02_coba",
              labelVoiceId: "m02.minh.minh_m02_coba.alex",
              tone: "inquire",
              label: { en: "What should I ask Cô Ba?", vi: "Gặp Cô Ba cần chốt số liệu gì?" },
              response: {
                en: "Just verify how small shopkeepers spot fake transfer receipts. One clean quote wraps up Section 3.3 completely.",
                vi: "Hỏi kỹ cách mấy tiệm nhỏ phân biệt bill chuyển khoản giả là đủ. Thêm một trích dẫn thật đó là chốt đẹp Mục 3.3 luôn.",
              },
              nextMood: "calm",
            },
            {
              id: "minh_leave",
              voiceId: "m02.minh.minh_leave",
              labelVoiceId: "m02.minh.minh_leave.alex",
              tone: "leave",
              label: { en: "See you tomorrow morning.", vi: "Hẹn sáng mai nha Minh." },
              response: {
                en: "Get some real sleep tonight, Alex. Don't pull a 3 AM sprint.",
                vi: "Tối nay ngủ cho đàng hoàng nha Alex. Đừng thức trắng tới 3 giờ sáng nữa.",
              },
              nextMood: "supportive",
            },
          ],
        };
      }
      return {
        npcId,
        speaker: npc.name,
        role: npc.role,
        missionBadge: "M01 · 72H COUNTDOWN",
        mood: ctx.fatigue >= 65 ? "supportive" : "calm",
        ambientBark: {
          en: "Hey Alex! Over here by the café table — got a minute to check Chapter 3?",
          vi: "Alex ơi! Bên bàn cà phê này nè — qua coi Chương 3 với mình xíu!",
        },
        lines: [
          {
            en: `Our draft is sitting at ${Math.round(ctx.thesisProgress)}%. Dr. Nguyễn left red margin comments on Chapter 3 — grab a quiet block in Room 6.07 tonight.`,
            vi: `Bản thảo tụi mình mới đạt ${Math.round(ctx.thesisProgress)}%. TS. Nguyễn vừa gạch đỏ mấy chỗ ở Chương 3 — tối nay cố chạy một phiên tập trung trong phòng 6.07 nha.`,
          },
        ],
        replies: [
          {
            id: "minh_focus_tip",
            tone: "inquire",
            label: { en: "How do I push past writer's block?", vi: "Làm sao viết nhanh mà không bị đuối?" },
            response: {
              en: "Work in 60–90 minute Flow blocks instead of 4-hour marathons. Once fatigue climbs past midnight your output craters and you miss red flags in your inbox.",
              vi: "Chia từng phiên 60–90 phút cho vào đúng nhịp Flow, đừng cày 4 tiếng liên tục. Sau nửa đêm đầu óc mệt là vừa viết chậm vừa dễ sập bẫy email lừa đảo lắm.",
            },
            nextMood: "supportive",
          },
          {
            id: "minh_scam_warn",
            tone: "challenge",
            label: { en: "Did you get a 'clearance' email too?", vi: "Cậu có nhận được mail 'xác nhận tốt nghiệp' không?" },
            response: {
              en: "Yeah, looked super urgent — almost clicked it until I checked the sender domain. Always open the real UEH portal from your bookmarks, never from an email link.",
              vi: "Có luôn, nhìn gấp gáp phát sợ — suýt nữa mình bấm rồi may mà soi lại tên miền người gửi. Lúc nào cũng tự mở bookmark cổng UEH thật, đừng bấm link trong mail.",
            },
            nextMood: "guarded",
            insight: {
              en: "Verification habit: Always check official portals independently via bookmarks.",
              vi: "Thói quen an toàn: Luôn kiểm tra qua bookmark chính thức thay vì link gửi sẵn.",
            },
          },
          {
            id: "minh_leave",
            tone: "leave",
            label: { en: "Back to Room 6.07 to write.", vi: "Mình về phòng 6.07 viết tiếp đây." },
            response: {
              en: "Ping me when you hit 85%! Coffee's on me after defense.",
              vi: "Lên 85% thì nhắn mình nha! Bảo vệ xong mình khao cà phê.",
            },
            nextMood: "calm",
          },
        ],
      };
    }

    case "linh": {
      if (f.easyMoneyDeposited) {
        return {
          npcId,
          speaker: npc.name,
          role: npc.role,
          missionBadge: "M01 · EASY MONEY",
          mood: "guarded",
          ambientBark: {
            en: "Alex... wait — did that Telegram group freeze your payout too?",
            vi: "Alex... khoan đã — nhóm Telegram kia cũng đóng băng tiền của cậu hả?",
          },
          lines: [
            {
              en: "They demanded another 'VIP unlock deposit' from me five minutes ago, and now the group admin won't even read my messages...",
              vi: "Năm phút trước bên đó đòi mình nạp thêm tiền 'mở khóa đơn VIP', giờ admin nhóm không thèm xem tin nhắn luôn rồi...",
            },
          ],
          replies: [
            {
              id: "linh_stop",
              tone: "challenge",
              label: { en: "Stop paying! That's a classic task scam.", vi: "Dừng nạp ngay! Đó là bẫy nhiệm vụ giả rồi." },
              response: {
                en: "I kept thinking one more transfer would unlock everything... God, I should've screenshot their account numbers and stopped after the first red flag.",
                vi: "Mình cứ nghĩ chuyển thêm một lần nữa là rút lại được hết... Trời ơi, lẽ ra mình nên chụp màn hình số tài khoản tụi nó rồi dừng từ đầu.",
              },
              nextMood: "guarded",
            },
            {
              id: "linh_leave",
              tone: "leave",
              label: { en: "Save every receipt and report it.", vi: "Giữ lại hết biên lai rồi trình báo đi." },
              response: {
                en: "Yeah... thanks Alex. I'm going to call my bank right now.",
                vi: "Ừ... cảm ơn Alex. Mình gọi lên ngân hàng ngay đây.",
              },
              nextMood: "guarded",
            },
          ],
        };
      }
      return {
        npcId,
        speaker: npc.name,
        role: npc.role,
        missionBadge: "M01 · EASY MONEY",
        mood: "persuasive",
        ambientBark: {
          en: "Hey Alex! Tight on rent this week? Check the side-gig link I texted you!",
          vi: "Ê Alex! Cuối tháng kẹt tiền trọ không? Coi kèo làm thêm mình mới nhắn đó!",
        },
        lines: [
          {
            en: "A bunch of students from my faculty are doing quick product-review clicks on Telegram — 50k in ten minutes, straight into your bank.",
            vi: "Mấy bạn khoa mình đang làm nhiệm vụ đánh giá đơn hàng trên Telegram — 10 phút nhận ngay 50k chuyển thẳng vào tài khoản luôn.",
          },
        ],
        replies: [
          {
            id: "linh_ask_how",
            tone: "inquire",
            label: { en: "Why would they pay 50k for ten minutes?", vi: "Sao bấm vài phút mà họ trả tới 50k?" },
            response: {
              en: "They say it's e-commerce store seeding! First two tasks are free, then for the bigger 300k batch you just front a small deposit and get 120% back.",
              vi: "Họ bảo tăng tương tác cho shop sàn thương mại điện tử! Hai đơn đầu miễn phí, tới đơn lớn 300k thì ứng trước một khoản nhỏ rồi họ hoàn 120% lại liền.",
            },
            nextMood: "persuasive",
            insight: {
              en: "Red flag caught: 'front a small deposit to unlock bigger tasks' is the exact hook of task scams.",
              vi: "Bắt được dấu hiệu lừa đảo: 'ứng tiền trước để mở đơn thưởng lớn' là kịch bản kinh điển.",
            },
          },
          {
            id: "linh_pushback",
            tone: "challenge",
            label: { en: "Any job asking you to deposit money is a trap.", vi: "Việc làm thêm mà bắt nạp tiền trước là bẫy đó." },
            response: {
              en: "Ugh, you sound just like Minh! Suit yourself — I already cashed out my first 50k, just don't say I didn't share.",
              vi: "Xì, nói y chang thằng Minh! Tùy cậu thôi — mình rút được 50k đầu tiên rồi, sau này đừng bảo mình giấu kèo.",
            },
            nextMood: "defensive",
          },
          {
            id: "linh_leave",
            tone: "leave",
            label: { en: "I'm swamped with my thesis right now.", vi: "Mình đang ngập đầu với khóa luận rồi." },
            response: {
              en: "Okay okay, good luck with Friday's deadline!",
              vi: "Thôi được rồi, chúc cậu kịp hạn thứ Sáu nha!",
            },
            nextMood: "calm",
          },
        ],
      };
    }

    case "hung": {
      if (f.investmentFundsLocked) {
        return {
          npcId,
          speaker: npc.name,
          role: npc.role,
          missionBadge: "M01 · GOLDEN PLATFORM",
          mood: "defensive",
          ambientBark: {
            en: "Alex, chill — the platform support says withdrawals unlock right after the tax fee!",
            vi: "Alex bình tĩnh — bên sàn bảo đóng xong phí thuế là mở rút tiền ngay mà!",
          },
          lines: [
            {
              en: "Everyone in the VIP mentor group is paying the 15% verification tax right now. Just don't let the timer expire or the system forfeits the balance.",
              vi: "Trong nhóm VIP ai cũng đang đóng phí xác minh thuế 15% hết rồi. Đừng để đồng hồ hết giờ kẻo hệ thống khóa luôn số dư.",
            },
          ],
          replies: [
            {
              id: "hung_expose",
              tone: "challenge",
              label: { en: "Legit exchanges deduct fees — they NEVER demand fresh transfers.", vi: "Sàn thật trừ phí trực tiếp — không bao giờ bắt nạp thêm tiền!" },
              response: {
                en: "Wait... why wouldn't they just take 15% out of my profits? Let me call my broker— wait, his number is disconnected...",
                vi: "Khoan... sao họ không trừ thẳng 15% vào tiền lời nhỉ? Để anh gọi lại cho chuyên viên— ủa sao thuê bao không liên lạc được rồi...",
              },
              nextMood: "guarded",
              insight: {
                en: "Second-layer trap exposed: 'tax / unlock fees' only extract more money from victims.",
                vi: "Lật tẩy bẫy tầng hai: 'phí thuế / phí mở khóa rút tiền' chỉ nhằm vét thêm tiền nạn nhân.",
              },
            },
            {
              id: "hung_leave",
              tone: "leave",
              label: { en: "I'm not sending another đồng.", vi: "Em không chuyển thêm một đồng nào nữa." },
              response: {
                en: "Man... I put ten million in there myself...",
                vi: "Trời ơi... chính anh cũng bỏ mười triệu vào đó rồi...",
              },
              nextMood: "guarded",
            },
          ],
        };
      }
      return {
        npcId,
        speaker: npc.name,
        role: npc.role,
        missionBadge: "M01 · GOLDEN PLATFORM",
        mood: "persuasive",
        ambientBark: {
          en: "Alex, right? Minh's cousin told me about you — got two minutes for a gold play?",
          vi: "Alex phải không? Anh Hùng bạn anh họ Minh nè — rảnh 2 phút nghe kèo vàng không?",
        },
        lines: [
          {
            en: "I've been flipping gold futures on a private mentor app right here over coffee — 12% every two days, zero losing trades so far.",
            vi: "Anh ngồi cà phê bấm lệnh vàng trên app nội bộ — cứ hai ngày lãi 12%, từ đầu tuần tới giờ chưa trượt một lệnh nào.",
          },
        ],
        replies: [
          {
            id: "hung_ask_license",
            tone: "challenge",
            label: { en: "Is this app licensed in Vietnam?", vi: "App này có giấy phép hoạt động ở Việt Nam không anh?" },
            response: {
              en: "Haha, if it were public on the App Store the big funds would ruin the spread! You install it via a private link — that's why the returns stay 12%.",
              vi: "Haha, lên App Store công khai thì quỹ lớn ăn hết biên độ rồi! Phải cài qua link nội bộ thì mới giữ được mức lãi 12% đều như vậy chứ.",
            },
            nextMood: "defensive",
            insight: {
              en: "Red flag caught: sideloaded APK/private-link finance apps + guaranteed 12% returns.",
              vi: "Dấu hiệu cảnh báo: app tài chính cài ngoài kho ứng dụng + cam kết lãi 12% không rủi ro.",
            },
          },
          {
            id: "hung_ask_minh",
            tone: "inquire",
            label: { en: "Does Minh actually use this?", vi: "Minh có chơi sàn này thật không?" },
            response: {
              en: "Well, Minh's cousin told me about it — haven't asked Minh directly, he's always too cautious with money.",
              vi: "À thì anh họ Minh giới thiệu — anh cũng chưa hỏi trực tiếp Minh, thằng đó vốn nhát gan mấy vụ đầu tư lắm.",
            },
            nextMood: "guarded",
          },
          {
            id: "hung_leave",
            tone: "leave",
            label: { en: "Pass. I need my cash for rent and graduation.", vi: "Thôi em chịu. Em phải giữ tiền đóng trọ và tốt nghiệp." },
            response: {
              en: "Your call, kid. Link's in your messages if you change your mind tonight.",
              vi: "Tùy em thôi. Link anh gửi trong tin nhắn rồi, tối đổi ý thì mở xem.",
            },
            nextMood: "calm",
          },
        ],
      };
    }

    case "unverified_driver":
      return {
        npcId,
        speaker: npc.name,
        role: npc.role,
        missionBadge: "M02 · THE RIDE",
        mood: "persuasive",
        openingVoiceId: "m02.driver.opening",
        ambientVoiceId: "m02.driver.ambient",
        ambientBark: {
          en: "District 5, student? Skip Bus 06 — hop on my bike, 60k cash right now!",
          vi: "Đi Quận 5 không em? Chờ Buýt 06 nắng lắm, 60 ngàn anh chở liền luôn!",
        },
        lines: [
          {
            en: "Don't waste forty minutes waiting on Bus 06 or paying 105k on the ride app. My Super Cub's right here — 60,000đ cash, straight down Nguyễn Trãi.",
            vi: "Đứng chờ xe Buýt 06 cả bốn chục phút chi cho mệt, đặt app thì tận 105 ngàn. Xe anh dựng ngay đây nè — 60 ngàn tiền mặt, chạy vèo tới Quận 5.",
          },
        ],
        replies: [
          {
            id: "driver_ask_app",
            voiceId: "m02.driver.driver_ask_app",
            labelVoiceId: "m02.driver.driver_ask_app.alex",
            tone: "challenge",
            label: { en: "Why don't you run through the ride app?", vi: "Sao anh không bật app để em đặt cho an toàn?" },
            response: {
              en: "Apps take 28% commission and track every alley shortcut! Why pay corporate fees when you can just pay me cash — or stop by an ATM on the way?",
              vi: "App nó cắt tới 28% chiết khấu rồi theo dõi từng con hẻm tắt! Đóng phí cho tụi nó làm gì, cứ đi ngoài rồi tới nơi trả tiền mặt — không đủ thì anh ghé cây ATM cho rút.",
            },
            nextMood: "defensive",
            insight: {
              en: "Mission 02 warning: Off-app cash drivers have no GPS log, verified ID, or fare cap.",
              vi: "Cảnh báo Nhiệm vụ 02: Xe ngoài không có định vị GPS, không xác minh danh tính và dễ phát sinh đòi tiền dọc đường.",
            },
          },
          {
            id: "driver_ask_plate",
            voiceId: "m02.driver.driver_ask_plate",
            labelVoiceId: "m02.driver.driver_ask_plate.alex",
            tone: "inquire",
            label: { en: "Which route do you take to District 5?", vi: "Anh chạy tuyến nào xuống Quận 5?" },
            response: {
              en: "Oh, I know quiet back-alleys past Nguyễn Tri Phương — way faster than the main boulevard! No cameras, no traffic lights!",
              vi: "Anh rành mấy hẻm tắt bên Nguyễn Tri Phương lắm — chạy nhanh hơn đường lớn nhiều! Không kẹt xe, không đèn đỏ luôn!",
            },
            nextMood: "persuasive",
            insight: {
              en: "Red flag: Offering 'unmonitored back-alleys' with no app tracking is a classic rider-safety risk.",
              vi: "Dấu hiệu cảnh giác: Chủ động rủ đi 'hẻm tắt không camera' khi không có định vị app là rủi ro an toàn rất lớn.",
            },
          },
          {
            id: "driver_wait_bus",
            voiceId: "m02.driver.driver_wait_bus",
            labelVoiceId: "m02.driver.driver_wait_bus.alex",
            tone: "leave",
            label: { en: "No thanks — I'll take Bus 06.", vi: "Thôi cảm ơn anh — em đi xe Buýt 06." },
            response: {
              en: "Suit yourself! Bus 06 crawls in this traffic — I'll be right here if you run late tomorrow.",
              vi: "Tùy em! Giờ này Buýt 06 bò chậm rì à — mai có trễ giờ phỏng vấn thì cứ ra đây gọi anh.",
            },
            nextMood: "calm",
          },
        ],
      };

    case "landlord_q10":
      return {
        npcId,
        speaker: npc.name,
        role: npc.role,
        missionBadge: "M03 · THE RENTAL",
        mood: "urgent",
        ambientBark: {
          en: "Alex! Down in the courtyard? Stop by the notice board — quick word about Room 6.07!",
          vi: "Alex xuống sân rồi hả? Ghé bảng thông báo anh dặn chuyện phòng 6.07 xíu!",
        },
        lines: [
          {
            en: "I just pinned the new room schedule on the board. Your lease for 6.07 ends right after defense week, and two incoming freshmen are viewing it Thursday morning.",
            vi: "Anh vừa ghim thông báo trả phòng lên bảng kia kìa. Hợp đồng phòng 6.07 hết ngay sau tuần bảo vệ, sáng thứ Năm có hai bạn tân sinh viên tới coi phòng rồi.",
          },
        ],
        replies: [
          {
            id: "landlord_deposit_tip",
            tone: "inquire",
            label: { en: "Any advice if I hunt for a cheaper room online?", vi: "Tìm phòng rẻ hơn trên mạng cần tránh gì anh?" },
            response: {
              en: "Listen carefully: scammers repost stolen photos of shiny rooms in District 10 for 2.5 million and beg for a '500k holding deposit' before viewing. NEVER transfer a đồng before stepping inside and checking the owner's ID!",
              vi: "Nghe kỹ nè: tụi lừa đảo hay lấy hình phòng đẹp Q.10 đăng giá 2,5 triệu rồi giục 'chuyển cọc giữ phòng 500k' mới cho xem. Tuyệt đối KHÔNG chuyển một đồng nào trước khi tận mắt vào phòng và coi CCCD chủ nhà!",
            },
            nextMood: "supportive",
            insight: {
              en: "Mission 03 protection: Never wire a 'holding deposit' before an in-person room tour.",
              vi: "Kinh nghiệm Nhiệm vụ 03: Không bao giờ chuyển cọc giữ chỗ trước khi xem phòng trực tiếp.",
            },
          },
          {
            id: "landlord_extend",
            tone: "inquire",
            label: { en: "Can I extend Room 6.07 until Sunday?", vi: "Anh cho em gia hạn phòng 6.07 tới Chủ nhật được không?" },
            response: {
              en: "If you confirm by Thursday noon I can hold it for you. Don't get rushed into a fake listing just because you're stressed about the thesis.",
              vi: "Trưa thứ Năm em báo lại chắc chắn thì anh giữ cho. Đừng vì gấp khóa luận mà vội chuyển cọc cho mấy bài đăng ảo trên mạng nha.",
            },
            nextMood: "calm",
          },
          {
            id: "landlord_leave",
            tone: "leave",
            label: { en: "Thanks Mr. Tuấn — I'll check back Thursday!", vi: "Dạ cảm ơn chú Tuấn — thứ Năm em báo lại ạ!" },
            response: {
              en: "Good kid. Lock your corridor door at night and get some real sleep before Friday.",
              vi: "Ừ giỏi. Tối nhớ khóa cửa hành lang cẩn thận rồi ngủ sớm giữ sức tới thứ Sáu nghe con.",
            },
            nextMood: "supportive",
          },
        ],
      };

    case "recruiter_q1":
      return {
        npcId,
        speaker: npc.name,
        role: npc.role,
        missionBadge: "M03 · THE JOB OFFER",
        mood: "calm",
        ambientBark: {
          en: "Excuse me — graduating UEH senior? Our Bitexco team is hiring right after defense week!",
          vi: "Chào em — sinh viên năm cuối UEH hả? Team chị ngay tòa Bitexco đang tuyển đợt sau bảo vệ đó!",
        },
        lines: [
          {
            en: "I'm Vy from the District 1 analytics team inside Bitexco. We run real face-to-face interviews in the lobby — zero application fees, zero Telegram onboarding.",
            vi: "Chị là Vy bên team phân tích dữ liệu tại Bitexco Quận 1. Bên chị phỏng vấn trực tiếp tại sảnh tòa nhà — không bao giờ thu phí hồ sơ hay tuyển qua Telegram.",
          },
        ],
        replies: [
          {
            id: "recruiter_scams",
            tone: "inquire",
            label: { en: "What fake job offers target graduating students?", vi: "Các chiêu lừa tuyển dụng nhắm vào sinh viên mới ra trường là gì chị?" },
            response: {
              en: "They promise high-pay remote internships on short notice, then demand a 'equipment deposit' or ask you to link your personal bank card to 'verify payroll'. Block them immediately.",
              vi: "Họ hứa thực tập online lương cao nhận việc gấp, rồi bắt đóng 'phí đồng phục/thiết bị' hoặc yêu cầu cung cấp OTP ngân hàng để 'kích hoạt bảng lương'. Gặp kiểu đó em chặn ngay nhé.",
            },
            nextMood: "supportive",
            insight: {
              en: "Mission 03 protection: Real employers never charge onboarding deposits or ask for banking OTPs.",
              vi: "Kinh nghiệm Nhiệm vụ 03: Doanh nghiệp uy tín không bao giờ thu phí nhận việc hay xin mã OTP.",
            },
          },
          {
            id: "recruiter_verify",
            tone: "challenge",
            label: { en: "How can I verify your Bitexco team is legit?", vi: "Làm sao em kiểm chứng đúng team tuyển dụng ở Bitexco?" },
            response: {
              en: "Smart question! Check our corporate domain email, confirm the lobby reception desk at Bitexco Tower, and never trust personal Gmail or Telegram handles.",
              vi: "Hỏi rất chuẩn! Em đối chiếu email tên miền công ty, xác nhận tại lễ tân sảnh Bitexco và tuyệt đối đừng tin Gmail cá nhân hay nick Telegram.",
            },
            nextMood: "supportive",
          },
          {
            id: "recruiter_leave",
            tone: "leave",
            label: { en: "I'll send my CV after Friday's submission!", vi: "Nộp khóa luận thứ Sáu xong em gửi CV liền!" },
            response: {
              en: "Focus on your defense first — our verified HR email is listed on the official company site.",
              vi: "Tập trung bảo vệ cho tốt trước đi — email tuyển dụng chính thức có trên website công ty nhé.",
            },
            nextMood: "calm",
          },
        ],
      };

    case "interviewee_q5":
      // Cô Ba is a real, physical interviewee in Chợ Lớn. Her dialogue is the interview scene itself:
      // no branch here marks the interview complete. The deterministic device actions do that, and only
      // when Alex actually asks one of the interview questions and the core state says so.
      if (f.interviewCompleted) {
        return {
          npcId,
          speaker: npc.name,
          role: npc.role,
          missionBadge: "M02 · INTERVIEW DONE",
          openingVoiceId: "m02.coba.after.opening",
          mood: "supportive",
          ambientBark: {
            en: "Thank you, Alex. Send me the chapter when it is finished.",
            vi: "Cảm ơn cháu, Alex. Xong chương rồi gửi cô xem nhé.",
          },
          lines: [
            {
              en: "That is everything I use at the stall. Put it in the chapter before you hand it in.",
              vi: "Đó là tất cả những gì cô làm ở sạp. Cháu ghi vào bài trước khi nộp nhé.",
            },
          ],
          replies: [
            {
              id: "coba_after_thanks",
              voiceId: "m02.coba.after.thanks",
              labelVoiceId: "m02.coba.after.thanks.alex",
              tone: "support",
              label: { en: "Thank you for the time, Cô Ba.", vi: "Cảm ơn cô đã dành thời gian ạ." },
              response: {
                en: "Go on, you still have a chapter to finish. Call me if you need me to check a line.",
                vi: "Đi đi, cháu còn cả chương phải làm. Cần cô xem lại câu nào thì gọi.",
              },
              nextMood: "supportive",
            },
            {
              id: "coba_after_recap",
              voiceId: "m02.coba.after.recap",
              labelVoiceId: "m02.coba.after.recap.alex",
              tone: "inquire",
              label: { en: "Anything else I should not miss?", vi: "Cô còn điều gì cháu không nên bỏ sót ạ?" },
              response: {
                en: "The balance, not the screenshot. And never release goods on a promise.",
                vi: "Là số dư, không phải ảnh chụp. Và đừng bao giờ giao hàng chỉ vì một lời hứa.",
              },
              nextMood: "supportive",
            },
            {
              id: "coba_after_leave",
              voiceId: "m02.coba.after.leave",
              labelVoiceId: "m02.coba.after.leave.alex",
              tone: "leave",
              label: { en: "I should get going.", vi: "Cháu phải đi đây ạ." },
              response: {
                en: "Careful on the road. The market gets crowded at this hour.",
                vi: "Đi đường cẩn thận. Giờ này chợ đông lắm.",
              },
              nextMood: "calm",
            },
          ],
        };
      }
      if (f.interviewStarted) {
        return {
          npcId,
          speaker: npc.name,
          role: npc.role,
          missionBadge: "M02 · INTERVIEW",
          openingVoiceId: "m02.coba.interview.opening",
          mood: "supportive",
          ambientBark: {
            en: "Take your notes out when you are ready. I have the shop records here.",
            vi: "Cháu lấy sổ ra khi sẵn sàng nhé. Cô có sổ tiệm ở đây rồi.",
          },
          lines: [
            {
              en: "Sit here where the light is better. Ask what you need for the chapter.",
              vi: "Cháu ngồi đây cho đủ sáng. Cần gì cho bài thì hỏi cô.",
            },
          ],
          replies: [
            {
              id: "coba_transfer_check",
              voiceId: "m02.coba.interview.transfer_check",
              labelVoiceId: "m02.coba.interview.transfer_check.alex",
              tone: "inquire",
              label: { en: "How do you check a transfer receipt?", vi: "Cô kiểm tra bill chuyển khoản thế nào?" },
              response: {
                en: "We check the amount in our own bank app, match the sender name, and wait for the balance to update. A screenshot is not payment.",
                vi: "Cô kiểm tra số tiền trên app ngân hàng của mình, đối chiếu tên người gửi rồi chờ số dư cập nhật. Ảnh chụp màn hình không phải là tiền về.",
              },
              nextMood: "supportive",
            },
            {
              id: "coba_process",
              voiceId: "m02.coba.interview.process",
              labelVoiceId: "m02.coba.interview.process.alex",
              tone: "inquire",
              label: { en: "What is your full checking process?", vi: "Quy trình kiểm tra đầy đủ của cô là gì?" },
              response: {
                en: "First we pause the handover. Then we check our account, confirm the amount, and only release the goods after the credit appears.",
                vi: "Đầu tiên cô tạm dừng giao hàng. Sau đó kiểm tra tài khoản, xác nhận số tiền, rồi chỉ giao khi tiền đã hiện trong tài khoản.",
              },
              nextMood: "supportive",
            },
            {
              id: "coba_exception",
              voiceId: "m02.coba.interview.exception",
              labelVoiceId: "m02.coba.interview.exception.alex",
              tone: "challenge",
              label: { en: "What if the receipt looks wrong?", vi: "Nếu bill có gì không đúng thì sao cô?" },
              response: {
                en: "We do not argue over it. We stop the sale, ask the customer to check with their bank, and call our own bank if the transfer is still unclear.",
                vi: "Cô không tranh cãi chuyện đó. Cô dừng giao dịch, bảo khách kiểm tra với ngân hàng của họ, rồi gọi ngân hàng của cô nếu giao dịch vẫn chưa rõ.",
              },
              nextMood: "supportive",
            },
            {
              id: "coba_invite_reschedule",
              voiceId: "m02.coba.interview.invite_reschedule",
              labelVoiceId: "m02.coba.interview.invite_reschedule.alex",
              tone: "leave",
              label: { en: "I am late — can we reschedule?", vi: "Cháu tới trễ rồi — mình dời lại được không cô?" },
              response: {
                en: "We can still finish now that you are here. If you need another day, call before you come.",
                vi: "Cháu tới rồi thì mình làm luôn được. Nếu cần hôm khác thì gọi trước khi tới.",
              },
              nextMood: "calm",
            },
          ],
        };
      }
      if (f.interviewRescheduled) {
        return {
          npcId,
          speaker: npc.name,
          role: npc.role,
          missionBadge: "M02 · RESCHEDULED INTERVIEW",
          openingVoiceId: "m02.coba.rescheduled.opening",
          mood: "supportive",
          ambientBark: {
            en: "You made it back. We can do the interview now, before the market closes.",
            vi: "Cháu quay lại rồi. Mình phỏng vấn luôn nhé, trước khi chợ đóng cửa.",
          },
          lines: [
            {
              en: "You came back. Sit down — we can still do the interview today.",
              vi: "Cháu quay lại rồi. Ngồi xuống đi — hôm nay mình vẫn phỏng vấn được.",
            },
          ],
          replies: [
            {
              id: "coba_start_rescheduled",
              voiceId: "m02.coba.rescheduled.start",
              labelVoiceId: "m02.coba.rescheduled.start.alex",
              tone: "support",
              label: { en: "Thank you for fitting me in.", vi: "Cảm ơn cô đã sắp xếp lại cho cháu." },
              response: {
                en: "Of course. Let us keep it focused: how do you check a transfer before handing over goods?",
                vi: "Không có gì. Mình tập trung nhé: cô kiểm tra giao dịch thế nào trước khi giao hàng?",
              },
              nextMood: "supportive",
            },
            {
              id: "coba_confirm_rescheduled",
              voiceId: "m02.coba.rescheduled.confirm",
              labelVoiceId: "m02.coba.rescheduled.confirm.alex",
              tone: "inquire",
              label: { en: "Can we use the main entrance again?", vi: "Mình vẫn gặp ở cửa chính phải không cô?" },
              response: {
                en: "Yes, the main entrance. Do not come through the alley; the market staff will redirect you.",
                vi: "Đúng rồi, cửa chính. Đừng đi vào hẻm; nhân viên chợ sẽ hướng dẫn cháu ra.",
              },
              nextMood: "supportive",
            },
            {
              id: "coba_leave_rescheduled",
              voiceId: "m02.coba.rescheduled.leave",
              labelVoiceId: "m02.coba.rescheduled.leave.alex",
              tone: "leave",
              label: { en: "I should come back another day.", vi: "Chắc cháu nên quay lại hôm khác." },
              response: {
                en: "All right. Call before you come next time so I can keep a slot open.",
                vi: "Được thôi. Lần sau cháu gọi trước để cô giữ giờ nhé.",
              },
              nextMood: "calm",
            },
          ],
        };
      }
      if (f.interviewMissed) {
        return {
          npcId,
          speaker: npc.name,
          role: npc.role,
          missionBadge: "M02 · MISSED APPOINTMENT",
          openingVoiceId: "m02.coba.late.opening",
          mood: "calm",
          ambientBark: {
            en: "Alex? The 11:30 slot has passed. Are you still coming today?",
            vi: "Alex hả cháu? Giờ hẹn 11:30 qua rồi. Hôm nay cháu còn tới không?",
          },
          lines: [
            {
              en: "I waited until half past twelve, then I had to open the stall. We can still talk if you came all this way.",
              vi: "Cô đợi tới 12 giờ rưỡi rồi phải mở sạp. Cháu đi cả quãng đường tới đây thì mình vẫn nói chuyện được.",
            },
          ],
          replies: [
            {
              id: "coba_late_reschedule",
              voiceId: "m02.coba.late.reschedule",
              labelVoiceId: "m02.coba.late.reschedule.alex",
              tone: "inquire",
              label: { en: "Could we do it now, at the entrance?", vi: "Mình làm luôn bây giờ ở cửa chính được không cô?" },
              response: {
                en: "Yes — sit with me for a few minutes. It is better than another trip across the city.",
                vi: "Được — cháu ngồi với cô vài phút. Còn hơn phải đi thêm một chuyến qua cả thành phố.",
              },
              nextMood: "supportive",
            },
            {
              id: "coba_late_thanks",
              voiceId: "m02.coba.late.thanks",
              labelVoiceId: "m02.coba.late.thanks.alex",
              tone: "support",
              label: { en: "I am sorry I kept you waiting.", vi: "Cháu xin lỗi vì để cô phải đợi." },
              response: {
                en: "Traffic is traffic. What matters is that you tell me what you need for the chapter.",
                vi: "Kẹt xe thì kẹt xe thôi. Quan trọng là cháu nói cô cần gì cho bài.",
              },
              nextMood: "supportive",
            },
            {
              id: "coba_late_leave",
              voiceId: "m02.coba.late.leave",
              labelVoiceId: "m02.coba.late.leave.alex",
              tone: "leave",
              label: { en: "I should not keep you from the stall.", vi: "Cháu không giữ cô khỏi việc bán hàng nữa." },
              response: {
                en: "Then call me before you come next time. I will keep a slot for you.",
                vi: "Vậy lần sau cháu gọi trước khi tới. Cô sẽ giữ giờ cho cháu.",
              },
              nextMood: "calm",
            },
          ],
        };
      }
      // Not arrived yet (or the player walked up early): she is at the entrance, but the interview
      // cannot start until Alex reaches the market office in the story.
      return {
        npcId,
        speaker: npc.name,
        role: npc.role,
        missionBadge: "M02 · MARKET OFFICE",
        openingVoiceId: "m02.coba.waiting.opening",
        mood: "calm",
        ambientBark: {
          en: "Alex, is that you? The market office entrance is on this side.",
          vi: "Alex phải không cháu? Cửa chính văn phòng chợ ở phía này nè.",
        },
        lines: [
          {
            en: "Are you here for the 11:30 interview? Come to the main entrance, not the alley.",
            vi: "Cháu tới phỏng vấn lúc 11:30 phải không? Vào cửa chính nhé, đừng đi hẻm.",
          },
        ],
        replies: [
          {
            id: "coba_waiting_where",
            voiceId: "m02.coba.waiting.where",
            labelVoiceId: "m02.coba.waiting.where.alex",
            tone: "inquire",
            label: { en: "Where exactly is the main entrance?", vi: "Cửa chính nằm chính xác ở đâu ạ?" },
            response: {
              en: "Past the money changers, the wide door with the green sign. Not the narrow alley on the left.",
              vi: "Qua mấy quầy đổi tiền, cái cửa rộng có bảng màu xanh. Không phải con hẻm nhỏ bên trái đâu.",
            },
            nextMood: "calm",
          },
          {
            id: "coba_waiting_slot",
            voiceId: "m02.coba.waiting.slot",
            labelVoiceId: "m02.coba.waiting.slot.alex",
            tone: "support",
            label: { en: "I will be there at 11:30.", vi: "11:30 cháu sẽ có mặt ạ." },
            response: {
              en: "Good. I will be at the entrance with the shop ledger.",
              vi: "Vậy thì tốt. Cô sẽ đứng ở cửa chính với sổ tiệm.",
            },
            nextMood: "supportive",
          },
          {
            id: "coba_waiting_ledger",
            voiceId: "m02.coba.waiting.ledger",
            labelVoiceId: "m02.coba.waiting.ledger.alex",
            tone: "inquire",
            label: { en: "Should I bring anything to the interview?", vi: "Cháu có cần mang gì tới buổi phỏng vấn không cô?" },
            response: {
              en: "A pen and your questions. I have the shop records from the last three months.",
              vi: "Cây viết và mấy câu hỏi của cháu. Cô có sổ sách ba tháng gần đây rồi.",
            },
            nextMood: "supportive",
          },
        ],
      };

    default:
      return {
        npcId,
        speaker: npc.name,
        role: npc.role,
        missionBadge: `M0${npc.missions[0]}`,
        mood: "calm",
        ambientBark: {
          en: `${npc.name.en} is nearby.`,
          vi: `${npc.name.vi} đang ở gần đây.`,
        },
        lines: [
          {
            en: `${npc.name.en} is available during Mission 0${npc.missions[0]}.`,
            vi: `${npc.name.vi} sẽ xuất hiện trong Nhiệm vụ 0${npc.missions[0]}.`,
          },
        ],
        replies: [],
      };
  }
}
