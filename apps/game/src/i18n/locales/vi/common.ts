import type en from "../en/common";
import type { LocaleShape } from "../../types";

const common: LocaleShape<typeof en> = {
  appName: "SCAMMAZE",
  actions: {
    close: "Đóng",
    back: "Quay lại",
    cancel: "Hủy",
    retry: "Thử lại",
    reload: "Tải lại trang",
    returnToMenu: "Về menu chính",
    continue: "Tiếp tục",
  },
  audio: {
    on: "ÂM THANH BẬT",
    muted: "ÂM THANH TẮT",
    muteTitle: "Tắt âm thanh nền (M)",
    unmuteTitle: "Bật âm thanh nền (M)",
  },
  chapterLabel: "Chương {{number}}",
  loading: "Đang tải",
  logoAlt: "Biểu trưng SCAMMAZE",
};

export default common;
