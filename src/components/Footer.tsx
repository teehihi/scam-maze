import { REPO_URL } from "./Header";

export function Footer() {
  return (
    <footer>
      <div className="bg-accent px-5 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Sẵn sàng tìm lối ra khỏi mê cung?</h2>
          <p className="mt-3 max-w-xl text-lg">Dừng lại một nhịp, tách kênh xác minh, không bao giờ đưa OTP cho ai.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#choi-thu" className="bg-ink px-6 py-3 font-semibold text-paper hover:bg-zinc-700">
              Chơi lại kịch bản
            </a>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="border border-ink px-6 py-3 font-semibold hover:bg-ink hover:text-paper"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
      <p className="mx-auto max-w-5xl px-5 py-8 text-sm text-muted">
        SCAMMAZE · Dự án Kiroween 2026 · Chỉ phục vụ mục đích giáo dục. Nếu bạn nghi ngờ bị lừa đảo, hãy liên hệ ngân
        hàng và cơ quan chức năng ngay.
      </p>
    </footer>
  );
}
