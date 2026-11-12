import type en from "../../en/chapter1/phone";
import type { LocaleShape } from "../../../types";
const phone: LocaleShape<typeof en> = {
  phone: {
    overlay: {
      name: "Điện thoại",
      close: "Đóng điện thoại",
      closeLabel: "Đóng",
      decidePrompt: "Bây giờ bạn có thể quyết định cách xử lý cuộc gọi.",
      decide: "Quyết định",
    },
    routes: {
      home: "Màn hình chính",
      messages: "Tin nhắn",
      calls: "Cuộc gọi",
    },
    home: {
      heading: "Màn hình chính",
      messages: "Tin nhắn",
      calls: "Cuộc gọi",
      unread_other: "{{number}} chưa đọc",
    },
    messages: {
      heading: "Tin nhắn",
      back: "Quay lại",
      backToList: "Quay lại danh sách tin nhắn",
      empty: "Không có tin nhắn.",
      unread: "Chưa đọc",
      recorded: "Đã ghi vào sổ ghi chép",
      from: "Người gửi",
    },
    calls: {
      heading: "Cuộc gọi",
      back: "Quay lại",
      empty: "Chưa có cuộc gọi nào.",
      inspectNumber: "Kiểm tra số điện thoại",
      recorded: "Đã ghi vào sổ ghi chép",
      incoming: "Cuộc gọi đến",
      outgoing: "Cuộc gọi đi",
      status: {
        ringing: "Đang đổ chuông",
        answered: "Đã nghe máy",
        ended: "Đã nghe máy",
        declined: "Đã từ chối",
        missed: "Gọi nhỡ",
      },
    },
    bank: {
      back: "Quay lại",
    },
    incomingCall: {
      caption: "Cuộc gọi đến",
      accept: "Nghe máy",
      decline: "Từ chối",
    },
    call: {
      status: "Đang trong cuộc gọi",
      hangUp: "Kết thúc cuộc gọi",
      speaker: "Loa ngoài",
      replayAria: "Nghe lại câu vừa rồi",
      connecting: "Đã kết nối. Đang chờ người gọi lên tiếng.",
      duration: "Thời lượng cuộc gọi",
      mute: "Tắt tiếng",
      unmute: "Bật tiếng",
      replay: "Nghe lại",
      listening: "Đang nghe người gọi nói.",
      showReplies: "Hiện các câu trả lời ngay",
      notice: {
        autoplayBlocked: "Trình duyệt đang chặn âm thanh. Hãy nhấn Nghe lại để nghe câu này.",
        devPreview: "Đây là giọng xem thử khi phát triển. Đây không phải bản ghi âm.",
        englishVoice: "Câu này được đọc bằng tiếng Anh. Phụ đề bằng tiếng Việt.",
        noAudio: "Câu này không có âm thanh. Hãy đọc phụ đề.",
      },
    },
    subtitle: {
      label: "Phụ đề cuộc gọi",
    },
    sound: {
      ringing: "Điện thoại đang đổ chuông",
      connected: "Cuộc gọi đã kết nối",
    },
    callPresentation: {
      name: "Cuộc gọi điện thoại",
      screenLabel: "Màn hình điện thoại",
    },
  },
};
export default phone;
