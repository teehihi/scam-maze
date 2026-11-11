import type en from "../../en/worlds/hcm";
import type { LocaleShape } from "../../../types";

// The Vietnamese text below is the original text from `features/hochiminh`, moved here unchanged.
const hcm: LocaleShape<typeof en> = {
  hcm: {
    back: {
      label: "Menu Game",
      title: "Quay lại Menu Game",
    },
    header: {
      title: "TP. Hồ Chí Minh 2025 · 3D Map",
    },
    themes: {
      daylight: "Ban Ngày",
      cyberpunk: "Cyberpunk",
      sunset: "Hoàng Hôn",
      blueprint: "Bản Đồ Tech",
    },
    controls: {
      autoRotateStop: "Dừng tự động xoay",
      autoRotateStart: "Bật tự động xoay",
      landmarksHide: "Ẩn địa danh",
      landmarksShow: "Hiện địa danh 3D",
      info: "Thông tin mô hình 3D",
      fullscreenExit: "Thu nhỏ",
      fullscreenEnter: "Toàn màn hình",
    },
    landmarkCard: {
      heading: "Địa Danh Nổi Bật",
    },
    landmarks: {
      bitexco: {
        title: "Biểu tượng búp sen Sài Gòn",
        description:
          "Tòa tháp 68 tầng cao 262m với sân đỗ trực thăng vươn ra ngoài tầng 52, từng là biểu tượng kiến trúc hiện đại hàng đầu Việt Nam.",
      },
      benthanh: {
        title: "Trái tim lịch sử & Đô thị hiện đại",
        description:
          "Quần thể trung tâm Quận 1 nối liền chợ Bến Thành lịch sử, Quảng trường Quách Thị Trang và nhà ga ngầm Metro Bến Thành - Suối Tiên.",
      },
      bachdang: {
        title: "Công viên ven sông & Bến tàu thủy buýt",
        description:
          "Công viên bờ sông Sài Gòn đón gió mát, ngắm trọn dải skyline lung linh của Quận 1 và khu đô thị mới Thủ Thiêm đối diện.",
      },
      bason: {
        title: "Cửa ngõ kết nối Quận 1 và Thủ Thiêm",
        description:
          "Cây cầu dây văng kiến trúc uốn lượn vượt sông Sài Gòn, biểu tượng cho bước phát triển thần tốc của thành phố sang bờ Đông.",
      },
      thuthiem: {
        title: "Trung tâm tài chính mới tương lai",
        description:
          "Vùng đất trù phú bên kia sông Sài Gòn, nơi quy hoạch quảng trường trung tâm lớn nhất nước và các công trình thế kỷ.",
      },
    },
    views: {
      heading: "Góc nhìn:",
      overview: {
        label: "Toàn Cảnh Sài Gòn",
        shortLabel: "Toàn Cảnh",
        description:
          "Góc nhìn flycam toàn cảnh 3km x 3km trung tâm TP. Hồ Chí Minh uốn lượn quanh sông Sài Gòn",
      },
      bitexco: {
        label: "Tháp Bitexco",
        shortLabel: "Bitexco",
        description: "Góc máy cận cảnh ngắm búp sen Bitexco Financial Tower và quảng trường ven sông",
      },
      river: {
        label: "Dọc Sông Sài Gòn",
        shortLabel: "Sông Sài Gòn",
        description: "Lướt dọc theo dòng sông Sài Gòn ngắm hai bờ Quận 1 và Thủ Thiêm",
      },
      benthanh: {
        label: "Trung Tâm Bến Thành",
        shortLabel: "Bến Thành",
        description: "Góc nhìn khu lõi thương mại và các đại lộ Lê Lợi, Hàm Nghi, Trần Hưng Đạo",
      },
      thuthiem: {
        label: "View từ Thủ Thiêm",
        shortLabel: "Thủ Thiêm",
        description: "Từ bờ Đông nhìn sang toàn bộ skyline tráng lệ của Quận 1",
      },
      "street-walk": {
        label: "Đi Bộ Dạo Phố",
        shortLabel: "Đi Bộ",
        description: "Góc nhìn thứ nhất (First-Person) đi bộ dạo phố Sài Gòn với nhân vật dùng chung",
      },
    },
    hint: "Kéo chuột trái để xoay · Chuột phải để di chuyển · Lăn chuột để phóng to/thu nhỏ",
    info: {
      title: "Mô Hình 3D TP. Hồ Chí Minh",
      intro:
        "Bản đồ mô phỏng không gian 3D tỷ lệ thực tế của trung tâm <strong>Thành phố Hồ Chí Minh (2025)</strong>, bao gồm dải skyline Quận 1, khu Bến Nghé, Bến Thành, sông Sài Gòn và bán đảo Thủ Thiêm (TP. Thủ Đức).",
      scaleLabel: "Quy mô hiển thị:",
      verticesLabel: "Số lượng đỉnh (Vertices):",
      verticesValue: "493,715 vertices",
      colorSystemLabel: "Hệ thống tạo màu:",
      licenseLabel: "Bản quyền 3D:",
      note: "Toàn bộ màu sắc kiến trúc (mái ngói terracotta, tường biệt thự vàng thuộc địa, kính phản quang cao ốc, mặt nước sông Sài Gòn) được phân tích và tạo màu thủ công kết hợp thuật toán tính toán độ cao và hướng pháp tuyến.",
      close: "Đóng",
    },
    loading: {
      title: "Đang tải bản đồ 3D TP. Hồ Chí Minh",
      detail: "Đang tính toán màu sắc kiến trúc & mặt nước (493K đỉnh)...",
    },
  },
};

export default hcm;
