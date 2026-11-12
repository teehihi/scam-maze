import type en from "../en/settings";
import type { LocaleShape } from "../../types";

const settings: LocaleShape<typeof en> = {
  title: "Cài đặt hiển thị và âm thanh",
  subtitle: "Chọn ngôn ngữ, chất lượng hình ảnh 3D và âm thanh",
  language: {
    heading: "Ngôn ngữ",
  },
  graphics: {
    heading: "Chất lượng đồ họa",
    quality: {
      low: "Thấp",
      medium: "Trung bình",
      high: "Cao",
    },
    description: {
      low: "Giảm độ phân giải (0,75x) để chạy mượt hơn trên card đồ họa tích hợp.",
      medium: "Độ phân giải gốc (1,0x) với ánh sáng môi trường cân bằng.",
      high: "Hiển thị độ phân giải cao (tối đa 1,5x) với bóng đổ và chiều sâu tốt hơn.",
    },
  },
  fov: {
    heading: "Góc nhìn (FOV)",
    cinematic: "{{value}} (Điện ảnh)",
    default: "{{value}} (Mặc định)",
    wide: "{{value}} (Rộng)",
  },
  sound: {
    heading: "Âm thanh và âm nền",
    enabled: "ĐANG BẬT",
    muted: "ĐÃ TẮT",
    masterVolume: "Âm lượng chung",
  },
  voice: {
    heading: "Giọng nói và sự thoải mái",
    volume: "Âm lượng giọng nói",
    captions: "Phụ đề",
    phoneFilter: "Hiệu ứng loa điện thoại",
    englishFallback: "Dùng giọng tiếng Anh khi thiếu âm thanh tiếng Việt",
  },
  comfort: {
    reducedStress: "Chế độ giảm căng thẳng",
    reducedStressHint:
      "Âm thanh nhẹ hơn, không rung khi có cuộc gọi và dừng lâu hơn trước những câu căng thẳng. Câu chuyện không thay đổi.",
    motion: {
      heading: "Giảm chuyển động",
      system: "Theo hệ thống",
      on: "Bật",
      off: "Tắt",
    },
  },
  toggle: {
    on: "Bật",
    off: "Tắt",
  },
};

export default settings;
