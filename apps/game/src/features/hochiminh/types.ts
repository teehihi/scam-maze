export type HCMThemeId = "daylight" | "cyberpunk" | "sunset" | "blueprint";

export type HCMLandmarkId = "bitexco" | "benthanh" | "bachdang" | "bason" | "thuthiem";

export type HCMViewPresetId = "overview" | "bitexco" | "river" | "benthanh" | "thuthiem" | "street-walk";

// Display text (landmark title and description, view preset labels) lives in the `worlds`
// dictionaries under `hcm.landmarks.<id>` and `hcm.views.<id>`. Landmark names stay literal here.
export interface LandmarkInfo {
  id: HCMLandmarkId;
  name: string;
  category: "tower" | "culture" | "waterfront" | "bridge" | "district";
  position: [number, number, number]; // [x, y, z] in centered coordinates
  cameraPos: [number, number, number];
  cameraTarget: [number, number, number];
}

export interface ViewPreset {
  id: HCMViewPresetId;
  position: [number, number, number];
  target: [number, number, number];
}

export const HCM_LANDMARKS: LandmarkInfo[] = [
  {
    id: "bitexco",
    name: "Tháp Bitexco Financial",
    category: "tower",
    position: [5.77, 4.8, 8.67],
    cameraPos: [9.8, 6.2, 13.8],
    cameraTarget: [5.77, 3.2, 8.67],
  },
  {
    id: "benthanh",
    name: "Khu vực Chợ Bến Thành & Ga Metro",
    category: "culture",
    position: [-3.2, 1.6, 2.8],
    cameraPos: [-8.5, 4.8, 7.5],
    cameraTarget: [-2.0, 1.0, 2.5],
  },
  {
    id: "bachdang",
    name: "Bến Bạch Đằng & Sông Sài Gòn",
    category: "waterfront",
    position: [8.5, 1.0, 5.8],
    cameraPos: [15.2, 3.8, 12.0],
    cameraTarget: [6.5, 0.8, 5.5],
  },
  {
    id: "bason",
    name: "Khu Ba Son & Cầu Ba Son",
    category: "bridge",
    position: [3.5, 2.2, -14.2],
    cameraPos: [10.5, 5.5, -9.0],
    cameraTarget: [3.5, 1.8, -13.5],
  },
  {
    id: "thuthiem",
    name: "Bán đảo Thủ Thiêm (An Khánh)",
    category: "district",
    position: [12.5, 1.5, -2.5],
    cameraPos: [22.0, 7.5, 2.0],
    cameraTarget: [8.0, 1.8, 2.0],
  },
];

export const HCM_VIEW_PRESETS: ViewPreset[] = [
  {
    id: "overview",
    position: [0, 32, 36],
    target: [2.5, 0.5, 0],
  },
  {
    id: "bitexco",
    position: [9.8, 6.2, 13.8],
    target: [5.77, 3.2, 8.67],
  },
  {
    id: "river",
    position: [15.2, 3.8, 12.0],
    target: [6.5, 0.8, 5.5],
  },
  {
    id: "benthanh",
    position: [-8.5, 4.8, 7.5],
    target: [-2.0, 1.0, 2.5],
  },
  {
    id: "thuthiem",
    position: [22.0, 7.5, 2.0],
    target: [8.0, 1.8, 2.0],
  },
  {
    id: "street-walk",
    position: [0, 1.85, 10],
    target: [0, 1.85, 0],
  },
];
