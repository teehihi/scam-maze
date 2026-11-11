export type HCMThemeId = "daylight" | "cyberpunk" | "sunset" | "blueprint";

export interface LandmarkInfo {
  id: string;
  name: string;
  title: string;
  description: string;
  category: "tower" | "culture" | "waterfront" | "bridge" | "district";
  position: [number, number, number]; // [x, y, z] in centered coordinates
  cameraPos: [number, number, number];
  cameraTarget: [number, number, number];
}

export interface ViewPreset {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  position: [number, number, number];
  target: [number, number, number];
}

export const HCM_LANDMARKS: LandmarkInfo[] = [
  {
    id: "bitexco",
    name: "Tháp Bitexco Financial",
    title: "Biểu tượng búp sen Sài Gòn",
    description: "Tòa tháp 68 tầng cao 262m với sân đỗ trực thăng vươn ra ngoài tầng 52, từng là biểu tượng kiến trúc hiện đại hàng đầu Việt Nam.",
    category: "tower",
    position: [5.77, 4.8, 8.67],
    cameraPos: [9.8, 6.2, 13.8],
    cameraTarget: [5.77, 3.2, 8.67],
  },
  {
    id: "benthanh",
    name: "Khu vực Chợ Bến Thành & Ga Metro",
    title: "Trái tim lịch sử & Đô thị hiện đại",
    description: "Quần thể trung tâm Quận 1 nối liền chợ Bến Thành lịch sử, Quảng trường Quách Thị Trang và nhà ga ngầm Metro Bến Thành - Suối Tiên.",
    category: "culture",
    position: [-3.2, 1.6, 2.8],
    cameraPos: [-8.5, 4.8, 7.5],
    cameraTarget: [-2.0, 1.0, 2.5],
  },
  {
    id: "bachdang",
    name: "Bến Bạch Đằng & Sông Sài Gòn",
    title: "Công viên ven sông & Bến tàu thủy buýt",
    description: "Công viên bờ sông Sài Gòn đón gió mát, ngắm trọn dải skyline lung linh của Quận 1 và khu đô thị mới Thủ Thiêm đối diện.",
    category: "waterfront",
    position: [8.5, 1.0, 5.8],
    cameraPos: [15.2, 3.8, 12.0],
    cameraTarget: [6.5, 0.8, 5.5],
  },
  {
    id: "bason",
    name: "Khu Ba Son & Cầu Ba Son",
    title: "Cửa ngõ kết nối Quận 1 và Thủ Thiêm",
    description: "Cây cầu dây văng kiến trúc uốn lượn vượt sông Sài Gòn, biểu tượng cho bước phát triển thần tốc của thành phố sang bờ Đông.",
    category: "bridge",
    position: [3.5, 2.2, -14.2],
    cameraPos: [10.5, 5.5, -9.0],
    cameraTarget: [3.5, 1.8, -13.5],
  },
  {
    id: "thuthiem",
    name: "Bán đảo Thủ Thiêm (An Khánh)",
    title: "Trung tâm tài chính mới tương lai",
    description: "Vùng đất trù phú bên kia sông Sài Gòn, nơi quy hoạch quảng trường trung tâm lớn nhất nước và các công trình thế kỷ.",
    category: "district",
    position: [12.5, 1.5, -2.5],
    cameraPos: [22.0, 7.5, 2.0],
    cameraTarget: [8.0, 1.8, 2.0],
  },
];

export const HCM_VIEW_PRESETS: ViewPreset[] = [
  {
    id: "overview",
    label: "Toàn Cảnh Sài Gòn",
    shortLabel: "Toàn Cảnh",
    description: "Góc nhìn flycam toàn cảnh 3km x 3km trung tâm TP. Hồ Chí Minh uốn lượn quanh sông Sài Gòn",
    position: [0, 32, 36],
    target: [2.5, 0.5, 0],
  },
  {
    id: "bitexco",
    label: "Tháp Bitexco",
    shortLabel: "Bitexco",
    description: "Góc máy cận cảnh ngắm búp sen Bitexco Financial Tower và quảng trường ven sông",
    position: [9.8, 6.2, 13.8],
    target: [5.77, 3.2, 8.67],
  },
  {
    id: "river",
    label: "Dọc Sông Sài Gòn",
    shortLabel: "Sông Sài Gòn",
    description: "Lướt dọc theo dòng sông Sài Gòn ngắm hai bờ Quận 1 và Thủ Thiêm",
    position: [15.2, 3.8, 12.0],
    target: [6.5, 0.8, 5.5],
  },
  {
    id: "benthanh",
    label: "Trung Tâm Bến Thành",
    shortLabel: "Bến Thành",
    description: "Góc nhìn khu lõi thương mại và các đại lộ Lê Lợi, Hàm Nghi, Trần Hưng Đạo",
    position: [-8.5, 4.8, 7.5],
    target: [-2.0, 1.0, 2.5],
  },
  {
    id: "thuthiem",
    label: "View từ Thủ Thiêm",
    shortLabel: "Thủ Thiêm",
    description: "Từ bờ Đông nhìn sang toàn bộ skyline tráng lệ của Quận 1",
    position: [22.0, 7.5, 2.0],
    target: [8.0, 1.8, 2.0],
  },
  {
    id: "street-walk",
    label: "Đi Bộ Dạo Phố",
    shortLabel: "Đi Bộ",
    description: "Góc nhìn thứ nhất (First-Person) đi bộ dạo phố Sài Gòn với nhân vật dùng chung",
    position: [0, 1.85, 10],
    target: [0, 1.85, 0],
  },
];
