import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Branching } from "./components/sections/Branching";
import { Connects } from "./components/sections/Connects";
import { FinalCta } from "./components/sections/FinalCta";
import { Hero } from "./components/sections/Hero";
import { Investigation } from "./components/sections/Investigation";
import { Missions } from "./components/sections/Missions";
import { Safety } from "./components/sections/Safety";
import { Skills } from "./components/sections/Skills";
import { Systems } from "./components/sections/Systems";
import { World } from "./components/sections/World";
import { GameEntryProvider } from "./components/ui/GameEntry";

/**
 * Marketing site only. The game itself is a separate application, reached
 * through the single entry config in src/config/site.ts.
 */
export default function App() {
  return (
    <GameEntryProvider>
      <Header />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero />
        <Connects />
        <World />
        <Investigation />
        <Branching />
        <Systems />
        <Missions />
        <Skills />
        <Safety />
        <FinalCta />
      </main>
      <Footer />
    </GameEntryProvider>
  );
}
