import { REPO_URL } from "./Header";

export function Footer() {
  return (
    <footer className="border-t border-white/10 px-5 py-14">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-3xl border border-pumpkin/30 bg-gradient-to-br from-pumpkin/10 to-grape/10 p-8 text-center sm:p-12">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Sẵn sàng tìm lối ra khỏi mê cung?</h2>
          <p className="mx-auto mt-3 max-w-xl text-violet-200/80">
            Dừng lại một nhịp, tách kênh xác minh, không bao giờ đưa OTP cho ai.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a href="#choi-thu" className="rounded-xl bg-pumpkin px-6 py-3 font-semibold text-ink-950 hover:brightness-110">
              Chơi lại kịch bản
            </a>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-xl border border-white/20 px-6 py-3 font-semibold text-white hover:border-slime hover:text-slime"
            >
              GitHub ↗
            </a>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-violet-300/60">
          SCAMMAZE · Dự án Kiroween · Chỉ phục vụ mục đích giáo dục. Nếu bạn nghi ngờ bị lừa đảo, hãy liên hệ ngân hàng
          và cơ quan chức năng ngay.
        </p>
      </div>
    </footer>
  );
}
