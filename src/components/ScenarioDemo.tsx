import { useReducer, useState, type Dispatch } from "react";
import { scenario, START_ID, type Choice, type EndNode, type Outcome, type StepNode } from "../data/scenario";
import { Marker, Section } from "./Section";

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
  safe: { label: "Thoát được trong tình huống này", cls: "bg-green-100 text-green-900" },
  partial: { label: "Thoát hiểm, còn dư chấn", cls: "bg-amber-100 text-amber-900" },
  loss: { label: "Mắc bẫy", cls: "bg-red-100 text-red-900" },
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
      intro="Chọn một nhánh. Hệ thống chỉ ra tín hiệu cảnh báo sau mỗi bước. Thử cả hai nhánh để thấy kết quả khác nhau."
    >
      <div className="mx-auto max-w-3xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-3 sm:px-8">
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={ai}
              onChange={(e) => setAi(e.target.checked)}
              className="size-4 accent-ink"
            />
            AI giải thích <span className="text-muted">(nội dung mẫu)</span>
          </label>
          <button type="button" onClick={() => dispatch({ type: "reset" })} className="text-sm underline underline-offset-4">
            Chơi lại
          </button>
        </div>

        <div className="p-5 sm:p-8">
          {node.kind === "step" ? (
            <StepView node={node} state={state} ai={ai} dispatch={dispatch} />
          ) : (
            <EndView node={node} />
          )}
        </div>

        <p className="border-t border-line px-5 py-3 text-xs text-muted sm:px-8">
          {ai ? "AI bật: có thêm giải thích bằng ngôn ngữ tự nhiên." : "AI tắt: luật cảnh báo và kịch bản vẫn chạy đầy đủ."}{" "}
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
      <p className="font-mono text-xs uppercase tracking-widest text-muted">{node.channel}</p>
      <h3 className="mt-2 text-2xl font-bold">{node.title}</h3>
      <blockquote className="mt-4 border-l-4 border-accent bg-paper p-4 font-mono text-sm leading-relaxed">
        {node.body}
      </blockquote>

      {!pending ? (
        <div className="mt-6 grid gap-2" role="group" aria-label="Lựa chọn của bạn">
          {node.choices.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => dispatch({ type: "choose", choice: c })}
              className="border border-ink px-5 py-4 text-left font-medium hover:bg-ink hover:text-paper"
            >
              {c.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-6" aria-live="polite">
          <p className="text-sm text-muted">Bạn đã chọn</p>
          <p className="font-medium">{pending.label}</p>

          <h4 className="mt-6 font-mono text-xs font-medium uppercase tracking-widest text-red-800">Tín hiệu cảnh báo</h4>
          <ul className="mt-2 space-y-1">
            {pending.flags.map((f) => (
              <li key={f} className="flex gap-3 bg-red-50 px-4 py-2.5 text-sm text-red-950">
                <Marker className="bg-red-700" />
                {f}
              </li>
            ))}
          </ul>

          <h4 className="mt-6 font-mono text-xs font-medium uppercase tracking-widest text-green-800">
            Cách xác minh độc lập
          </h4>
          <p className="mt-2 flex gap-3 bg-green-50 px-4 py-2.5 text-sm text-green-950">
            <Marker className="bg-green-700" />
            {pending.verify}
          </p>

          {ai && (
            <p className="mt-4 bg-paper px-4 py-3 text-sm">
              <span className="font-semibold">AI giải thích (mẫu): </span>
              {pending.aiNote}
            </p>
          )}

          <button
            type="button"
            onClick={() => dispatch({ type: "continue" })}
            className="mt-6 bg-ink px-5 py-2.5 font-semibold text-paper hover:bg-accent-ink"
          >
            Tiếp tục
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
      <span className={`inline-block px-3 py-1 font-mono text-xs font-medium ${o.cls}`}>{o.label}</span>
      <h3 className="mt-3 text-2xl font-bold">{node.title}</h3>
      <p className="mt-2 leading-relaxed text-muted">{node.body}</p>
      <h4 className="mt-6 font-mono text-xs font-medium uppercase tracking-widest">Checklist mang theo</h4>
      <ol className="mt-2 border-t border-line">
        {node.checklist.map((c, i) => (
          <li key={c} className="flex gap-4 border-b border-line py-3 text-sm">
            <span className="font-mono text-accent-ink">{i + 1}</span>
            {c}
          </li>
        ))}
      </ol>
      <p className="mt-6 text-sm text-muted">
        Tiếp theo: thử{" "}
        <a href="#kiem-tra-url" className="text-ink underline underline-offset-4">
          chế độ kiểm tra URL
        </a>{" "}
        với cùng quy tắc.
      </p>
    </div>
  );
}
