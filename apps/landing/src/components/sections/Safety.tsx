import { CreditCard, Film, Link2, Lock, ToggleLeft } from "lucide-react";
import { Reveal } from "../ui/Reveal";
import { SectionHeading } from "../ui/SectionHeading";

const principles = [
  {
    Icon: Film,
    title: "Fictional by design",
    text: "Scenarios, identities and digital environments are made up. Any resemblance to real people or companies is unintended.",
  },
  {
    Icon: CreditCard,
    title: "No real transactions",
    text: "The game does not need real payments, passwords or credentials. Nothing you do in it touches real money.",
  },
  {
    Icon: Link2,
    title: "Safe simulated links",
    text: "Links in the game use reserved example names such as example.test or example.invalid, which cannot point to a real website.",
  },
  {
    Icon: Lock,
    title: "Privacy-conscious",
    text: "SCAMMAZE aims to ask for as little personal information as possible, and to keep progress on your own device where supported.",
  },
  {
    Icon: ToggleLeft,
    title: "AI is optional",
    text: "The core learning experience is designed to work without AI. If AI features arrive, they are an extra layer you can leave off.",
  },
];

export function Safety() {
  return (
    <section id="safety" aria-labelledby="safety-title" className="relative border-t border-hairline px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto grid max-w-[76rem] grid-cols-1 gap-14 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-28">
            <SectionHeading
              id="safety-title"
              label="08 · Safe by design"
              lines={["A safe world to", "make mistakes in."]}
              intro="Getting it wrong is part of learning. These are the principles the game is being built on."
            />
          </div>
        </div>

        <ul className="lg:col-span-7">
          {principles.map(({ Icon, title, text }, i) => (
            <Reveal as="li" key={title} delay={i * 0.06} className="border-t border-hairline last:border-b">
              <div className="grid grid-cols-[auto_1fr] gap-x-6 py-7 sm:grid-cols-[auto_14rem_1fr] sm:gap-x-8">
                <span className="grid size-11 place-items-center border border-hairline text-lavender">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <h3 className="display self-center text-xl sm:text-2xl">{title}</h3>
                <p className="col-span-2 mt-3 text-sm leading-relaxed text-mist sm:col-span-1 sm:mt-0">{text}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
