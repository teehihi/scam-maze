import type en from "../../en/worlds/ueh";
import type { LocaleShape } from "../../../types";

const ueh: LocaleShape<typeof en> = {
  ueh: {
    backToMenu: "Về Menu Chính",
    header: {
      campus: "UEH CAMPUS",
      muaHa: "{{title}} (MƯA RÀO)",
      ngayMai: "{{title}} (HOA PHƯỢNG BAY)",
    },
    pointer: {
      locked: "MOUSE LOCKED (Ctrl: mở)",
      unlocked: "MOUSE UNLOCKED (Click: khoá)",
    },
    guitar: {
      title: "Gảy Đàn Guitar · Đổi Giai Điệu",
      switchTo: "Đổi sang: <strong>{{track}}</strong>",
      nextMuaHa: "{{title}} (Cơn mưa hạ)",
      nextNgayMai: "{{title}} (Hoa phượng bay)",
    },
    lockPrompt: {
      title: "Khám Phá Khuôn Viên UEH",
      body: "Nhấn chuột vào màn hình hoặc bấm phím <kbd>Ctrl</kbd> để khóa chuột và điều khiển góc nhìn.",
      start: "Bắt đầu Điều Khiển",
    },
    controls: {
      heading: "PHÍM ĐIỀU KHIỂN:",
      leftMouse: "Chuột Trái / F",
      rightMouse: "Chuột Phải",
      move: "Di chuyển",
      sprint: "Chạy nhanh",
      jump: "Nhảy",
      punch: "Đấm",
      block: "Đỡ đòn (Block)",
      interact: "Tương tác (Đàn)",
      viewHands: "Xem tay",
      toggleCursor: "Ẩn / Hiện chuột",
      tip: "Tiến lại ghế đá dưới tán phượng và bấm phím <strong>E</strong> để gảy đàn guitar & đổi giai điệu / thời tiết.",
    },
    hud: {
      speed: "Tốc độ:",
      position: "Tọa độ:",
      grounded: "Mặt sân trường",
      airborne: "Đang nhảy",
    },
    toast: {
      muaHa: "Đang phát: {{title}} — Cơn mưa mùa hạ man mác trên sân trường UEH",
      ngayMai: "Đang phát: {{title}} — Hoa phượng đỏ ngập tràn gió chiều UEH",
    },
  },
};

export default ueh;
