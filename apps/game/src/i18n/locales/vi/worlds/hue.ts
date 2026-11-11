import type en from "../../en/worlds/hue";
import type { LocaleShape } from "../../../types";
const hue: LocaleShape<typeof en> = {
  hue: {
    loading: "Đang tải thế giới di sản {{city}}...",
    backToMenu: "Về Menu Chính",
    header: "{{city}} · DI SẢN BỜ {{river}}",
    pointer: {
      locked: "MOUSE LOCKED (Ctrl: mở)",
      unlocked: "MOUSE UNLOCKED (Click: khoá)",
    },
    lockHint: "Click chuột vào màn hình hoặc bấm <kbd>Ctrl</kbd> để điều khiển góc nhìn",
    bellToast: "Tiếng {{bell}} vang vọng đôi bờ {{river}}…",
    controls: {
      toggle: "Phím điều khiển",
      leftMouse: "Chuột Trái / F",
      rightMouse: "Chuột Phải",
      move: "Di chuyển",
      sprint: "Chạy nhanh",
      jump: "Nhảy",
      punch: "Đấm",
      block: "Đỡ đòn",
      interact: "Tương tác",
      viewHands: "Xem tay",
      ringBell: "Thỉnh chuông",
      mouse: "Chuột",
      collision: "Khung va chạm",
    },
    hud: {
      speed: "Tốc độ:",
      position: "Tọa độ:",
    },
  },
};
export default hue;
