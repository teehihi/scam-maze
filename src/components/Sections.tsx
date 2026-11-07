import { Marker, Section } from "./Section";

const traps = [
  { name: "Link lạ", text: "Tin nhắn kèm đường dẫn rút gọn hoặc giả tên thương hiệu." },
  { name: "Trúng thưởng", text: "“Bạn đã trúng quà”, chỉ cần đóng phí hoặc đăng nhập." },
  { name: "Tuyển dụng giả", text: "Việc nhẹ lương cao, yêu cầu đặt cọc hoặc cài app." },
  { name: "Đòi OTP", text: "Mượn cớ xác minh để lấy mã duyệt giao dịch của bạn." },
  { name: "Trang đăng nhập giả", text: "Giao diện y hệt, tên miền sai một ký tự." },
];

export function Problem() {
  return (
    <Section
      id="van-de"
      eyebrow="Vấn đề"
      title="Ai cũng biết “hãy cẩn thận”. Ít ai thấy mình đang bị dẫn dắt."
      intro="Kẻ lừa đảo hiếm khi ra tay một lần. Chúng tạo áp lực, rồi dắt bạn qua nhiều bước nhỏ, mỗi bước nghe hợp lý, cho đến khi quá muộn."
    >
      <ul className="border-t border-line">
        {traps.map((t, i) => (
          <li key={t.name} className="grid gap-1 border-b border-line py-5 sm:grid-cols-[3rem_14rem_1fr] sm:gap-6">
            <span className="font-mono text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="font-semibold">{t.name}</h3>
            <p className="text-muted">{t.text}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const loop = [
  {
    title: "Học tình huống",
    text: "Nhập vai vào kịch bản phân nhánh. Lựa chọn của bạn quyết định bạn đi tiếp, dừng lại hay mắc bẫy.",
  },
  {
    title: "Quan sát tín hiệu",
    text: "Sau mỗi bước, hệ thống chỉ ra red flags kèm bằng chứng (đoạn tin nhắn, tên miền) và cách xác minh độc lập.",
  },
  {
    title: "Áp dụng checklist",
    text: "Dùng cùng bộ quy tắc ở chế độ kiểm tra URL và tình huống đời thực, trước khi bạn bấm, nhập hay chuyển tiền.",
  },
];

export function Loop() {
  return (
    <Section
      id="vong-lap"
      eyebrow="Vòng lặp học"
      title="Không chỉ là quiz. Là một vòng lặp biến thành thói quen."
      intro="Người chơi mang đúng checklist đã luyện trong game sang tình huống thật."
    >
      <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
        {loop.map((s, i) => (
          <li key={s.title} className="border-t-2 border-ink pt-5">
            <span className="font-mono text-sm text-accent-ink">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="mt-2 text-xl font-semibold">{s.title}</h3>
            <p className="mt-2 leading-relaxed text-muted">{s.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

const features = [
  ["Kịch bản phân nhánh", "Engine state machine, kịch bản là JSON được biên tập kỹ, chạy hoàn toàn offline."],
  ["Luật rủi ro xác định", "Heuristics URL/hostname chạy trong trình duyệt, cho kết quả lặp lại được và giải thích được."],
  ["Bằng chứng minh bạch", "Mỗi cảnh báo đi kèm đoạn trích cụ thể, không có điểm số bí ẩn."],
  ["Công cụ biên tập kịch bản", "Người biên tập tạo, kiểm tra và duyệt kịch bản mới khi thủ đoạn thay đổi."],
  ["Phân tích học tập", "Theo dõi tỷ lệ nhận diện tình huống mới qua pre/post test, không chỉ điểm số trong game."],
  ["AI là tuỳ chọn", "Giải thích bằng ngôn ngữ tự nhiên và tạo nháp kịch bản để người duyệt. Tắt AI, mọi thứ vẫn chạy."],
];

export function Features() {
  return (
    <Section id="tinh-nang" eyebrow="Tính năng" title="Những gì có bên trong mê cung">
      <div className="grid gap-x-12 sm:grid-cols-2">
        {features.map(([t, d]) => (
          <article key={t} className="border-t border-line py-6">
            <h3 className="font-semibold">{t}</h3>
            <p className="mt-2 leading-relaxed text-muted">{d}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}

const stack = ["React 19", "TypeScript", "Vite 8", "Tailwind CSS v4", "State machine", "Scenario JSON", "pnpm"];

const kiroItems = [
  { t: "Specs", d: "Mô tả chính xác các state transition của từng kịch bản trước khi viết code." },
  { t: "Steering", d: "Quy tắc cứng: hệ thống không bao giờ khẳng định một URL là “an toàn”." },
  { t: "Hooks", d: "Tự động chạy test cho mọi nhánh kịch bản và test đảm bảo không tải trang nguy hiểm." },
];

export function KiroSection() {
  return (
    <Section
      id="kiro"
      eyebrow="Xây bằng Kiro"
      title="Spec, steering và hooks giữ cho sản phẩm an toàn theo thiết kế"
      intro="Với dự án giáo dục về an toàn, sai sót nhỏ có thể tạo ra niềm tin sai. Kiro giúp biến nguyên tắc thành ràng buộc kiểm chứng được."
    >
      <div className="grid gap-10 md:grid-cols-3 md:gap-8">
        {kiroItems.map((k) => (
          <article key={k.t} className="border-t-2 border-ink pt-5">
            <h3 className="font-mono text-sm font-medium uppercase tracking-widest">{k.t}</h3>
            <p className="mt-3 leading-relaxed text-muted">{k.d}</p>
          </article>
        ))}
      </div>
      <ul className="mt-12 flex flex-wrap gap-2" aria-label="Công nghệ sử dụng">
        {stack.map((s) => (
          <li key={s} className="bg-line px-3 py-1 font-mono text-xs">
            {s}
          </li>
        ))}
      </ul>
    </Section>
  );
}

const risks = [
  { r: "Game gây tự tin quá mức", m: "Luôn nhắc: vượt qua kịch bản không có nghĩa là miễn nhiễm." },
  {
    r: "URL heuristics sai (false positive/negative)",
    m: "Không bao giờ phán “an toàn”; chỉ nêu tín hiệu và khuyên xác minh độc lập.",
  },
  { r: "Kịch bản nhanh lỗi thời", m: "Công cụ biên tập và quy trình duyệt để cập nhật thủ đoạn mới." },
];

export function Risks() {
  return (
    <Section id="rui-ro" eyebrow="Trung thực về rủi ro" title="Chúng tôi tự đặt ra điều kiện để dự án bị coi là thất bại">
      <div className="grid gap-12 lg:grid-cols-2">
        <ul className="border-t border-line">
          {risks.map((x) => (
            <li key={x.r} className="flex gap-4 border-b border-line py-5">
              <Marker className="bg-accent" />
              <div>
                <p className="font-semibold">{x.r}</p>
                <p className="mt-1 text-muted">{x.m}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="bg-ink p-8 text-paper">
          <p className="font-mono text-xs font-medium uppercase tracking-widest text-accent">Kill test</p>
          <p className="mt-4 text-lg leading-relaxed">
            Nếu tỷ lệ nhận diện <strong>tình huống mới</strong> không tăng trong pre/post test, hoặc hệ thống báo
            “an toàn” chỉ vì <strong>thiếu tín hiệu xấu</strong>, chúng tôi coi giả thuyết là sai.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-zinc-300">
            Game giáo dục chống scam đã tồn tại. SCAMMAZE phải chứng minh cải thiện hành vi, không chỉ thêm hình ảnh ma
            quái.
          </p>
        </div>
      </div>
    </Section>
  );
}
