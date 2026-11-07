import { Mail, TriangleAlert } from "lucide-react";
import { useParallax } from "../../hooks/useParallax";
import { MazeMotif } from "../art/MazeMotif";
import { WindowFrame } from "../art/WindowFrame";
import { EnterGameButton } from "../ui/GameEntry";

/** Parallax layer: moves a little against scroll. Wrapper only, no animation. */
const layer = (factor: number) => ({ transform: `translate3d(0, calc(var(--py, 0px) * ${factor}), 0)` });

export function Hero() {
  const sceneRef = useParallax<HTMLDivElement>();

  return (
    <section id="top" className="relative isolate overflow-hidden pt-24 sm:pt-28 lg:min-h-[100svh]">
      {/* 1 · Atmosphere */}
      <div aria-hidden="true" className="h-atmosphere pointer-events-none absolute inset-0 -z-10">
        <div className="glow-purple absolute inset-0" />
        <div className="grid-lines absolute inset-0" />
        <MazeMotif className="absolute -right-48 top-1/2 hidden size-[56rem] -translate-y-1/2 text-lavender/[0.09] lg:block" />
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-5 pb-20 sm:px-8 lg:grid-cols-12 lg:gap-6 lg:pb-12">
        {/* Copy */}
        <div className="lg:col-span-6">
          <p className="label flex items-center gap-3 text-lavender">
            <span aria-hidden="true" className="h-px w-8 bg-lavender/60" />
            A digital investigation game · In development
          </p>
          <h1 className="display mt-6 text-[clamp(2.5rem,9.2vw,3.75rem)] sm:text-[clamp(3rem,7vw,4.5rem)] lg:text-[clamp(3rem,4.6vw,4.6rem)]">
            <span className="block">The internet is a maze.</span>
            <span className="mt-2 block text-lavender">Can you find your way out?</span>
          </h1>
          <p className="mt-7 max-w-lg text-base leading-relaxed text-mist sm:text-lg">
            Step into a digital world where every message hides a possibility, every connection deserves a second look,
            and every decision changes the story.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <EnterGameButton />
            <a href="#world" className="btn btn-ghost">
              Explore the world
            </a>
          </div>
          <p className="label mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] text-mist">
            <span>Case 001</span>
            <span aria-hidden="true" className="size-1 bg-hairline" />
            <span>Fictional environment</span>
            <span aria-hidden="true" className="size-1 bg-hairline" />
            <span>No real data</span>
          </p>
        </div>

        {/* Scene: a glimpse into the world. Decorative, described once. */}
        <div className="lg:col-span-6">
          <div
            ref={sceneRef}
            role="img"
            aria-label="Illustration of the game world: an unknown number sends a parcel message with an urgent link, a look-alike website asks for a one-time code, and a new support account joins the conversation. Suspicious signals are linked together."
            className="relative lg:ml-auto lg:h-[540px] lg:w-[600px] lg:origin-right lg:scale-[0.78] xl:scale-100"
          >
            <div className="scene-3d relative flex flex-col gap-4 pl-8 lg:block lg:h-full lg:pl-0">
              {/* Mobile-only vertical thread linking the stack */}
              <div aria-hidden="true" className="absolute bottom-6 left-3 top-6 w-px lg:hidden">
                <div className="h-full w-px bg-gradient-to-b from-lavender/70 via-amber/60 to-lavender/10" />
              </div>

              {/* 4 · Notification */}
              <div className="h-toast order-1 lg:absolute lg:left-0 lg:top-[26px] lg:z-30 lg:w-[270px]" style={layer(-0.06)}>
                <div className="flex items-start gap-3 border border-hairline bg-navy-2 p-3.5 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.7)]">
                  <span className="grid size-8 shrink-0 place-items-center bg-purple text-white">
                    <Mail size={16} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 text-left">
                    <p className="label text-[10px] text-lavender">Mailbox · now</p>
                    <p className="mt-1 text-sm font-semibold leading-snug">Parcel update: action required</p>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-mist">notify@swiftparcel-delivery.invalid</p>
                  </div>
                </div>
              </div>

              {/* 2 + 3 · Messenger shell, then the message */}
              <div className="h-shell order-2 lg:absolute lg:left-0 lg:top-[132px] lg:z-20 lg:w-[290px]" style={layer(0.025)}>
                <WindowFrame title="Messages · Unknown number">
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center border border-hairline font-display font-bold text-mist">?</span>
                      <div>
                        <p className="text-sm font-semibold">Unknown number</p>
                        <p className="label text-[10px] text-mist">Not in contacts</p>
                      </div>
                    </div>
                    <div className="h-message mt-4 border border-hairline bg-navy-2 p-3 text-[13px] leading-relaxed">
                      <p>
                        [SwiftParcel] Order #SP-88213 is on hold. Confirm within <strong className="text-white">30 minutes</strong>{" "}
                        or it will be returned:
                      </p>
                      <p className="mt-2 break-all font-mono text-[12px]">
                        <span className="h-flag-pulse inline-block border-b border-amber bg-amber/10 px-1 text-amber">
                          swiftparcel-verify.test/otp
                        </span>
                      </p>
                      <p className="h-flag label mt-3 flex items-center gap-2 text-[10px] text-amber">
                        <TriangleAlert size={12} aria-hidden="true" />
                        Signal · urgency + unfamiliar link
                      </p>
                    </div>
                    <div className="mt-4 flex h-9 items-center border border-hairline px-3 text-xs text-mist">
                      Reply…
                    </div>
                  </div>
                </WindowFrame>
              </div>

              {/* 5 · Browser */}
              <div className="h-browser order-3 lg:absolute lg:left-[262px] lg:top-[18px] lg:z-10 lg:w-[338px]" style={layer(-0.03)}>
                <WindowFrame title="Browser" accent="bg-amber">
                  <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
                    <div className="min-w-0 flex-1 truncate border border-hairline bg-graphite px-3 py-1.5 font-mono text-[11px] text-ivory">
                      https://swiftparcel-verify.test/otp
                    </div>
                    <span className="h-flag label hidden shrink-0 border border-amber/60 px-2 py-1 text-[9px] text-amber sm:block">
                      Domain ≠ courier
                    </span>
                  </div>
                  <div className="px-6 pb-7 pt-6 text-center">
                    <p className="font-display text-lg font-extrabold tracking-wide">SwiftParcel</p>
                    <p className="mt-2 text-sm text-mist">Verify your identity to keep your order</p>
                    <div className="mt-5 flex justify-center gap-1.5">
                      {Array.from({ length: 6 }, (_, i) => (
                        <span key={i} className="grid size-9 place-items-center border border-hairline bg-graphite font-mono text-sm text-mist">
                          •
                        </span>
                      ))}
                    </div>
                    <p className="label mt-4 text-[10px] text-danger">Time left 04:59</p>
                    <div className="mt-4 bg-purple py-2.5 text-xs font-semibold tracking-widest text-white">CONFIRM</div>
                  </div>
                </WindowFrame>
              </div>

              {/* 7 · Late arrival: a new account joins */}
              <div className="h-profile order-4 lg:absolute lg:left-[322px] lg:top-[372px] lg:z-30 lg:w-[270px]" style={layer(-0.045)}>
                <div className="border border-hairline bg-navy-2 p-4 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.7)]">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center bg-lavender font-display text-lg font-extrabold text-graphite">
                      D
                    </span>
                    <div>
                      <p className="text-sm font-semibold">Dana · “Support agent”</p>
                      <p className="label text-[10px] text-mist">Joined the chat</p>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1.5 text-xs text-mist">
                    <li className="flex items-center gap-2">
                      <span aria-hidden="true" className="size-1.5 bg-amber" />
                      Account created 2 days ago
                    </li>
                    <li className="flex items-center gap-2">
                      <span aria-hidden="true" className="size-1.5 bg-amber" />
                      No mutual contacts
                    </li>
                  </ul>
                </div>
              </div>

              {/* 7 · Investigation connections (desktop composition only) */}
              <svg
                aria-hidden="true"
                focusable="false"
                viewBox="0 0 600 540"
                fill="none"
                className="pointer-events-none absolute inset-0 z-40 hidden h-full w-full lg:block"
              >
                <g stroke="#f2b24b" strokeWidth="1.25" strokeDasharray="1" strokeLinecap="round">
                  <path className="h-line" pathLength={1} style={{ ["--d" as string]: "3.9s" }} d="M292 300 C 334 252, 296 150, 300 86" />
                  <path className="h-line" pathLength={1} style={{ ["--d" as string]: "4.6s" }} d="M292 300 C 300 340, 312 380, 335 394" />
                </g>
                <path className="h-line" pathLength={1} style={{ ["--d" as string]: "4.2s" }} stroke="#b9a5f5" strokeWidth="1.25" d="M124 90 V 132" />
                {[
                  { x: 292, y: 300, d: "3.9s", t: "LINK", tx: 300, ty: 304 },
                  { x: 300, y: 86, d: "4.2s", t: "DOMAIN", tx: 308, ty: 82 },
                  { x: 335, y: 394, d: "4.8s", t: "IDENTITY", tx: 345, ty: 372 },
                ].map((n) => (
                  <g key={n.t} className="h-node" style={{ ["--d" as string]: n.d }}>
                    <circle className="h-ring" style={{ ["--d" as string]: n.d }} cx={n.x} cy={n.y} r="7" stroke="#f2b24b" strokeWidth="1" />
                    <circle cx={n.x} cy={n.y} r="3.5" fill="#f2b24b" />
                    <text x={n.tx} y={n.ty} fill="#f2b24b" fontSize="8.5" letterSpacing="1.4" fontFamily="JetBrains Mono Variable, monospace">
                      {n.t}
                    </text>
                  </g>
                ))}
                <g className="h-node" style={{ ["--d" as string]: "4.2s" }}>
                  <circle cx="124" cy="90" r="3" fill="#b9a5f5" />
                </g>
              </svg>

              {/* System indicators */}
              <p
                aria-hidden="true"
                className="label absolute -top-1 right-0 hidden text-[9px] text-mist lg:block"
              >
                Sim // fictional · signals linked 03
              </p>
            </div>
          </div>
        </div>
      </div>

      <a
        href="#experience"
        className="label absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 text-[10px] text-mist transition-colors hover:text-lavender lg:flex"
      >
        Scroll
        <span aria-hidden="true" className="h-10 w-px bg-gradient-to-b from-lavender to-transparent" />
      </a>
    </section>
  );
}
