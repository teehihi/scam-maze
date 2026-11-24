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
  speaker: LocalizedPair;
  role: LocalizedPair;
  missionBadge: string;
  mood: StoryNpcMood;
  /** Natural ambient street callout when Alex passes within ~7.5m (before pressing [E]). */
  ambientBark: LocalizedPair;
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
      modelFile: "npc-alan.optimized.glb",
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
      modelFile: "npc-alice.optimized.glb",
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
      modelFile: "manvn.optimized.glb",
      propKind: "helmet",
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
    schedule: [
      {
        startMinute: 960,
        endMinute: 1260,
        location: { en: "District 5 — Wed 11:30", vi: "Quận 5 — 11:30 Thứ Tư" },
        activity: "idle",
        inOpenWorld: false,
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
          lines: [
            {
              en: "Chapter 3 finally looks solid! Don't forget our final District 5 interview at 11:30 tomorrow — Cô Ba hates waiting.",
              vi: "Chương 3 cuối cùng cũng ra dáng rồi đó! Nhớ buổi phỏng vấn cuối ở Quận 5 lúc 11:30 ngày mai nha — Cô Ba ghét bị trễ lắm.",
            },
          ],
          replies: [
            {
              id: "minh_m02_route",
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
            tone: "leave",
            label: { en: "No thanks — I'll take Bus 06.", vi: "Thôi cảm ơn anh — em đi xe Buýt 06." },
            response: {
              en: "Suit yourself! Bus 06 crawls in this traffic — I'll be right here if you run late tomorrow.",
              vi: "Tùy em! Giờ này Buýt 06 bò chậm rì à — mai có trễ giờ phỏng vấn thì cứ ra đây gọi anh.",
            },
            nextMood: "calm",
          },
        ],
        hookNote: {
          en: "Mission 02 preview: Compare 60k off-app cash ride vs Bus 06 & verified apps.",
          vi: "Gợi mở Nhiệm vụ 02: Cân nhắc giữa xe ngoài 60k, Tuyến Buýt 06 và app có định vị.",
        },
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
