import type en from "../en/menu";
import type { LocaleShape } from "../../types";

const menu: LocaleShape<typeof en> = {
  nav: { label: "Menu chính của trò chơi" },
  kicker: "Đừng tin ai. Nghi ngờ mọi thứ.",
  hints: { navigate: "Chọn", select: "Xác nhận" },
  buttons: {
    newGame: { label: "TRÒ CHƠI MỚI", sublabel: "Bắt đầu một câu chuyện mới" },
    continue: { label: "TIẾP TỤC", sublabel: "Chơi tiếp từ chỗ đã lưu" },
    settings: { label: "CÀI ĐẶT", sublabel: "Chất lượng đồ họa, góc nhìn và âm thanh" },
    credits: { label: "GHI CÔNG & GIẤY PHÉP", sublabel: "Ghi công gói mô hình thành phố và xe 3D" },
  },
  continueReasons: {
    none: "Không tìm thấy bản lưu nào.",
    invalid: "Không đọc được bản lưu của bạn. Hãy bắt đầu trò chơi mới.",
  },
};

export default menu;
