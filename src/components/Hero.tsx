import { REPO_URL } from "./Header";

const stats = [
  { k: "3 bước", v: "Tình huống → Tín hiệu → Checklist" },
  { k: "100%", v: "Phần lõi chạy offline, không cần AI" },
  { k: "0", v: "Link độc hại thật được tải" },
];

export function Hero() {
  return (
    <section id="top" className="px-5 pb-20 pt-20 sm:pt-28">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-medium text-accent-ink">Dự án tham dự Kiroween 2026</p>

        <h1 className="mt-4 max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          Thoát khỏi <span className="bg-accent px-1.5">mê cung</span> lừa đảo trước khi bị dẫn vào ngõ cụt.
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          SCAMMAZE luyện nhận diện bẫy Internet bằng tình huống tương tác. Mỗi lựa chọn đổi kịch bản, mỗi bước chỉ
          ra tín hiệu cảnh báo, rồi bạn mang cùng checklist đó ra đời thực.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <a href="#choi-thu" className="bg-ink px-6 py-3 font-semibold text-paper hover:bg-accent-ink">
            Chơi thử kịch bản
          </a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="border border-ink px-6 py-3 font-semibold hover:bg-ink hover:text-paper"
          >
            Xem mã nguồn
          </a>
        </div>

        <dl className="mt-20 grid border-t border-line sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.k} className="border-b border-line py-6 sm:border-b-0 sm:pr-6">
              <dt className="text-3xl font-bold">{s.k}</dt>
              <dd className="mt-1 text-sm text-muted">{s.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
