import type en from "../../en/chapter1/room";
import type { LocaleShape } from "../../../types";
const room: LocaleShape<typeof en> = {
  room: {
    laptop: {
      badge: {
        new: "Mới",
        opened: "Đã mở",
      },
      headline: {
        new: "Cảnh báo bảo mật: hoạt động bất thường trên tài khoản",
        opened: "Cảnh báo bảo mật: đã mở",
      },
    },
    // Chú thích khi nhìn vào thiết bị hoặc tờ lịch treo tường trong "LAST SUBMISSION: 72 GIỜ CUỐI".
    inspect: {
      phone: "Điện thoại của bạn. Tin nhắn, cuộc gọi, ngân hàng và lịch của bạn đều ở đây.",
      laptop: "Laptop của bạn. Thư, ngân hàng, lịch và các tệp khóa luận của bạn đều ở đây.",
      calendar: "Tờ lịch treo tường. Hạn cuối cùng là 17:00 thứ Sáu.",
    },
    prompt: {
      phoneRinging: "Nghe cuộc gọi",
      phoneDecline: "Từ chối cuộc gọi",
      phoneRecords: "Mở nhật ký điện thoại",
      laptopUse: "Dùng máy tính xách tay",
      doorLocked: "Lúc này cửa đang khóa.",
      doorBusy: "Hãy làm xong việc đang làm trước.",
    },
    records: {
      heading: "Nhật ký điện thoại",
      dialogLabel: "Nhật ký điện thoại",
      close: "Đóng nhật ký điện thoại",
      tabs: {
        calls: "Cuộc gọi",
        messages: "Tin nhắn",
        voicemail: "Thư thoại",
      },
      calls: {
        heading: "Lịch sử cuộc gọi",
        empty: "Chưa có cuộc gọi nào.",
        incoming: "Gọi đến",
        outgoing: "Gọi đi",
        missed: "Nhỡ",
        declined: "Đã từ chối",
        answered: "Đã nghe",
        row: "{{name}} · {{number}} · {{time}}",
        detailsHeading: "Chi tiết cuộc gọi",
        detailsOpen: "Mở chi tiết cuộc gọi",
        callerIdLabel: "Số hiển thị",
        durationLabel: "Thời lượng",
        summaryLabel: "Tóm tắt cuộc gọi",
      },
      messages: {
        heading: "Tin nhắn",
        empty: "Không có tin nhắn.",
        unread: "Chưa đọc",
      },
      voicemail: {
        heading: "Thư thoại",
        empty: "Không có thư thoại.",
        summary: "Thư thoại",
        recordOpen: "Mở bản ghi của cuộc gọi đầu tiên",
      },
      back: "Quay lại",
      callSaved: {
        called: "Bạn đã gọi đến liên hệ đã lưu.",
        label: "Gọi đến liên hệ đã lưu",
        unavailable: "Hiện chưa có liên hệ đã lưu nào.",
        hint: "Thao tác này gọi đến số bạn đã lưu từ trước tối nay.",
      },
      numbersPlain: "Các số được hiển thị dưới dạng văn bản thường.",
    },
    incomingCall: {
      ringing: "{{name}} đang gọi",
      missed: "Cuộc gọi nhỡ từ {{name}}. Bạn có thể gọi lại trong ứng dụng Cuộc gọi.",
    },
    progressSaved: "Đã lưu bản thảo · khóa luận {{percent}}%",
    objectiveToast: {
      new: "Mục tiêu mới: {{objective}}",
      done: "Đã hoàn thành mục tiêu: {{objective}}",
      hintLabel: "Gợi ý",
    },
    hints: {
      heading: "Gợi ý",
      show: "Hiện gợi ý",
      hide: "Ẩn gợi ý",
      none: "Hiện chưa có gợi ý nào.",
      answerOrDecline: "Có một cuộc gọi đến. Bạn có thể nghe hoặc từ chối.",
      checkLaptop: "Có thể đã có thông báo mới trên máy tính xách tay của bạn.",
      investigate: "Hãy xem tờ giấy, các hóa đơn, cuốn lịch, nhật ký điện thoại và máy tính xách tay.",
      answerRecovery: "Có thể sẽ có một cuộc gọi khác. Bạn có thể nghe hoặc từ chối.",
      decide: "Khi sẵn sàng, hãy mở bảng quyết định và chọn việc cần làm.",
      review: "Hãy đọc phần tổng kết để xem các sự việc liên quan với nhau như thế nào.",
    },
    ending: {
      transitionLabel: "Kết thúc chương",
      transitionLine: "Căn phòng lại yên tĩnh.",
      continue: "Xem chuyện gì đã xảy ra",
      skip: "Bỏ qua",
      simulation: "Đây là mô phỏng.",
    },
    status: {
      overlayOpen: "Một lớp giao diện đang mở. Nhấn Escape để đóng.",
      callActive: "Đang có một cuộc gọi.",
    },
    announce: {
      notification: "Một cảnh báo bảo mật mới đã đến máy tính xách tay của bạn.",
      evidence: "Đã ghi lại bằng chứng mới: {{title}}",
      deduction: "Đã ghi lại suy luận: {{statement}}",
    },
    hud: {
      hintPanelLabel: "Gợi ý cho mục tiêu hiện tại",
      mouseKeyHint: "Dùng chuột",
      mouseLockedHint: "Nhấn Ctrl để dùng chuột.",
      controlsLabel: "Điều khiển di chuyển",
      moveHint: "Di chuyển",
      lookHint: "Nhìn xung quanh",
    },
    call: {
      moreReplies: "Còn thêm lựa chọn phía dưới. Hãy cuộn hoặc dùng phím mũi tên.",
      toolsLabel: "Công cụ trong cuộc gọi",
      notes: "Ghi chú",
      notesLabel: "Mở ghi chú của bạn. Cuộc gọi vẫn tiếp tục.",
    },
  },
};
export default room;
