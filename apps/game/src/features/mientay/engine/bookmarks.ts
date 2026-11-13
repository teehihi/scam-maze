export type TraversalMode = "walk" | "boat" | "fly";

export interface WorldBookmark {
  id: string;
  /** Proper-noun name shown on the quick-travel button (the same in every language). */
  name: string;
  mode: TraversalMode;
  /** Eye position. For walking bookmarks the height is recomputed from the ground. */
  pos: [number, number, number];
  yaw: number;
  pitch: number;
}

export const WORLD_BOOKMARKS = [
  { id: "ben-do", name: "Bến Đò & Chợ Nổi", mode: "walk", pos: [17.0, 2.8, 27.4], yaw: 0.72, pitch: -0.06 },
  { id: "cho-noi", name: "Giữa Chợ Nổi", mode: "boat", pos: [-6.5, 1.5, 4.0], yaw: 0.25, pitch: -0.04 },
  { id: "xom-nha-san", name: "Xóm Nhà Sàn", mode: "walk", pos: [26.4, 3.55, 11.5], yaw: 0.22, pitch: -0.08 },
  { id: "nha-co", name: "Nhà Cổ Bình Thủy", mode: "walk", pos: [35.5, 3.35, 48.0], yaw: -1.57, pitch: 0.03 },
  { id: "chua-khmer", name: "Chùa Khmer Cổ", mode: "walk", pos: [-42.5, 3.5, 8.2], yaw: 1.57, pitch: 0.08 },
  { id: "cau-khi-vuon", name: "Cầu Khỉ & Ao Sen", mode: "walk", pos: [48.0, 3.45, -14.2], yaw: 0.02, pitch: -0.08 },
] as const satisfies readonly WorldBookmark[];

export const DEFAULT_BOOKMARK = WORLD_BOOKMARKS[0];
