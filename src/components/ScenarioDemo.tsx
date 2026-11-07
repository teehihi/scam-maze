import { useReducer, useState, type Dispatch } from "react";
import { scenario, START_ID, type Choice, type EndNode, type Outcome, type StepNode } from "../data/scenario";
import { Section } from "./Section";

interface State {
  nodeId: string;
  /** Lựa chọn vừa thực hiện — dùng để hiển thị phản hồi trước khi sang bước kế tiếp. */
  pending: Choice | null;
  trail: string[];
}

type Action = { type: "choose"; choice: Choice } | { type: "continue" } | { type: "reset" };

const initial: State = { nodeId: START_ID, pending: null, trail: [] };

/** State machine thuần: (state, action) → state, dễ kiểm thử mọi nhánh. */
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "choose":
      if (state.pending) return state;
      return { ...state, pending: action.choice, trail: [...state.trail, action.choice.id] };
    case "continue":
      if (!state.pending) return state;
      return { ...state, nodeId: state.pending.next, pending: null };
    case "reset":
      return initial;
  }
}

const outcomeStyle: Record<Outcome, { label: string; cls: string }> = {
  safe: { label: "An toàn trong tình huống này", cls: "border-slime/50 bg-slime/10 text-slime" },
  partial: { label: "Thoát hiểm, còn dư chấn", cls: "border-pumpkin/50 bg-pumpkin/10 text-pumpkin" },
  loss: { label: "Mắc bẫy", cls: "border-blood/50 bg-blood/10 text-blood" },
};

export function ScenarioDemo() {
  const [state, dispatch] = useReducer(reducer, initial);
  const [ai, setAi] = useState(false);
  const node = scenario[state.nodeId];

  return (
    <Section
      id="choi-thu"
      eyebrow="Chơi thử"
      title="Kịch bản: “Đơn hàng bị giữ, hãy nhập OTP”"
      intro="Chọn một nhánh. Hệ thống sẽ chỉ ra tín hiệu cảnh báo sau mỗi bước. Hãy thử cả hai nhánh để thấy kết quả khác nhau."
    >
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-ink-900/80 p-5 shadow-2xl shadow-grape/10 sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <label className="flex cursor-pointer items-center gap-3 text-sm text-violet-200">
            <input
              type="checkbox"
              checked={ai}
              onChange={(e) => setAi(e.target.checked)}
              className="size-4 accent-grape"
            />
            Bật “AI giải thích” <span className="text-violet-300/50">(nội dung mẫu)</span>
          </label>
          <button
            type="button"
            onClick={() => dispatch({ type: "reset" })}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-violet-200 transition hover:border-white/40"
          >
            Chơi lại
          </button>
        </div>

        {node.kind === "step" ? (
          <StepView node={node} state={state} ai={ai} dispatch={dispatch} />
        ) : (
          <EndView node={node} />
        )}

        <p className="mt-6 border-t border-white/10 pt-4 text-xs text-violet-300/60">
          {ai
            ? "AI bật: có thêm giải thích ngôn ngữ tự nhiên."
            : "AI tắt: luật cảnh báo và kịch bản vẫn chạy đầy đủ."}{" "}
          Mọi tên miền trong demo là giả lập và không bao giờ được truy cập.
        </p>
      </div>
    </Section>
  );
}

function StepView({
  node,
  state,
  ai,
  dispatch,
}: {
  node: StepNode;
  state: State;
  ai: boolean;
  dispatch: Dispatch<Action>;
}) {
  const { pending } = state;
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-grape">{node.channel}</p>
      <h3 className="mt-2 text-2xl font-bold text-white">{node.title}</h3>
      <blockquote className="mt-4 rounded-xl border-l-4 border-pumpkin bg-ink-800 p-4 font-mono text-sm leading-relaxed text-violet-100">
        {node.body}
      </blockquote>

      {!pending ? (
        <div className="mt-6 grid gap-3" role="group" aria-label="Lựa chọn của bạn">
          {node.choices.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => dispatch({ type: "choose", choice: c })}
              className="rounded-xl border border-white/15 bg-ink-800 px-5 py-4 text-left font-medium text-white transition hover:border-pumpkin hover:bg-ink-700"
            >
              {c.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-6" aria-live="polite">
          <p className="text-sm text-violet-300/70">Bạn đã chọn:</p>
          <p className="font-medium text-white">{pending.label}</p>

          <h4 className="mt-5 font-mono text-xs uppercase tracking-widest text-blood">Tín hiệu cảnh báo</h4>
          <ul className="mt-2 space-y-2">
            {pending.flags.map((f) => (
              <li key={f} className="rounded-lg bg-blood/10 px-4 py-2 text-sm text-red-100">
                🚩 {f}
              </li>
            ))}
          </ul>

          <h4 className="mt-5 font-mono text-xs uppercase tracking-widest text-slime">Cách xác minh độc lập</h4>
          <p className="mt-2 rounded-lg bg-slime/10 px-4 py-2 text-sm text-lime-100">✅ {pending.verify}</p>

          {ai && (
            <p className="mt-4 rounded-lg border border-grape/40 bg-grape/10 px-4 py-3 text-sm text-violet-100">
              <span className="font-semibold text-grape">AI giải thích (mẫu): </span>
              {pending.aiNote}
            </p>
          )}

          <button
            type="button"
            onClick={() => dispatch({ type: "continue" })}
            className="mt-6 rounded-xl bg-pumpkin px-5 py-2.5 font-semibold text-ink-950 transition hover:brightness-110"
          >
            Tiếp tục →
          </button>
        </div>
      )}
    </div>
  );
}

function EndView({ node }: { node: EndNode }) {
  const o = outcomeStyle[node.outcome];
  return (
    <div aria-live="polite">
      <span className={`inline-block rounded-full border px-3 py-1 font-mono text-xs ${o.cls}`}>{o.label}</span>
      <h3 className="mt-3 text-2xl font-bold text-white">{node.title}</h3>
      <p className="mt-2 leading-relaxed text-violet-100/85">{node.body}</p>
      <h4 className="mt-6 font-mono text-xs uppercase tracking-widest text-slime">Checklist mang theo</h4>
      <ul className="mt-2 space-y-2">
        {node.checklist.map((c) => (
          <li key={c} className="rounded-lg bg-ink-800 px-4 py-2 text-sm text-violet-100">
            ☑ {c}
          </li>
        ))}
      </ul>
      <p className="mt-5 text-sm text-violet-200/70">
        Tiếp theo: thử <a href="#kiem-tra-url" className="text-pumpkin underline underline-offset-4">chế độ kiểm tra URL</a> với cùng quy tắc.
      </p>
    </div>
  );
}
