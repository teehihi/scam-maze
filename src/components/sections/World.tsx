import type { ReactNode } from "react";
import { Link2 } from "lucide-react";
import { Reveal } from "../ui/Reveal";
import { SectionHeading } from "../ui/SectionHeading";

interface EnvProps {
  index: string;
  name: string;
  text: string;
  signal: string;
  linksTo: string[];
  className?: string;
  delay?: number;
  tone: "dark" | "paper";
  children: ReactNode;
}

function Environment({ index, name, text, signal, linksTo, className = "", delay = 0, tone, children }: EnvProps) {
  const paper = tone === "paper";
  return (
    <Reveal as="article" delay={delay} className={className}>
      <div
        className={`group relative flex h-full flex-col overflow-hidden border p-6 transition-colors duration-500 sm:p-8 ${
          paper
            ? "border-lilac/40 bg-lilac text-graphite hover:border-white"
            : "border-hairline bg-navy hover:border-lavender/70"
        }`}
      >
        <p className={`label ${paper ? "text-purple" : "text-lavender"}`}>
          Environment {index}
        </p>
        <h3 className="display mt-3 text-3xl sm:text-4xl">{name}</h3>
        <p className={`mt-3 max-w-sm text-sm leading-relaxed ${paper ? "text-graphite/80" : "text-mist"}`}>{text}</p>

        <div className="my-7 flex-1 transition-transform duration-700 [transition-timing-function:var(--ease-out-expo)] group-hover:-translate-y-1.5 group-hover:scale-[1.015]">
          {children}
        </div>

        <p
          className={`label flex items-center gap-2 border px-2.5 py-1.5 text-[10px] transition-colors duration-300 ${
            paper
              ? "border-graphite/30 text-graphite group-hover:bg-graphite group-hover:text-amber"
              : "border-amber/40 text-amber group-hover:bg-amber/10"
          } w-fit`}
        >
          <span aria-hidden="true" className="size-1.5 bg-amber" />
          {signal}
        </p>

        <p className={`label mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] ${paper ? "text-graphite/70" : "text-mist"}`}>
          <Link2 size={12} aria-hidden="true" />
          <span className="sr-only">Connects to:</span>
          {linksTo.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </p>
      </div>
    </Reveal>
  );
}

export function World() {
  return (
    <section id="world" aria-labelledby="world-title" className="relative border-t border-hairline px-5 py-24 sm:px-8 sm:py-32">
      <div aria-hidden="true" className="glow-purple pointer-events-none absolute inset-x-0 top-0 h-[40rem] opacity-60" />
      <div className="relative mx-auto max-w-[76rem]">
        <SectionHeading
          id="world-title"
          label="02 · The world"
          lines={["A world behind", "your screen."]}
          intro="Five fictional digital environments, linked together. A clue in one place can change what you believe in another."
        />

        <div className="mt-16 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
          {/* Messages */}
          <Environment
            index="01"
            name="Messages"
            text="Personal conversations, unexpected requests, and suspicious messages."
            signal="Signal · new contact, urgent ask"
            linksTo={["Browser", "Social network"]}
            className="lg:col-span-5"
            tone="dark"
          >
            <div className="space-y-2.5 text-[13px]">
              <div className="max-w-[80%] border border-hairline bg-navy-2 p-3">Hey, it’s me. New number, lost my phone.</div>
              <div className="ml-auto max-w-[70%] bg-purple p-3 text-white">Who is this?</div>
              <div className="max-w-[88%] border border-hairline bg-navy-2 p-3">
                Can you help me with something quickly? <span className="text-lavender">I’ll explain later.</span>
              </div>
            </div>
          </Environment>

          {/* Browser */}
          <Environment
            index="02"
            name="Browser"
            text="Websites, links, forms, and hidden inconsistencies."
            signal="Signal · look-alike address"
            linksTo={["Messages", "Mailbox", "Marketplace"]}
            delay={0.1}
            className="lg:col-span-7"
            tone="dark"
          >
            <div className="border border-hairline bg-graphite">
              <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
                <span aria-hidden="true" className="size-2 bg-hairline" />
                <span aria-hidden="true" className="size-2 bg-hairline" />
                <div className="flex-1 truncate bg-navy px-3 py-1.5 font-mono text-[11px]">
                  https://account-<span className="text-amber">update</span>-center.test/sign-in
                </div>
              </div>
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <div>
                  <div className="h-3 w-2/3 bg-ivory/80" />
                  <div className="mt-3 h-2 w-full bg-hairline" />
                  <div className="mt-2 h-2 w-4/5 bg-hairline" />
                </div>
                <div className="space-y-2">
                  <div className="h-8 border border-hairline px-3 text-xs leading-8 text-mist">Account email</div>
                  <div className="h-8 border border-hairline px-3 text-xs leading-8 text-mist">One-time code</div>
                  <div className="h-8 bg-purple" />
                </div>
              </div>
            </div>
          </Environment>

          {/* Mailbox: light surface, to read as a different place */}
          <Environment
            index="03"
            name="Mailbox"
            text="Emails, notifications, attachments, and unfamiliar senders."
            signal="Signal · unexpected attachment"
            linksTo={["Browser", "Messages"]}
            className="lg:col-span-5"
            tone="paper"
          >
            <ul className="divide-y divide-graphite/15 border border-graphite/20 bg-white/60 text-xs">
              {[
                ["Billing team", "Invoice attached — review today", true],
                ["Newsletter", "Your weekly digest", false],
                ["Account notice", "Unusual sign-in detected", true],
              ].map(([from, subject, flag]) => (
                <li key={String(from)} className="flex items-center gap-3 px-3 py-2.5">
                  <span aria-hidden="true" className={`size-2 shrink-0 ${flag ? "bg-purple" : "bg-graphite/20"}`} />
                  <span className="w-24 shrink-0 truncate font-semibold">{from}</span>
                  <span className="truncate text-graphite/80">{subject}</span>
                </li>
              ))}
            </ul>
          </Environment>

          {/* Social network */}
          <Environment
            index="04"
            name="Social Network"
            text="Profiles, identities, relationships, and unusual account activity."
            signal="Signal · account is 2 days old"
            linksTo={["Messages", "Marketplace"]}
            delay={0.1}
            className="lg:col-span-3 lg:-mt-12"
            tone="dark"
          >
            <div className="text-center">
              <span className="mx-auto grid size-14 place-items-center bg-lavender font-display text-xl font-extrabold text-graphite">
                D
              </span>
              <p className="mt-3 text-sm font-semibold">Dana Reyes</p>
              <p className="label mt-1 text-[10px] text-mist">Joined 2 days ago</p>
              <div aria-hidden="true" className="mt-4 flex justify-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-5 border border-hairline bg-navy-2" />
                ))}
              </div>
            </div>
          </Environment>

          {/* Marketplace */}
          <Environment
            index="05"
            name="Marketplace"
            text="Sellers, product listings, negotiations, and payment interactions."
            signal="Signal · pay outside the platform"
            linksTo={["Social network", "Browser"]}
            delay={0.2}
            className="lg:col-span-4 lg:mt-10"
            tone="dark"
          >
            <div className="flex gap-4 border border-hairline bg-graphite p-3">
              <div
                aria-hidden="true"
                className="relative size-24 shrink-0 overflow-hidden bg-gradient-to-br from-purple to-navy-2"
              >
                <div className="absolute bottom-0 left-3 h-12 w-8 bg-lavender/70" />
                <div className="absolute bottom-0 right-3 h-8 w-10 bg-lilac/60" />
              </div>
              <div className="min-w-0 text-xs">
                <p className="label text-[10px] text-mist">Listing</p>
                <p className="mt-1 text-sm font-semibold">Camera body, barely used</p>
                <p className="mt-1 text-mist">Seller: Kei_deals</p>
                <p className="mt-2 inline-block border border-hairline px-2 py-1 font-mono text-[10px] text-lavender">
                  “Pay me directly, it’s faster”
                </p>
              </div>
            </div>
          </Environment>
        </div>

        <p className="label mt-8 text-[10px] text-mist">
          Concept previews of planned environments. Names and accounts are fictional. Not playable yet.
        </p>
      </div>
    </section>
  );
}
