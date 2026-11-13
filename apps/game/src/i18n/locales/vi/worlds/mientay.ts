import type en from "../../en/worlds/mientay";
import type { LocaleShape } from "../../../types";

const mientay: LocaleShape<typeof en> = {
  mientay: {
    loading: {
      title: "Đang vào {{region}}",
      hint: "Miền Tây được dựng một lần trong lượt này để sau đó chạy mượt mà.",
      stages: {
        renderer: "Đang khởi động công cụ 3D",
        materials: "Đang làm cũ gỗ, gạch và vữa",
        terrain: "Đang tạo hình bờ sông",
        water: "Đang đổ nước vào sông",
        flora: "Đang trồng dừa, vườn cây và lau sậy",
        boats: "Đang neo ghe ở chợ nổi",
        village: "Đang dựng những căn nhà sàn",
        mansion: "Đang xây ngôi nhà cổ",
        shrine: "Đang dựng chùa Khmer",
        bridges: "Đang bắc cầu và lót lối đi",
        optimize: "Đang sắp xếp lại cảnh",
        pipeline: "Đang chuẩn bị ánh sáng và bóng đổ",
        shaders: "Đang khởi động đồ họa",
      },
    },
    backToMenu: "Về Menu Chính",
    header: "{{region}} · ĐỒNG BẰNG SÔNG CỬU LONG",
    pointer: {
      locked: "MOUSE LOCKED (Ctrl: mở)",
      unlocked: "MOUSE UNLOCKED (Click: khoá)",
    },
    lockHint: "Click chuột vào màn hình hoặc bấm <kbd>Ctrl</kbd> để điều khiển góc nhìn",
    mode: {
      label: "Cách di chuyển",
      walk: "Đi bộ",
      boat: "Chèo xuồng (B)",
      fly: "Bay (V)",
    },
    boardPrompt: "Nhấn <kbd>B</kbd> để bước xuống xuồng ba lá dạo sông",
    audio: {
      on: "Âm thanh: bật",
      off: "Âm thanh",
      title: "Âm thanh sông nước",
    },
    performance: {
      on: "Đồ họa: nhẹ",
      off: "Đồ họa: đầy đủ",
      title: "Chuyển giữa đồ họa đầy đủ và chế độ nhẹ",
    },
    hud: {
      hide: "Ẩn giao diện (H)",
      show: "Hiện giao diện (H)",
      fps: "{{fps}} FPS",
    },
    time: {
      label: "Thời gian trong ngày",
      dawn: "Bình minh",
      noon: "Nắng trưa",
      dusk: "Hoàng hôn",
      night: "Đêm đom đóm",
    },
    places: {
      label: "Nơi nên ghé",
      subtitles: {
        "ben-do": "Ngã ba sông và những chiếc ghe ở chợ nổi",
        "cho-noi": "Lênh đênh giữa những ghe hàng",
        "xom-nha-san": "Cầu ván, quán võng và nếp sống ven rạch",
        "nha-co": "Cổng tam quan, sân gạch tàu và mái ngói âm dương",
        "chua-khmer": "Chánh điện mái tam cấp và tượng Naga",
        "cau-khi-vuon": "Rạch dừa nước, cầu tre và vườn miệt vườn",
      },
    },
    zones: {
      label: "Vị trí",
    },
    controls: {
      toggle: "Phím điều khiển",
      move: "Di chuyển",
      sprint: "Chạy nhanh / chèo nhanh",
      jump: "Nhảy",
      punch: "Đấm",
      block: "Đỡ đòn",
      boat: "Lên hoặc rời xuồng",
      fly: "Bay",
      mouse: "Chuột",
      leftMouse: "Chuột Trái",
      rightMouse: "Chuột Phải",
      hideHud: "Ẩn giao diện",
    },
    stats: {
      speed: "Tốc độ:",
      position: "Vị trí:",
    },
  },
};

export default mientay;
