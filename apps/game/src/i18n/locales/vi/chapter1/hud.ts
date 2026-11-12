import type en from "../../en/chapter1/hud";
import type { LocaleShape } from "../../../types";
const hud: LocaleShape<typeof en> = {
  titleCard: {
    eyebrow: "Chương {{number}}",
    preparing: "Đang chuẩn bị con phố",
    ready: "Con phố đã sẵn sàng",
    begin: "Bắt đầu",
    continue: "Tiếp tục",
  },
  hud: {
    phone: "Điện thoại",
    journal: "Sổ ghi chép",
    // Vietnamese has one plural form, so only `_other` is needed.
    unreadMessages_other: "{{number}} tin nhắn chưa đọc",
    newEntries_other: "{{number}} mục mới",
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
