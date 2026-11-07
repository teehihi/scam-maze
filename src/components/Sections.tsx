import { Section } from "./Section";

const traps = [
  { icon: "🔗", name: "Link lạ", text: "Tin nhắn kèm đường dẫn rút gọn hoặc giả tên thương hiệu." },
  { icon: "🎁", name: "Trúng thưởng", text: "“Bạn đã trúng quà” — chỉ cần đóng phí hoặc đăng nhập." },
  { icon: "💼", name: "Tuyển dụng giả", text: "Việc nhẹ lương cao, yêu cầu đặt cọc hoặc cài app." },
  { icon: "🔐", name: "Đòi OTP", text: "Mượn cớ xác minh để lấy mã duyệt giao dịch của bạn." },
  { icon: "🪞", name: "Trang đăng nhập giả", text: "Giao diện y hệt, tên miền sai một ký tự." },
];

export function Problem() {
  return (
    <Section
      id="van-de"
      eyebrow="Vấn đề"
      title="Ai cũng biết “hãy cẩn thận”. Nhưng ít ai thấy mình đang bị dẫn dắt."
      intro="Kẻ lừa đảo hiếm khi ra tay một lần. Chúng tạo áp lực, rồi dắt bạn qua nhiều bước nhỏ — mỗi bước nghe hợp lý, cho đến khi quá muộn."
    >
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {traps.map((t) => (
          <li key={t.name} className="rounded-2xl border border-white/10 bg-ink-900/70 p-5">
            <div className="text-3xl" aria-hidden="true">{t.icon}</div>
            <h3 className="mt-3 font-semibold text-white">{t.name}</h3>
            <p className="mt-1 text-sm leading-relaxed text-violet-200/70">{t.text}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const loop = [
  {
    n: "01",
    title: "Học tình huống",
    text: "Nhập vai vào kịch bản phân nhánh. Lựa chọn của bạn quyết định bạn đi tiếp, dừng lại hay mắc bẫy.",
  },
  {
    n: "02",
    title: "Quan sát tín hiệu",
    text: "Sau mỗi bước, hệ thống chỉ ra red flags kèm bằng chứng (đoạn tin nhắn, tên miền) và cách xác minh độc lập.",
  },
  {
    n: "03",
    title: "Áp dụng checklist",
    text: "Dùng cùng bộ quy tắc ở chế độ kiểm tra URL/tình huống đời thực, trước khi bạn bấm, nhập hay chuyển tiền.",
  },
];

export function Loop() {
  return (
    <Section
      id="vong-lap"
      eyebrow="Vòng lặp học"
      title="Không chỉ là quiz. Là một vòng lặp biến thành thói quen."
      intro="Điểm khác biệt của SCAMMAZE: người chơi mang đúng checklist đã luyện trong game sang tình huống thật."
    >
      <ol className="grid gap-5 md:grid-cols-3">
        {loop.map((s) => (
          <li
            key={s.n}
            className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-ink-800 to-ink-900 p-7"
          >
            <span className="font-mono text-5xl font-bold text-grape/40">{s.n}</span>
            <h3 className="mt-4 text-xl font-semibold text-white">{s.title}</h3>
            <p className="mt-2 leading-relaxed text-violet-200/75">{s.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

const features = [
  ["Kịch bản phân nhánh", "Engine state machine, kịch bản là JSON được biên tập kỹ — chạy hoàn toàn offline."],
  ["Luật rủi ro xác định", "Heuristics URL/hostname chạy trong trình duyệt, cho kết quả lặp lại được và giải thích được."],
  ["Bằng chứng minh bạch", "Mỗi cảnh báo đi kèm đoạn trích cụ thể — không có điểm số bí ẩn."],
  ["Công cụ biên tập kịch bản", "Người biên tập tạo, kiểm tra và duyệt kịch bản mới khi thủ đoạn thay đổi."],
  ["Phân tích học tập", "Theo dõi tỷ lệ nhận diện tình huống mới qua pre/post test, không chỉ điểm số trong game."],
  ["AI là tuỳ chọn", "Giải thích ngôn ngữ tự nhiên và tạo nháp kịch bản để người duyệt. Tắt AI, mọi thứ vẫn chạy."],
];

export function Features() {
  return (
    <Section id="tinh-nang" eyebrow="Tính năng" title="Những gì có bên trong mê cung">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(([t, d]) => (
          <article key={t} className="rounded-2xl border border-white/10 bg-ink-900/70 p-6 transition hover:border-pumpkin/50">
            <h3 className="font-semibold text-white">{t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-violet-200/70">{d}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}

const stack = ["React 19", "TypeScript", "Vite 8", "Tailwind CSS v4", "State machine (XState)", "Scenario JSON", "pnpm"];

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
      <div className="grid gap-5 md:grid-cols-3">
        {kiroItems.map((k) => (
          <article key={k.t} className="rounded-2xl border border-grape/30 bg-grape/5 p-6">
            <h3 className="font-mono text-sm uppercase tracking-widest text-grape">{k.t}</h3>
            <p className="mt-3 leading-relaxed text-violet-100/85">{k.d}</p>
          </article>
        ))}
      </div>
      <ul className="mt-10 flex flex-wrap gap-2" aria-label="Công nghệ sử dụng">
        {stack.map((s) => (
          <li key={s} className="rounded-full border border-white/10 bg-ink-800 px-4 py-1.5 font-mono text-xs text-violet-200">
            {s}
          </li>
        ))}
      </ul>
    </Section>
  );
}

const risks = [
  { r: "Game gây tự tin quá mức", m: "Luôn nhắc: vượt qua kịch bản không có nghĩa là miễn nhiễm." },
  { r: "URL heuristics sai (false positive/negative)", m: "Không bao giờ phán “an toàn”; chỉ nêu tín hiệu và khuyên xác minh độc lập." },
  { r: "Kịch bản nhanh lỗi thời", m: "Công cụ biên tập + quy trình duyệt để cập nhật thủ đoạn mới." },
];

export function Risks() {
  return (
    <Section
      id="rui-ro"
      eyebrow="Trung thực về rủi ro"
      title="Chúng tôi tự đặt ra điều kiện để dự án bị coi là thất bại"
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <ul className="space-y-4">
          {risks.map((x) => (
            <li key={x.r} className="rounded-2xl border border-white/10 bg-ink-900/70 p-5">
              <p className="font-semibold text-white">⚠ {x.r}</p>
              <p className="mt-1 text-sm text-violet-200/70">{x.m}</p>
            </li>
          ))}
        </ul>
        <div className="rounded-2xl border border-blood/40 bg-blood/5 p-7">
          <p className="font-mono text-xs uppercase tracking-widest text-blood">Kill test</p>
          <p className="mt-3 text-lg leading-relaxed text-white">
            Nếu tỷ lệ nhận diện <strong>tình huống mới</strong> không tăng trong pre/post test, hoặc hệ thống báo
            “an toàn” chỉ vì <strong>thiếu tín hiệu xấu</strong>, chúng tôi coi giả thuyết là sai.
          </p>
          <p className="mt-4 text-sm text-violet-200/70">
            Game giáo dục chống scam đã tồn tại. SCAMMAZE phải chứng minh cải thiện hành vi, không chỉ thêm hình ảnh ma quái.
          </p>
        </div>
      </div>
    </Section>
  );
}
