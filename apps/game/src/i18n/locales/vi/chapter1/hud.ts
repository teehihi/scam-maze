import type en from "../../en/chapter1/hud";
import type { LocaleShape } from "../../../types";
const hud: LocaleShape<typeof en> = {
  intro: {
    heading: "Chào mừng trở lại",
    preparing: "Đang quay lại con phố",
    welcome: {
      p1: "Ơ, cậu đây rồi! Lâu lắm rồi không gặp. Mình còn tưởng cậu quên đường về con phố này luôn rồi chứ.",
      p2: "Mọi thứ cũng không đổi mấy đâu. Xe máy vẫn chạy ngang qua, tiệm bánh mì ở góc phố đã thơm lừng từ sớm, mấy bác hàng xóm vẫn vẫy tay chào cậu như mọi khi. Cậu thuộc về nơi này mà, ai cũng quen mặt cậu.",
      p3: "Nên hôm nay cứ thong thả nhé. Cậu muốn ngó nghiêng, đi dạo đâu cũng được, gặp ai thì cứ trò chuyện. Con phố này để cậu tự do khám phá.",
    },
    resume: "Chào mừng cậu quay lại! Mình đã giữ chỗ cho cậu rồi. Khi nào sẵn sàng, mình cùng tiếp tục từ chỗ cậu đã dừng nhé.",
    skip: "Nhấn chuột để hiện toàn bộ chữ",
    continue: "Nhấn chuột để tiếp tục",
    controls: {
      heading: "Điều khiển",
      move: "Di chuyển",
      look: "Nhìn quanh",
      interact: "Tương tác",
      phone: "Điện thoại",
      journal: "Sổ ghi chép",
      pause: "Tạm dừng",
      mouse: "Chuột",
    },
    simulation: "Mọi thứ trong trò chơi này đều là mô phỏng.",
  },
  hud: {
    phone: "Điện thoại",
    journal: "Sổ ghi chép",
    // Vietnamese has one plural form, so only `_other` is needed.
    unreadMessages_other: "{{number}} tin nhắn chưa đọc",
    newEntries_other: "{{number}} mục mới",
    act: {
      label: "Hồi {{number}}: {{title}}",
    },
    saveTrimmed: {
      message:
        "Tiến trình đã lưu của bạn đã được cập nhật cho phiên bản mới của chương này. Tiến trình được khôi phục về điểm gần nhất vẫn còn phù hợp.",
      dismiss: "Đóng",
    },
  },
  objectives: {
    heading: "Mục tiêu",
    empty: "Không có mục tiêu nào đang thực hiện",
  },
  toast: {
    activated: "Mục tiêu mới",
    completed: "Đã hoàn thành mục tiêu",
  },
  notice: {
    evidenceRecorded: "Đã ghi lại bằng chứng mới:",
  },
  resume: {
    prompt: "Nhấn để tiếp tục",
  },
  saveFailure: {
    message: "Không thể lưu tiến trình trên thiết bị này.",
    dismiss: "Đóng thông báo",
  },
  page: {
    announce: {
      objectiveCompleted: "Đã hoàn thành mục tiêu: {{objective}}",
    },
  },
};
export default hud;
