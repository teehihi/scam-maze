import type en from "../en/menu";
import type { LocaleShape } from "../../types";

const menu: LocaleShape<typeof en> = {
  nav: { label: "Menu chính của trò chơi" },
  buttons: {
    newGame: { label: "TRÒ CHƠI MỚI", sublabel: "Bắt đầu Chương {{number}}: {{title}}" },
    continue: { label: "TIẾP TỤC", sublabel: "Chơi tiếp từ chỗ đã lưu" },
    settings: { label: "CÀI ĐẶT", sublabel: "Chất lượng đồ họa, góc nhìn và âm thanh" },
    credits: { label: "GHI CÔNG & GIẤY PHÉP", sublabel: "Ghi công gói mô hình thành phố và xe 3D" },
  },
  continueReasons: {
    none: "Không tìm thấy bản lưu nào.",
    invalid: "Không đọc được bản lưu của bạn. Hãy bắt đầu trò chơi mới.",
  },
  prologue: {
    title: "Mở đầu: Một buổi sáng bình thường",
    subtitle: "Chương 1 — Nơi đường phố gặp thế giới số",
    location: "Một con phố trong thành phố · Buổi sáng",
    heading: "Thông báo đến trước cả bữa sáng.",
    intro:
      "Mặt trời đang lên trên những tòa nhà gạch và các cửa hàng yên tĩnh dọc con phố của bạn. Bạn vừa rót một tách cà phê thì điện thoại rung lên với một cảnh báo khẩn:",
    alertTitle: "THÔNG BÁO KHẨN TỪ NGÂN HÀNG",
    alertBody:
      "“Tài khoản #9284 bị tạm khóa do có hoạt động đáng ngờ ở nước ngoài. Hãy xác minh danh tính trong vòng 15 phút để tránh bị khóa vĩnh viễn.”",
    outro:
      "Dưới nhà, con phố đã nhộn nhịp. Hàng xóm đang đi làm, xe giao hàng đỗ dọc vỉa hè, và cửa hàng ở góc phố đang mở cửa. Bạn sẽ làm gì?",
    howToPlay: {
      heading: "Cách chơi",
      move: "Di chuyển bằng W, A, S và D.",
      look: "Dùng chuột để nhìn xung quanh.",
      interact: "Nhấn E để tương tác.",
      phone: "Nhấn P để mở điện thoại.",
      journal: "Nhấn J để mở sổ ghi chép bằng chứng.",
      pause: "Nhấn Esc để tạm dừng.",
      simulation: "Mọi thứ trong chương này đều là mô phỏng.",
    },
    duration: "Có thể chơi · khoảng 8 đến 15 phút",
    back: "Về menu chính",
    begin: "Bắt đầu Chương {{number}}",
  },
};

export default menu;
