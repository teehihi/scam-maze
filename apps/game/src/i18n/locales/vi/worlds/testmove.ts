import type en from "../../en/worlds/testmove";
import type { LocaleShape } from "../../../types";
const testmove: LocaleShape<typeof en> = {
  testmove: {
    loadingMap: "Đang tải bản đồ đường phố 3D...",
    backToMenu: "Về Menu Chính",
    mouseLocked: "MOUSE LOCKED (Ctrl: mở)",
    mouseUnlocked: "MOUSE UNLOCKED (Click: khoá)",
    lockPrompt: {
      title: "Chế độ Thử Nghiệm Di Chuyển 3D",
      body: "Nhấn chuột vào màn hình hoặc bấm phím <kbd>Ctrl</kbd> để khóa chuột và xoay góc nhìn.",
      start: "Bắt đầu Điều Khiển",
    },
    controls: {
      title: "Phím điều khiển:",
      leftClickOrF: "Chuột Trái / F",
      rightClick: "Chuột Phải",
      move: "Di chuyển",
      sprint: "Chạy nhanh",
      jump: "Nhảy",
      punch: "Đấm",
      block: "Đỡ đòn (Block)",
      interact: "Tương tác",
      inspect: "Xem tay (Inspect)",
      toggleMouse: "Ẩn/Hiện chuột",
    },
    trackpadTip:
      "<strong>Mac Trackpad tip:</strong> Vuốt 1 ngón để lia camera mượt mà, dùng phím <key>F</key> để đấm mà không cần gõ mạnh trackpad!",
    telemetry: {
      speed: "Tốc độ: <value>{{speed}} m/s</value>",
      sprint: "[SPRINT]",
      positionZ: "Vị trí Z: <value>{{z}}m</value> (Đường Q4)",
      stateGrounded: "Trạng thái: Mặt đất",
      stateAirborne: "Trạng thái: Trên không",
    },
  },
};
export default testmove;
