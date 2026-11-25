import type en from "../../en/chapter1/voice";
import type { LocaleShape } from "../../../types";
/** Vietnamese captions of Alex's Mission 01 voice lines: the transcripts of `alex_<cue>_vi.mp3`. */
const voice: LocaleShape<typeof en> = {
  voice: {
    alex: {
      intro:
        "Bảy mươi hai giờ.\n" +
        "Đó là tất cả thời gian mình còn lại.\n" +
        "Ba ngày để hoàn thành khóa luận, lấy xác nhận của giảng viên, và nộp mọi thứ trước năm giờ chiều thứ Sáu.\n" +
        "Mình đã dành hàng tháng trời cho khóa luận này.\n" +
        "Vậy mà đến giờ, mọi thứ vẫn chưa đâu vào đâu.\n" +
        "Tiền tiết kiệm thì gần cạn. Mình sắp phải rời ký túc xá. Còn chuyện công việc sau khi tốt nghiệp... mình vẫn chưa biết phải làm sao.\n" +
        "Mình cứ nghĩ viết khóa luận là phần khó nhất.\n" +
        "Có lẽ mình đã nhầm.\n" +
        "Thôi nào...\n" +
        "Đã năm giờ chiều thứ Ba rồi.\n" +
        "Phải quay lại làm việc thôi.",
      thesisStart: "Được rồi. Cứ hoàn thành từng phần một.\nMình làm được mà.",
      emailReceived: "Xác nhận tốt nghiệp?\nKhoan đã... Tài khoản nộp khóa luận của mình có vấn đề gì sao?",
      emailSuspicious: "Mình không nhớ trường từng thông báo khoản phí này.\nNhưng... lỡ nó là thật thì sao?",
      verify: "Mình nên kiểm tra cổng thông tin của trường trước.\nTốt nhất là xác nhận trực tiếp với họ.",
      securityBreach: "Cái gì? Mình đâu có thực hiện giao dịch này!\nBình tĩnh nào...\nPhải liên hệ với ngân hàng. Ngay lập tức.",
      easyMoney: "Làm vài việc đơn giản mà kiếm được nhiều tiền vậy sao?\nNghe cũng hấp dẫn đấy.\nNhưng... có vẻ hơi dễ quá thì phải.",
      investment: "Nếu lợi nhuận này là thật, mình có thể giải quyết được khá nhiều vấn đề.\nNhưng... rốt cuộc nền tảng này hoạt động như thế nào?",
      exhausted: "Mình đọc đi đọc lại một đoạn mà chẳng hiểu gì nữa.\nChắc mình cần nghỉ một chút.",
      overnight: "Mình đã lỡ hạn hoàn thành bản thảo rồi.\nXem ra đêm nay lại phải thức khuya thôi.",
      // --- Mission 02 "THE RIDE" ---
      m02Briefed: "Chương 3 xong rồi, nhưng Mục 3.3 vẫn còn thiếu.\nMình cần câu trả lời của Cô Ba: tiểu thương nhận ra biên lai chuyển khoản giả thế nào.",
      m02Open: "Mười một giờ rồi. Hẹn Cô Ba lúc mười một rưỡi, ở Chợ Lớn.\nBuổi phỏng vấn cuối cùng. Lần này không được trễ.",
      m02Prepare: "Cửa chính văn phòng chợ, không phải trong hẻm.\nMình nên tính trước xem sẽ đi bằng gì.",
      m02DriverOffer: "Sáu mươi nghìn, tiền mặt, muốn dừng đâu cũng được.\nKhông app, không lịch sử chuyến đi... Chẳng ai biết mình đã đi đâu.",
      m02RouteChecked: "Bảy nghìn, ba trạm, lộ trình có ghi lại hẳn hoi.\nCó thể chậm hơn. Nhưng mình biết chắc nó dừng ở đâu.",
      m02Confirmed: "Cửa chính, phía chợ. Và Cô Ba đang đợi mình.\nMay mà mình gọi đúng số mình đã có sẵn.",
      m02OnBus: "Trả vé rồi, có ghi nhận đàng hoàng.\nBa mươi bốn phút tới Chợ Lớn. Tranh thủ xem lại mấy câu hỏi.",
      m02WrongStop: "Đây đâu phải văn phòng chợ.\nCòn cách ba dãy nhà, giờ lại đòi thêm ba mươi nghìn nữa?",
      m02Arrived: "Tới rồi. Chợ Lớn.\nCửa chính, không phải trong hẻm. Đi tìm Cô Ba thôi.",
      m02ArrivedLate: "Quá mười hai rưỡi rồi. Mình lỡ giờ hẹn.\nCô Ba đã đợi mình. Ít nhất cũng phải tới xin lỗi cô.",
      m02Rescheduled: "Cô vẫn đồng ý phỏng vấn.\nMình không được phí cơ hội thứ hai này.",
      m02LeftWithout: "Đi cả quãng đường tới Chợ Lớn, rồi về tay không.\nChương ba sẽ bị hổng một đoạn.",
      m02InterviewDone: "Tự kiểm tra, trên chính tài khoản của mình. Đó đúng là trích dẫn chương này còn thiếu.\nQuay lại bản thảo thôi. Hạn thứ Sáu không chờ ai cả.",
      m02Failed: "Hai giờ chiều rồi. Không có buổi phỏng vấn nào.\nGiờ mình phải giải thích với giảng viên vì sao chương ba thiếu nguồn.",
    },
  },
};
export default voice;
