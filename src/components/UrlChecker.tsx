import { useMemo, useState } from "react";
import { analyzeUrl, type RiskLevel } from "../lib/urlCheck";
import { Section } from "./Section";

const examples = [
  "http://ghn-xacminh.top/otp",
  "https://shopee.vn.giao-hang-nhanh.xyz/login",
  "https://www.vietcombank.com.vn/",
];

const verdict: Record<Exclude<RiskLevel, "invalid">, { title: string; cls: string; note: string }> = {
  high: {
    title: "Nhiều tín hiệu rủi ro cao",
    cls: "border-blood/50 bg-blood/10 text-blood",
    note: "Không bấm, không nhập thông tin. Xác minh qua kênh chính thức bạn tự mở.",
  },
  medium: {
    title: "Có tín hiệu đáng ngờ",
    cls: "border-pumpkin/50 bg-pumpkin/10 text-pumpkin",
    note: "Hãy xác minh độc lập trước khi tiếp tục.",
  },
  "none-found": {
    title: "Chưa phát hiện tín hiệu xấu nào",
    cls: "border-violet-300/40 bg-violet-300/10 text-violet-200",
    note: "Điều này KHÔNG có nghĩa là an toàn. Công cụ chỉ phân tích chuỗi ký tự, không biết nội dung trang. Vẫn xác minh qua kênh chính thức.",
  },
};

export function UrlChecker() {
  const [value, setValue] = useState("");
  const result = useMemo(() => analyzeUrl(value), [value]);
  const hasInput = value.trim().length > 0;

  return (
    <Section
      id="kiem-tra-url"
      eyebrow="Chế độ đời thực"
      title="Mang checklist sang kiểm tra URL"
      intro="Phân tích hoàn toàn trong trình duyệt bằng luật xác định. Link bạn nhập không bao giờ được tải hay gửi đi đâu."
    >
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-ink-900/80 p-5 sm:p-8">
        <label htmlFor="url-input" className="text-sm font-medium text-violet-200">
          Dán một URL để xem tín hiệu
        </label>
        <input
          id="url-input"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="ví dụ: http://ghn-xacminh.top/otp"
          className="mt-2 w-full rounded-xl border border-white/15 bg-ink-800 px-4 py-3 font-mono text-sm text-white placeholder:text-violet-300/40 focus:border-pumpkin focus:outline-none"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setValue(ex)}
              className="rounded-full border border-white/10 px-3 py-1 font-mono text-xs text-violet-200 transition hover:border-grape"
            >
              {ex}
            </button>
          ))}
        </div>

        <div className="mt-6" aria-live="polite">
          {hasInput && result.level === "invalid" && (
            <p className="rounded-xl bg-ink-800 px-4 py-3 text-sm text-violet-200">
              Không nhận dạng được URL hợp lệ (http/https).
            </p>
          )}

          {result.level !== "invalid" && (
            <div>
              <div className={`rounded-xl border px-4 py-3 ${verdict[result.level].cls}`}>
                <p className="font-semibold">{verdict[result.level].title}</p>
                <p className="mt-1 text-sm opacity-90">{verdict[result.level].note}</p>
              </div>

              <p className="mt-4 font-mono text-xs text-violet-300/70">
                Tên miền gốc: <span className="text-white">{result.registrableDomain}</span>
              </p>

              {result.signals.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {result.signals.map((s) => (
                    <li key={s.id} className="rounded-lg bg-ink-800 px-4 py-2 text-sm">
                      <span className="text-white">🚩 {s.label}</span>
                      <span className="mt-0.5 block font-mono text-xs text-violet-300/70">{s.evidence}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}
