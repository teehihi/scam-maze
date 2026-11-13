import type en from "../../en/chapter1/hud";
import type { LocaleShape } from "../../../types";
const hud: LocaleShape<typeof en> = {
  intro: {
    heading: "Chào mừng trở lại",
    preparing: "Đang quay lại con phố",
    welcome: {
      // One paragraph per voice clip (chapter1_voice1start_vi.mp3 ... chapter1_voice4start_vi.mp3).
      p1: "Ụa! Cậu về rồi nè! Lâu quá trời luôn á! Tớ còn tưởng cậu quên mất chỗ này rồi chứ!",
      p2: "Mà ở đây vẫn vậy hà, chẳng thay đổi gì mấy. Ngoài đường xe cộ vẫn chạy tấp nập, tiệm bánh mì ở góc đường sáng nào cũng thơm phức. Mấy cô chú trong xóm vẫn ngồi trước nhà trò chuyện rôm rả như mọi ngày. Chắc thấy cậu về, ai cũng vui lắm cho coi!",
      p3: "Thôi nè, hôm nay cứ đi chơi thoải mái nha! Muốn ghé đâu thì ghé, muốn đi đâu thì đi. Biết đâu trên đường lại gặp được người quen, hay khám phá ra chuyện gì thú vị thì sao?",
      p4: "Đi thôi nào! Tớ sẽ ở đây đồng hành cùng cậu. Cứ từ từ khám phá, còn nhiều điều hay ho đang chờ phía trước lắm đó!",
    },
    resume: "Chào mừng cậu quay lại! Mình đã giữ chỗ cho cậu rồi. Khi nào sẵn sàng, mình cùng tiếp tục từ chỗ cậu đã dừng nhé.",
    skip: "Nhấn chuột để hiện toàn bộ chữ",
    next: "Nhấn chuột để nghe tiếp",
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
