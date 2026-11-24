// Vietnamese display text of the Chapter 1 scenario "LAST SUBMISSION: 72 GIỜ CUỐI".
// Display-only: it never changes IDs, rules, evidence, decisions, outcomes or game state.
// Keys follow `narrativeTextEntries` (see `game/narrative/localize.ts`). Addresses and fictional phone
// numbers are not translated. Mission 01 text is here; each later mission adds its own.
import type { NarrativeOverlay } from "../../game/narrative/localize";

const TRANSFER_ALERTS = [
  "Một giao dịch 300.000 VNĐ đến người nhận không quen vừa được thực hiện. Nếu không phải bạn, hãy gọi số in trên thẻ ngân hàng.",
  "Một giao dịch 500.000 VNĐ đến người nhận không quen vừa được thực hiện. Nếu không phải bạn, hãy gọi số in trên thẻ ngân hàng.",
  "Một giao dịch 700.000 VNĐ đến người nhận không quen vừa được thực hiện. Nếu không phải bạn, hãy gọi số in trên thẻ ngân hàng.",
] as const;

export const LAST_SUBMISSION_NARRATIVE_VI: NarrativeOverlay = {
  title: "LAST SUBMISSION: 72 GIỜ CUỐI",
  subtitle: "Nộp khóa luận trước 17:00 thứ Sáu.",

  // Thesis tasks (the draft)
  "thesis/draft.intro-review/label": "Chỉnh sửa phần mở đầu và tổng quan tài liệu",
  "thesis/draft.intro-review/description": "Làm chặt lập luận và sửa phần trích dẫn.",
  "thesis/draft.findings/label": "Sửa phần kết quả",
  "thesis/draft.findings/description": "Gộp ghi chú phỏng vấn và kiểm tra từng số liệu.",
  "thesis/draft.final/label": "Hoàn thành toàn bộ bản thảo",
  "thesis/draft.final/description": "Đọc lại cả bản thảo một lần và đánh dấu sẵn sàng cho giảng viên.",

  // Bank ledger lines
  "ledger/ledger.clearance-fee": "Phí xác nhận sinh viên quốc tế (trang thanh toán)",
  "ledger/ledger.unauthorized-1": "Chuyển tiền đến người nhận không rõ",
  "ledger/ledger.unauthorized-2": "Chuyển tiền đến người nhận không rõ",
  "ledger/ledger.unauthorized-3": "Chuyển tiền đến người nhận không rõ",

  // The email and the page it leads to
  "device/mail.clearance/title": "Graduation Clearance — Action Required",
  "device/mail.clearance/from": "Văn phòng Tốt nghiệp <clearance@payment-ueh.vn>",
  "device/mail.clearance/body":
    "Chào bạn,\n\nTài khoản nộp luận văn của bạn đã bị khóa vì chưa thanh toán phí xác nhận sinh viên quốc tế.\n\n" +
    "Phí: 800.000 VNĐ\nHạn: trong hôm nay\n\n" +
    "Thanh toán ngay để mở khóa tài khoản: https://payment-ueh.vn/confirm\n\n" +
    "Nếu không thanh toán trong hôm nay, tài khoản sẽ tiếp tục bị khóa và bạn có thể lỡ đợt tốt nghiệp.\n\nVăn phòng Tốt nghiệp",
  "device/mail.clearance/actions/open-link/label": "Mở liên kết thanh toán",
  "device/mail.clearance/actions/compare-fee-with-saved-portal/label": "So sánh khoản phí với mục dịch vụ trên cổng sinh viên đã lưu",
  "device/page.fee/title": "Trang thanh toán: phí xác nhận sinh viên quốc tế",
  "device/page.fee/from": "Trang thanh toán",
  "device/page.fee/detail": "payment-ueh.vn",
  "device/page.fee/body":
    "Phí xác nhận sinh viên quốc tế: 800.000 VNĐ.\nĐăng nhập bằng tài khoản sinh viên để tiếp tục.\n\n" +
    "Đây là trang mô phỏng. Trò chơi không dùng thông tin đăng nhập, thẻ hay mã thật.",
  "device/page.fee/actions/close/label": "Đóng trang",
  "device/page.fee/actions/sign-in/label": "Đăng nhập bằng tài khoản sinh viên của tôi",
  "device/page.fee/actions/pay-card/label": "Thanh toán phí bằng thẻ",
  "device/page.fee/actions/enter-code/label": "Nhập mã xác thực từ điện thoại của tôi",

  // The saved portal and the Training Office
  "device/portal.saved/title": "Cổng sinh viên (đã lưu)",
  "device/portal.saved/detail": "student.ueh.edu.vn",
  "device/portal.saved/body": "Đường dẫn bạn đã lưu cho cổng nộp luận văn từ lúc đăng ký.",
  "device/portal.saved/actions/check-account/label": "Đăng nhập cổng đã lưu và kiểm tra tài khoản của tôi",
  "device/portal.saved/actions/submit-thesis/label": "Nộp khóa luận bản cuối và lưu biên nhận",
  "device/file.portal-status/title": "Trạng thái cổng (đã lưu)",
  "device/file.portal-status/body": "Tài khoản nộp luận văn: đang hoạt động.\nKhoản phí còn nợ: không có.",
  "device/file.fee-comparison/title": "Đối chiếu địa chỉ thanh toán",
  "device/file.fee-comparison/body": "Cổng sinh viên đã lưu liệt kê payment.ueh.edu.vn là địa chỉ thanh toán. Email yêu cầu chuyển tới payment-ueh.vn. Hai tên miền không khớp; đối chiếu này không xác nhận trạng thái tài khoản.",
  "device/contact.training-office/title": "Phòng Đào tạo (liên hệ chính thức)",
  "device/contact.training-office/detail": "+000 100 0200",
  "device/contact.training-office/body": "Số của phòng được lưu trong điện thoại từ sổ tay sinh viên.",
  "device/contact.training-office/actions/call/label": "Gọi Phòng Đào tạo",
  "device/contact.training-office/actions/call/transcript/0": "Phòng Đào tạo xin nghe. Tôi có thể giúp gì cho bạn?",
  "device/contact.training-office/actions/call/transcript/1": "Chào cô/chú, em là Alex, sinh viên quốc tế năm cuối. Em gọi theo số trong sổ tay sinh viên.",
  "device/contact.training-office/actions/confirm-fee/label": "Mô tả email và hỏi khoản phí có thật không",
  "device/contact.training-office/actions/confirm-fee/transcript/0":
    "Em nhận được một email nói tài khoản nộp luận văn của em bị khóa cho đến khi em trả phí xác nhận 800.000 VNĐ trong hôm nay. Khoản phí này có thật không ạ?",
  "device/contact.training-office/actions/confirm-fee/transcript/1":
    "Không. Chúng tôi không có khoản phí nào như vậy cho việc nộp luận văn. Bạn đừng dùng liên kết đó. Đừng đưa cho ai thông tin đăng nhập hay mã xác thực. Chúng tôi không bao giờ hỏi những thứ này.",
  "device/contact.training-office/actions/ask-account/label": "Nhờ họ xác nhận tài khoản nộp luận văn của tôi đang hoạt động",
  "device/contact.training-office/actions/ask-account/transcript/0": "Cô/chú có thể xác nhận giúp em là tài khoản nộp luận văn đang hoạt động và em không nợ khoản nào không ạ?",
  "device/contact.training-office/actions/ask-account/transcript/1":
    "Có. Tài khoản của bạn đang hoạt động và bạn không nợ khoản nào. Chúng tôi sẽ gửi một thư trả lời ngắn để bạn lưu lại.",
  "device/mail.office-reply/title": "Re: Câu hỏi về khoản phí xác nhận",
  "device/mail.office-reply/from": "Phòng Đào tạo <training@ueh.edu.vn>",
  "device/mail.office-reply/body":
    "Chào bạn,\n\nKhông có khoản phí xác nhận sinh viên quốc tế nào cho việc nộp luận văn. Tài khoản nộp luận văn của bạn đang hoạt động và bạn không nợ khoản nào.\n\n" +
    "Hãy viết lại cho chúng tôi nếu bạn nhận được thêm tin nhắn nào về phí.\n\nPhòng Đào tạo",
  "device/file.office-confirmation/title": "Thư trả lời của Phòng Đào tạo (đã lưu)",
  "device/file.office-confirmation/body":
    "Bản lưu thư trả lời của Phòng Đào tạo: không có phí xác nhận nào và tài khoản nộp luận văn đang hoạt động.",

  // Security breach
  "device/settings.security/title": "Cài đặt bảo mật tài khoản",
  "device/settings.security/body":
    "Đổi mật khẩu, đăng xuất các thiết bị khác và kiểm tra tùy chọn khôi phục của email sinh viên và ứng dụng ngân hàng.",
  "device/settings.security/actions/change-passwords/label": "Đổi mật khẩu và đăng xuất các thiết bị khác",
  "device/settings.security/actions/recover-access/label": "Khôi phục quyền truy cập tài khoản",
  "device/contact.bank/title": "Hỗ trợ ngân hàng (đường dây chính thức)",
  "device/contact.bank/detail": "+000 100 0100",
  "device/contact.bank/body": "Số in ở mặt sau thẻ ngân hàng của bạn.",
  "device/contact.bank/actions/call/label": "Gọi đường dây chính thức",
  "device/contact.bank/actions/call/transcript/0": "Hỗ trợ ngân hàng xin nghe. Vì an toàn của bạn, tôi sẽ không bao giờ hỏi mật khẩu, mã PIN hay bất kỳ mã xác thực nào.",
  "device/contact.bank/actions/call/transcript/1": "Xin chào. Tôi nghĩ có người đã có thông tin đăng nhập của tôi và có thể dùng tài khoản ngân hàng của tôi. Tôi muốn báo cáo.",
  "device/contact.bank/actions/report-fraud/label": "Kể lại sự việc và nhờ ngân hàng chặn giao dịch chuyển tiền",
  "device/contact.bank/actions/report-fraud/transcript/0":
    "Tôi đã nhập thông tin đăng nhập vào một trang thanh toán không phải của trường. Nhờ ngân hàng kiểm tra tài khoản và chặn mọi giao dịch chuyển tiền tôi không đồng ý.",
  "device/contact.bank/actions/report-fraud/transcript/1":
    "Tôi đã chặn các giao dịch chuyển tiền đi từ tài khoản của bạn và mở việc xem xét các giao dịch trước đó. Tôi không thể hứa hoàn tiền. Việc xem xét sẽ quyết định điều đó.",
  "device/contact.bank/actions/ask-next/label": "Hỏi bước tiếp theo cần làm",
  "device/contact.bank/actions/ask-next/transcript/0": "Bây giờ tôi nên làm gì?",
  "device/contact.bank/actions/ask-next/transcript/1":
    "Hãy đổi mật khẩu của mọi tài khoản dùng chung mật khẩu đó, đăng xuất các thiết bị khác và giữ lại các bằng chứng. Đừng gọi lại bất kỳ số nào trong tin nhắn.",
  "device/file.bank-report/title": "Mã báo cáo của ngân hàng (đã lưu)",
  "device/file.bank-report/body":
    "Mã: BR-0001. Ngân hàng đã chặn các giao dịch chuyển tiếp từ tài khoản của bạn và sẽ xem xét các giao dịch trước đó.",
  "device/mail.login-alert/title": "Đăng nhập mới vào tài khoản sinh viên của bạn",
  "device/mail.login-alert/from": "Bảo mật tài khoản <no-reply@ueh.edu.vn>",
  "device/mail.login-alert/body":
    "Hệ thống ghi nhận một lần đăng nhập vào tài khoản sinh viên từ thiết bị chưa quen. Nếu không phải bạn, hãy đổi mật khẩu.",
  "device/msg.bank-alert-1/title": "Thông báo ngân hàng",
  "device/msg.bank-alert-1/from": "Ngân hàng",
  "device/msg.bank-alert-1/body": TRANSFER_ALERTS[0],
  "device/msg.bank-alert-2/title": "Thông báo ngân hàng",
  "device/msg.bank-alert-2/from": "Ngân hàng",
  "device/msg.bank-alert-2/body": TRANSFER_ALERTS[1],
  "device/msg.bank-alert-3/title": "Thông báo ngân hàng",
  "device/msg.bank-alert-3/from": "Ngân hàng",
  "device/msg.bank-alert-3/body": TRANSFER_ALERTS[2],

  // Ordinary life of Alex
  "device/msg.minh/title": "Minh",
  "device/msg.minh/from": "Minh (nhóm khóa luận)",
  "device/msg.minh/body": "Bạn xong phần phương pháp chưa? Xong thì gửi mình nhé.",
  "device/mail.supervisor/title": "Nhận xét bản thảo: mời xem các góp ý ở chương 3",
  "device/mail.supervisor/from": "Giảng viên hướng dẫn <supervisor@ueh.edu.vn>",
  "device/mail.supervisor/body": "Chào Alex,\n\nTôi đã thêm góp ý ở chương 3. Em hãy xem lại khi hoàn thành bản thảo.\n\nTrân trọng",
  "device/mail.library/title": "Giờ mở cửa trong mùa thi",
  "device/mail.library/from": "Thư viện trường <library@ueh.edu.vn>",
  "device/mail.library/body": "Trong mùa thi, thư viện mở cửa sớm hơn một giờ và đóng cửa muộn hơn một giờ.",
  "device/mail.print-shop/title": "Đơn in của bạn đã sẵn sàng để nhận",
  "device/mail.print-shop/from": "Tiệm in <orders@inkhoaluan.vn>",
  "device/mail.print-shop/body": "Đơn của bạn đã sẵn sàng. Tiệm mở cửa đến 21:00.",
  "device/file.draft/title": "thesis-draft.docx",
  "device/file.draft/body": "Bản thảo khóa luận của bạn. Hãy chỉnh sửa trên laptop, ở tab Khóa luận.",

  // Appointments
  "device/cal.draft-deadline/title": "Hạn nội bộ: hoàn thành bản thảo",
  "device/cal.draft-deadline/body": "Hoàn thành toàn bộ bản thảo trước khi giảng viên xem. Nếu chưa xong, bạn sẽ phải làm việc xuyên đêm.",
  "device/cal.interview/title": "Phỏng vấn người tham gia nghiên cứu",
  "device/cal.interview/detail": "Quận 5",
  "device/cal.interview/body": "Cuộc hẹn đã được xác nhận lúc 11:30.",
  "device/cal.final-deadline/title": "Hạn nộp cuối cùng",
  "device/cal.final-deadline/body": "Nộp bản cuối cùng của khóa luận trước 17:00.",

  // EASY MONEY
  "device/msg.easy-money/title": "Linh",
  "device/msg.easy-money/from": "Linh (sinh viên khoa khác)",
  "device/msg.easy-money/body":
    "Chào Alex! Mình tìm được một việc online. Bạn chấm điểm các trang sản phẩm ngắn, mỗi việc khoảng 5 phút, và tiền hiện trong ứng dụng ngay. " +
    "Hôm nay mình nhận phần thưởng đầu tiên rồi. Bạn thử đi, đây là tiền dễ kiếm cho sinh viên: quickpay-tasks.vn",
  "device/msg.easy-money/actions/ask-linh/label": "Hỏi Linh xem bạn ấy được trả tiền thế nào",
  "device/msg.easy-money/actions/ask-linh/transcript/0": "Hay quá! Bạn được trả tiền thế nào? Bạn có phải trả khoản nào không?",
  "device/msg.easy-money/actions/ask-linh/transcript/1":
    "Việc làm được trả trong ứng dụng. Để lên cấp 2 mình nạp 300.000 và họ nói tiền sẽ trả lại cùng thu nhập. Mình đã thử rút nhưng nó báo tài khoản đang được xem xét.",
  "device/msg.easy-money/actions/open-link/label": "Mở trang việc làm",
  "device/msg.easy-money/actions/decline/label": "Nói với Linh cảm ơn nhưng mình không tham gia",
  "device/msg.easy-money/actions/decline/transcript/0": "Cảm ơn Linh, nhưng mình xin phép không tham gia. Mình phải xong khóa luận trước.",
  "device/msg.easy-money/actions/decline/transcript/1": "Ừ, không sao. Chúc bạn làm khóa luận thuận lợi nhé!",
  "device/job.platform/title": "Việc online: chấm điểm trang sản phẩm",
  "device/job.platform/from": "QuickPay Tasks",
  "device/job.platform/detail": "quickpay-tasks.vn",
  "device/job.platform/body":
    "Kiếm tiền từ điện thoại. Chấm điểm các trang sản phẩm và được trả cho từng việc.\n\n" +
    "Cấp 1: việc miễn phí. Các cấp cao hơn cần nạp tiền và trả nhiều hơn.\n\n" +
    "Đây là trang mô phỏng. Trò chơi không dùng tiền, tài khoản hay việc làm thật.",
  "device/job.platform/actions/check-company/label": "Tra cứu tên công ty và đăng ký kinh doanh",
  "device/job.platform/actions/do-task-1/label": "Làm việc cấp 1: chấm điểm 3 trang sản phẩm",
  "device/job.platform/actions/try-withdraw-1/label": "Thử rút tiền thưởng",
  "device/job.platform/actions/deposit-1/label": "Nạp 300.000 VNĐ để mở khóa cấp 2",
  "device/job.platform/actions/do-task-2/label": "Làm việc cấp 2: chấm điểm 5 trang sản phẩm",
  "device/job.platform/actions/try-withdraw-2/label": "Thử rút số dư",
  "device/job.platform/actions/deposit-2/label": "Nạp 700.000 VNĐ để xác minh tài khoản",
  "device/job.platform/actions/do-task-3/label": "Làm việc cấp 3: chấm điểm 8 trang sản phẩm",
  "device/job.platform/actions/try-withdraw-3/label": "Thử rút số dư lần nữa",
  "device/job.platform/actions/deposit-3/label": "Nạp 1.200.000 VNĐ để nộp thuế rút tiền",
  "device/job.platform/actions/deposit-3-borrow/label": "Vay 1.200.000 VNĐ từ ứng dụng cho vay và nạp vào",
  "device/job.platform/actions/try-withdraw-4/label": "Thử rút thêm một lần",
  "device/job.platform/actions/save-records/label": "Chụp màn hình lịch sử nạp tiền, các tin nhắn và địa chỉ trang",
  "device/job.platform/actions/stop/label": "Dừng lại và đóng tài khoản",
  "device/file.company-check/title": "Kết quả tra cứu công ty (đã lưu)",
  "device/file.company-check/body":
    "Không tìm thấy công ty nào đăng ký với tên QuickPay Tasks. Trang không ghi địa chỉ, mã số thuế hay người liên hệ.",
  "device/file.job-records/title": "Hồ sơ nền tảng việc làm (đã lưu)",
  "device/file.job-records/body":
    "Bản lưu hồ sơ nền tảng việc làm: lịch sử nạp tiền, các tin nhắn đòi nạp thêm và địa chỉ trang.",
  "device/msg.job-minimum/title": "QuickPay Tasks",
  "device/msg.job-minimum/from": "QuickPay Tasks",
  "device/msg.job-minimum/body":
    "Mức rút tối thiểu là 500.000 VNĐ. Hãy mở khóa cấp 2 bằng khoản nạp 300.000 VNĐ. Khoản nạp và thu nhập của bạn sẽ được trả lại cùng nhau.",
  "device/msg.job-verify/title": "QuickPay Tasks",
  "device/msg.job-verify/from": "QuickPay Tasks",
  "device/msg.job-verify/body":
    "Số dư của bạn đã đạt mức tối thiểu, nhưng tài khoản phải được xác minh trước khi rút. Hãy nạp 700.000 VNĐ. Khoản này được trả lại sau khi kiểm tra.",
  "device/msg.job-tax/title": "QuickPay Tasks",
  "device/msg.job-tax/from": "QuickPay Tasks",
  "device/msg.job-tax/body": "Phải nộp thuế rút tiền trước. Hãy nạp 1.200.000 VNĐ. Khoản này được trả lại cùng số dư của bạn.",
  "device/msg.job-review/title": "QuickPay Tasks",
  "device/msg.job-review/from": "QuickPay Tasks",
  "device/msg.job-review/body": "Tài khoản của bạn đang được xem xét trong 30 ngày. Việc rút tiền tạm dừng. Đừng đóng trang.",
  "device/msg.job-countdown/title": "QuickPay Tasks",
  "device/msg.job-countdown/from": "QuickPay Tasks",
  "device/msg.job-countdown/body": "Việc cấp 2 sắp đóng. Hãy nạp tiền ngay để giữ phần thưởng và số dư của bạn.",

  // THE GOLDEN PLATFORM
  "device/msg.golden-friend/title": "Hùng",
  "device/msg.golden-friend/from": "Hùng (bạn của anh họ Minh)",
  "device/msg.golden-friend/body":
    "Chào Alex, mình là Hùng. Bạn mình kiếm khoảng 8% mỗi tuần với Golden Platform. Tháng trước mình bỏ tiền vào và đã rút lãi ra rồi. " +
    "Tham gia bằng mã của mình để nhận quà thành viên mới. Trang: golden-platform-invest.com",
  "device/msg.golden-friend/actions/ask-hung/label": "Hỏi Hùng nền tảng có được cấp phép không và lợi nhuận từ đâu ra",
  "device/msg.golden-friend/actions/ask-hung/transcript/0": "Nền tảng có được cấp phép không? Lợi nhuận từ đâu ra vậy?",
  "device/msg.golden-friend/actions/ask-hung/transcript/1":
    "Đừng lo, người quản lý là họ hàng của mình. Lợi nhuận đến từ giao dịch. Nhanh lên nhé, quà thành viên mới hết hạn tối nay.",
  "device/msg.golden-friend/actions/open-link/label": "Mở trang của nền tảng",
  "device/msg.golden-friend/actions/decline/label": "Nói với Hùng cảm ơn nhưng không tham gia",
  "device/msg.golden-friend/actions/decline/transcript/0": "Cảm ơn Hùng, nhưng mình không đầu tư số tiền mình cần để trả tiền nhà.",
  "device/msg.golden-friend/actions/decline/transcript/1": "Tùy bạn. Ưu đãi hết hạn tối nay.",
  "device/contact.authority/title": "Văn phòng Giám sát Tài chính (liên hệ chính thức)",
  "device/contact.authority/detail": "+000 100 0300",
  "device/contact.authority/body": "Đường dây thông tin công khai của cơ quan giám sát tài chính. Số này được in trong ứng dụng của ngân hàng.",
  "device/contact.authority/actions/call/label": "Gọi Văn phòng Giám sát Tài chính",
  "device/contact.authority/actions/call/transcript/0": "Văn phòng Giám sát Tài chính, đường dây thông tin công khai. Tôi có thể giúp gì cho bạn?",
  "device/contact.authority/actions/call/transcript/1": "Xin chào. Một người quen của người quen mời tôi vào một nền tảng đầu tư và tôi muốn kiểm tra.",
  "device/contact.authority/actions/ask-platform/label": "Hỏi Golden Platform có nằm trong danh sách đơn vị được cấp phép không",
  "device/contact.authority/actions/ask-platform/transcript/0": "Golden Platform có trong danh sách đơn vị được cấp phép của cơ quan không? Họ hứa 8% mỗi tuần.",
  "device/contact.authority/actions/ask-platform/transcript/1":
    "Không có đơn vị nào tên đó trong danh sách công khai của chúng tôi. Lợi nhuận cao cố định và không có rủi ro là một dấu hiệu cảnh báo. Đừng chuyển tiền cho đơn vị không có trong danh sách. Bạn có thể báo cho chúng tôi và cho ngân hàng.",
  "device/page.golden/title": "Golden Platform: bảng điều khiển thành viên",
  "device/page.golden/from": "Golden Platform",
  "device/page.golden/detail": "golden-platform-invest.com",
  "device/page.golden/body":
    "Làm tiền của bạn sinh lời mỗi tuần. Tham gia ngay để nhận quà thành viên mới.\n\n" +
    "Đây là trang mô phỏng. Trò chơi không dùng tiền, tài khoản hay khoản đầu tư thật.",
  "device/page.golden/actions/invest/label": "Đầu tư 500.000 VNĐ vào gói khởi đầu",
  "device/page.golden/actions/check-dashboard/label": "Xem bảng điều khiển",
  "device/page.golden/actions/invest-more/label": "Nâng lên gói Vàng với 1.000.000 VNĐ để có lãi suất cao hơn",
  "device/page.golden/actions/withdraw-1/label": "Rút khoản lãi hiển thị trên bảng điều khiển",
  "device/page.golden/actions/pay-fee-1/label": "Trả phí xác minh 150.000 VNĐ",
  "device/page.golden/actions/withdraw-2/label": "Rút lại lần nữa",
  "device/page.golden/actions/pay-fee-2/label": "Nộp thuế rút tiền 300.000 VNĐ",
  "device/page.golden/actions/withdraw-3/label": "Rút thêm một lần",
  "device/page.golden/actions/pay-fee-3/label": "Trả phí mở khóa 600.000 VNĐ",
  "device/page.golden/actions/withdraw-4/label": "Thử rút sau khoản phí cuối",
  "device/page.golden/actions/save-records/label": "Chụp màn hình bảng điều khiển, các tin nhắn đòi phí và địa chỉ trang",
  "device/page.golden/actions/leave/label": "Dừng lại và rời nền tảng",
  "device/file.golden-records/title": "Hồ sơ nền tảng đầu tư (đã lưu)",
  "device/file.golden-records/body":
    "Bản lưu hồ sơ nền tảng đầu tư: bảng điều khiển, các tin nhắn đòi phí trước khi rút và địa chỉ trang.",
  "device/msg.golden-fee-1/title": "Golden Platform",
  "device/msg.golden-fee-1/from": "Golden Platform",
  "device/msg.golden-fee-1/body": "Để rút tiền, phải trả trước phí xác minh 150.000 VNĐ. Khoản này nằm trong số dư của bạn.",
  "device/msg.golden-fee-2/title": "Golden Platform",
  "device/msg.golden-fee-2/from": "Golden Platform",
  "device/msg.golden-fee-2/body": "Lợi nhuận bị đánh thuế trước khi rời nền tảng. Hãy trả 300.000 VNĐ để giải phóng lệnh rút của bạn.",
  "device/msg.golden-fee-3/title": "Golden Platform",
  "device/msg.golden-fee-3/from": "Golden Platform",
  "device/msg.golden-fee-3/body": "Tài khoản của bạn bị gắn cờ vì lệnh rút lớn và đã bị đóng băng. Hãy trả 600.000 VNĐ để mở khóa.",
  "device/msg.golden-frozen/title": "Golden Platform",
  "device/msg.golden-frozen/from": "Golden Platform",
  "device/msg.golden-frozen/body": "Lệnh rút của bạn đang được xem xét. Có thể mất đến 30 ngày. Tiền của bạn vẫn bị khóa trong thời gian đó.",
  "device/msg.golden-profit/title": "Golden Platform",
  "device/msg.golden-profit/from": "Golden Platform",
  "device/msg.golden-profit/body": "Hôm nay lợi nhuận của bạn tăng 3%. Mời bạn bè để nhận thưởng.",

  // Ledger lines, events and missions of the two offers
  "ledger/ledger.job-deposit-1": "Nạp tiền vào nền tảng việc làm online",
  "ledger/ledger.job-deposit-2": "Nạp tiền vào nền tảng việc làm online",
  "ledger/ledger.job-deposit-3": "Nạp tiền vào nền tảng việc làm online",
  "ledger/ledger.invest-1": "Thanh toán cho nền tảng đầu tư",
  "ledger/ledger.invest-2": "Thanh toán cho nền tảng đầu tư",
  "ledger/ledger.invest-fee-1": "Khoản phí do nền tảng đầu tư yêu cầu",
  "ledger/ledger.invest-fee-2": "Khoản phí do nền tảng đầu tư yêu cầu",
  "ledger/ledger.invest-fee-3": "Khoản phí do nền tảng đầu tư yêu cầu",
  "events/m01.job-pressure/title": "Trang việc làm giục bạn",
  "events/m01.job-pressure/body": "Một tin nhắn nói rằng cấp 2 sắp đóng.",
  "events/m01.golden-profit-notice/title": "Nền tảng hiển thị thêm lợi nhuận",
  "events/m01.golden-profit-notice/body": "Một tin nhắn nói rằng lợi nhuận trên bảng điều khiển đã tăng.",
  "missions/m01.easy-money/title": "TIỀN DỄ KIẾM",
  "missions/m01.easy-money/paths/deposited/objective": "Tiền đã rời tài khoản của bạn vì việc này. Số dư trên trang không phải tiền bạn có thể rút.",
  "missions/m01.easy-money/paths/working/objective": "Trang việc làm hiển thị một khoản thưởng nhỏ và đòi nạp tiền để tiếp tục.",
  "missions/m01.easy-money/paths/offer/objective": "Một sinh viên giới thiệu việc online. Bạn có thể hỏi, kiểm tra, thử hoặc từ chối.",
  "missions/m01.golden-platform/title": "NỀN TẢNG VÀNG",
  "missions/m01.golden-platform/paths/locked/objective": "Số tiền bạn đã gửi bị khóa. Mỗi lần rút lại bị đòi thêm một khoản phí.",
  "missions/m01.golden-platform/paths/offer/objective": "Một người quen mời bạn vào nền tảng đầu tư. Bạn có thể hỏi, kiểm tra, tham gia hoặc từ chối.",

  // Events
  "events/m01.transfer-1/title": "Giao dịch trái phép",
  "events/m01.transfer-1/body": "Một khoản tiền rời tài khoản của bạn mà bạn không đồng ý.",
  "events/m01.transfer-2/title": "Giao dịch trái phép",
  "events/m01.transfer-2/body": "Một khoản tiền rời tài khoản của bạn mà bạn không đồng ý.",
  "events/m01.transfer-3/title": "Giao dịch trái phép",
  "events/m01.transfer-3/body": "Một khoản tiền rời tài khoản của bạn mà bạn không đồng ý.",
  "events/m01.takeover/title": "Tài khoản bị chiếm quyền",
  "events/m01.takeover/body": "Có người dùng tài khoản sinh viên của bạn từ một thiết bị khác.",
  "events/m01.access-locked/title": "Tài khoản sinh viên của bạn vẫn đang bị khóa",
  "events/m01.access-locked/body":
    "Tài khoản sinh viên của bạn đã bị chiếm quyền và chưa được khôi phục, nên bạn không thể đăng nhập vào hệ thống nộp bài. Hạn nộp cuối cùng là 17:00 hôm nay.",
  "events/m01.access-locked/responses/recover-now/label": "Khôi phục tài khoản sinh viên ngay bây giờ",
  "events/m01.access-locked/responses/later/label": "Chưa phải lúc này",
  "events/m01.late-access-check/title": "Quyền truy cập nộp bài vẫn chưa được xác minh",
  "events/m01.late-access-check/body":
    "Bạn chưa xác nhận tài khoản nộp luận văn có đang hoạt động. Hạn cuối cùng là hôm nay lúc 17:00.",
  "events/m01.late-access-check/responses/verify-now/label": "Nhờ Phòng Đào tạo xác nhận tài khoản của tôi ngay",
  "events/m01.late-access-check/responses/later/label": "Chưa phải lúc này",

  // Missions
  "missions/m01.missing-access/title": "THE MISSING ACCESS",
  "missions/m01.missing-access/paths/breach/objective": "Trước tiên, bảo vệ các tài khoản. Hoàn thành bản thảo trước 06:00 thứ Tư để kịp hạn nộp 17:00 thứ Sáu.",
  "missions/m01.missing-access/paths/verified/objective": "Đã xác nhận truy cập hệ thống nộp bài. Hoàn thành bản thảo trước 06:00 thứ Tư; nộp bài trước 17:00 thứ Sáu.",
  "missions/m01.missing-access/paths/default/objective": "Hoàn thành bản thảo trước 06:00 thứ Tư và xác nhận bạn đăng nhập được vào hệ thống nộp bài trước 17:00 thứ Sáu.",
  "missions/m01.final-submission/title": "NỘP BÀI CUỐI CÙNG",
  "missions/m01.final-submission/paths/ready/objective": "Bản thảo cuối và tài khoản đã sẵn sàng. Nộp qua cổng đã lưu trước 17:00 thứ Sáu.",
  "missions/m01.final-submission/paths/blocked/objective": "Hoàn thành bản thảo, xác minh quyền truy cập và xử lý khóa tài khoản trước 17:00 thứ Sáu.",
  "missions/m01.final-submission/paths/ready/steps/submit-thesis": "Nộp khóa luận cuối qua cổng đã lưu và giữ biên nhận",
  "missions/m01.final-submission/paths/blocked/steps/submit-thesis": "Nộp khóa luận cuối qua cổng đã lưu và giữ biên nhận",
  "missions/m01.security-breach/title": "SECURITY BREACH",
  "missions/m01.security-breach/paths/code/objective":
    "Báo cáo các giao dịch cho ngân hàng qua đường dây chính thức, rồi bảo vệ các tài khoản.",
  "missions/m01.security-breach/paths/credentials/objective": "Đổi mật khẩu và đăng xuất các thiết bị khác.",
  // Mission steps (the task tracker and the task list)
  "missions/m01.missing-access/paths/default/steps/read-mail": "Đọc email mới về tài khoản nộp bài",
  "missions/m01.missing-access/paths/verified/steps/read-mail": "Đọc email mới về tài khoản nộp bài",
  "missions/m01.missing-access/paths/default/steps/confirm-access": "Xác nhận bạn vào được hệ thống nộp bài",
  "missions/m01.missing-access/paths/breach/steps/passwords": "Đổi mật khẩu và đăng xuất các thiết bị khác",
  "missions/m01.missing-access/paths/default/steps/intro": "Chỉnh sửa phần mở đầu và tổng quan tài liệu",
  "missions/m01.missing-access/paths/default/steps/findings": "Sửa phần kết quả",
  "missions/m01.missing-access/paths/default/steps/final": "Hoàn thành toàn bộ bản thảo",
  "missions/m01.missing-access/paths/verified/steps/intro": "Chỉnh sửa phần mở đầu và tổng quan tài liệu",
  "missions/m01.missing-access/paths/verified/steps/findings": "Sửa phần kết quả",
  "missions/m01.missing-access/paths/verified/steps/final": "Hoàn thành toàn bộ bản thảo",
  "missions/m01.missing-access/paths/breach/steps/intro": "Chỉnh sửa phần mở đầu và tổng quan tài liệu",
  "missions/m01.missing-access/paths/breach/steps/findings": "Sửa phần kết quả",
  "missions/m01.missing-access/paths/breach/steps/final": "Hoàn thành toàn bộ bản thảo",
  "missions/m01.security-breach/paths/code/steps/call-bank": "Gọi ngân hàng qua đường dây chính thức",
  "missions/m01.security-breach/paths/code/steps/passwords": "Đổi mật khẩu và đăng xuất các thiết bị khác",
  "missions/m01.security-breach/paths/credentials/steps/passwords": "Đổi mật khẩu và đăng xuất các thiết bị khác",
  "missions/m01.easy-money/paths/offer/steps/read": "Đọc tin nhắn về công việc online",
  "missions/m01.easy-money/paths/offer/steps/decide": "Quyết định sẽ làm gì với lời mời làm việc",
  "missions/m01.easy-money/paths/working/steps/decide": "Quyết định có tiếp tục công việc hay không",
  "missions/m01.easy-money/paths/deposited/steps/decide": "Quyết định bước tiếp theo với công việc",
  "missions/m01.golden-platform/paths/offer/steps/read": "Đọc lời mời tham gia nền tảng đầu tư",
  "missions/m01.golden-platform/paths/offer/steps/decide": "Quyết định có tham gia nền tảng hay không",
  "missions/m01.golden-platform/paths/locked/steps/decide": "Quyết định sẽ làm gì với số tiền bị khóa",
  // Records saved as evidence (by choice, from the mail, the payment page and the bank statement)
  "device/mail.clearance/actions/save-record/label": "Báo cho bộ phận hỗ trợ IT",
  "device/page.fee/actions/save-address/label": "Báo cáo trang web này",
  "device/bank.statement/title": "Sao kê ngân hàng trực tuyến",
  "device/bank.statement/body": "Sao kê trực tuyến của bạn. Bạn có thể tải biên lai của một khoản thanh toán hoặc sao kê các giao dịch chuyển tiền.",
  "device/bank.statement/actions/save-fee-record/label": "Tải biên lai thanh toán phí xác nhận",
  "device/bank.statement/actions/save-transfer-record/label": "Tải sao kê các giao dịch chuyển tiền trái phép",
  "device/file.email-record/title": "Đã gửi báo cáo: email Graduation Clearance",
  "device/file.email-record/body": "Bạn đã báo cáo email Graduation Clearance cho bộ phận hỗ trợ IT của trường. Báo cáo giữ một bản sao của email: địa chỉ người gửi, khoản phí được yêu cầu và địa chỉ liên kết.",
  "device/msg.bank-code/title": "Thông báo ngân hàng",
  "device/msg.bank-code/from": "Ngân hàng",
  "device/msg.bank-code/body":
    "481206 là mã để duyệt khoản thanh toán thẻ 800.000 VND cho UNI GRADUATION OFFICE. Không chia sẻ mã này với bất kỳ ai. Ngân hàng không bao giờ hỏi bạn mã này.",
  "device/file.address-record/title": "Đã gửi báo cáo: địa chỉ trang thanh toán",
  "device/file.address-record/body": "Bạn đã báo cáo trang thanh toán cho bộ phận hỗ trợ IT của trường. Báo cáo giữ địa chỉ mà email dẫn tới: payment-ueh.vn.",
  "device/file.fee-record/title": "Biên lai: thanh toán phí xác nhận",
  "device/file.fee-record/body": "Biên lai đã tải của khoản thanh toán thẻ trên trang thanh toán: số tiền, thời điểm và người nhận mà ngân hàng hiển thị.",
  "device/file.transfer-record/title": "Sao kê: các giao dịch chuyển tiền trái phép",
  "device/file.transfer-record/body": "Sao kê đã tải của các khoản tiền rời tài khoản mà bạn không đồng ý: số tiền, thời điểm và người nhận mà ngân hàng hiển thị.",
};
