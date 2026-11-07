/**
 * Kịch bản demo (curated JSON-like data). Tất cả nội dung đều giả lập —
 * tên miền dưới đây là ví dụ, KHÔNG được truy cập hay mở thật.
 */

export type Outcome = "safe" | "partial" | "loss";

export interface Choice {
  id: string;
  label: string;
  next: string;
  /** Tín hiệu cảnh báo được chỉ ra sau khi người chơi chọn. */
  flags: string[];
  /** Cách xác minh độc lập. */
  verify: string;
  /** Giải thích mở rộng — chỉ hiển thị khi bật “AI giải thích” (nội dung mẫu). */
  aiNote: string;
}

export interface StepNode {
  kind: "step";
  id: string;
  channel: string;
  title: string;
  body: string;
  choices: Choice[];
}

export interface EndNode {
  kind: "end";
  id: string;
  outcome: Outcome;
  title: string;
  body: string;
  checklist: string[];
}

export type ScenarioNode = StepNode | EndNode;

export const START_ID = "sms";

export const scenario: Record<string, ScenarioNode> = {
  sms: {
    kind: "step",
    id: "sms",
    channel: "SMS · số lạ",
    title: "Đơn hàng bị giữ",
    body:
      "[GHN-Express] Đơn #VN88213 đang bị giữ do sai địa chỉ. Xác nhận trong 30 PHÚT tại ghn-xacminh.top/otp, nếu không đơn sẽ bị hoàn về.",
    choices: [
      {
        id: "tap",
        label: "Bấm vào link để xác nhận ngay",
        next: "form",
        flags: [
          "Áp lực thời gian: “30 PHÚT”, “nếu không sẽ bị hoàn”.",
          "Tên miền ghn-xacminh.top không phải ghn.vn (đuôi .top hay bị lạm dụng).",
          "Đường dẫn /otp — dịch vụ giao hàng thật không cần OTP để xác nhận địa chỉ.",
        ],
        verify: "Mở app/website chính thức bạn tự gõ, hoặc gọi hotline in trên hóa đơn.",
        aiNote:
          "Kẻ lừa đảo tạo cảm giác khẩn cấp để bạn hành động trước khi kịp suy nghĩ. Đây là bước đầu của chuỗi dẫn dắt nhiều bước.",
      },
      {
        id: "verify",
        label: "Không bấm link, tự mở app mua hàng để kiểm tra đơn",
        next: "safe-1",
        flags: [
          "Bạn tách kênh xác minh: không đi theo đường dẫn do người lạ gửi.",
        ],
        verify: "Tra mã đơn trong app bạn đã cài từ trước; nếu không có đơn, đó là dấu hiệu rõ ràng.",
        aiNote:
          "Xác minh độc lập (out-of-band) là thói quen hiệu quả nhất: dùng kênh bạn tự chọn, không dùng kênh đối phương đưa.",
      },
    ],
  },
  form: {
    kind: "step",
    id: "form",
    channel: "Trang giả lập · ghn-xacminh.top",
    title: "“Xác nhận danh tính để giữ đơn”",
    body:
      "Trang yêu cầu số điện thoại và mã OTP 6 số vừa được gửi tới máy bạn. Đồng hồ đếm ngược 04:59 đang chạy.",
    choices: [
      {
        id: "otp",
        label: "Nhập mã OTP vừa nhận",
        next: "loss",
        flags: [
          "OTP là chìa khoá xác thực giao dịch của CHÍNH BẠN — không ai chính danh yêu cầu bạn đọc/nhập cho họ.",
          "Đồng hồ đếm ngược nhân tạo để chặn bạn suy nghĩ.",
        ],
        verify: "Đọc nội dung tin nhắn OTP: nó thường ghi rõ giao dịch/ngân hàng mà mã dùng để duyệt.",
        aiNote:
          "Mã OTP bạn nhận lúc này thực chất đang duyệt một giao dịch hoặc đăng nhập do kẻ lừa đảo khởi tạo.",
      },
      {
        id: "stop",
        label: "Dừng lại, đóng trang, không nhập gì cả",
        next: "partial",
        flags: [
          "Bạn nhận ra yêu cầu OTP là điểm không thể chấp nhận.",
        ],
        verify: "Đổi mật khẩu nếu đã nhập thông tin khác; báo cáo số điện thoại/link cho nhà mạng hoặc cơ quan chức năng.",
        aiNote:
          "Dừng lại muộn vẫn tốt hơn không dừng. Bước tiếp theo là kiểm tra xem bạn đã lộ thông tin gì.",
      },
    ],
  },
  "safe-1": {
    kind: "end",
    id: "safe-1",
    outcome: "safe",
    title: "Bạn thoát khỏi mê cung",
    body: "Trong app không có đơn nào bị giữ. Tin nhắn chỉ là mồi nhử.",
    checklist: [
      "Dừng — áp lực thời gian là tín hiệu, không phải lý do để vội.",
      "Tách kênh — tự mở app/website chính thức.",
      "Không chia sẻ OTP, mật khẩu, mã PIN với bất kỳ ai.",
    ],
  },
  partial: {
    kind: "end",
    id: "partial",
    outcome: "partial",
    title: "Thoát được, nhưng đã chạm vào bẫy",
    body: "Bạn đã mở link lạ nên số điện thoại có thể bị đánh dấu là “đang hoạt động”. Hãy cảnh giác với các tin nhắn tiếp theo.",
    checklist: [
      "Đừng bấm link ngay cả khi tò mò — chỉ nhìn tên miền là đủ.",
      "Đừng nhập bất kỳ thông tin gì nếu trang đòi OTP.",
      "Báo cáo tin nhắn và chặn số.",
    ],
  },
  loss: {
    kind: "end",
    id: "loss",
    outcome: "loss",
    title: "Bạn mắc bẫy",
    body: "Kẻ lừa đảo dùng OTP bạn vừa nhập để duyệt giao dịch. Trong đời thật: liên hệ ngân hàng ngay để khoá thẻ/tài khoản.",
    checklist: [
      "Gọi ngay hotline mặt sau thẻ để khoá giao dịch.",
      "Đổi mật khẩu các tài khoản liên quan, bật xác thực 2 lớp bằng ứng dụng.",
      "Lưu bằng chứng (tin nhắn, link) và trình báo cơ quan chức năng.",
    ],
  },
};
