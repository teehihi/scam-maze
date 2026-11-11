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
    enterCarPrompt: "Lên xe {{car}} (Lái xe)",
    controls: {
      title: "Phím điều khiển:",
      drivingTitle: "Điều khiển Lái Xe:",
      leftClickOrF: "Chuột Trái / F",
      rightClick: "Chuột Phải",
      move: "Di chuyển",
      sprint: "Chạy nhanh",
      jump: "Nhảy",
      punch: "Đấm",
      block: "Đỡ đòn (Block)",
      interact: "Tương tác / Vào xe",
      inspect: "Xem tay (Inspect)",
      toggleMouse: "Ẩn/Hiện chuột",
    },
    driving: {
      accelerate: "Đạp ga (Tăng tốc)",
      brakeReverse: "Phanh / Số lùi",
      steer: "Đánh lái vô lăng",
      handbrake: "Phanh tay",
      exit: "Xuống xe (dừng lại)",
    },
    walkingTip: "<strong>Mac Trackpad tip:</strong> Đi lại gần cửa xe {{car}} và nhấn <key>E</key> để vào xe lái!",
    drivingTip: "<strong>Mẹo:</strong> Nhấn <key>E</key> khi xe dừng để xuống xe. Lia chuột để xoay nhìn quanh cabin!",
    telemetry: {
      speed: "Tốc độ: <value>{{speed}} m/s</value>",
      speedLabel: "Tốc độ:",
      sprint: "[SPRINT]",
      positionZ: "Vị trí Z: <value>{{z}}m</value> (Đường Q4)",
      stateGrounded: "Trạng thái: Mặt đất",
      stateAirborne: "Trạng thái: Trên không",
      gearStarting: "P - NỔ MÁY...",
      engineStarting: "Động cơ: Đang khởi động (Chờ nổ máy)...",
      engineRunning: "Động cơ: V8 Twin-Turbo Đang Nổ Máy",
    },
  },
};
export default testmove;
