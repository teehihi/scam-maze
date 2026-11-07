import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Problem, Loop, Features, KiroSection, Risks } from "./components/Sections";
import { ScenarioDemo } from "./components/ScenarioDemo";
import { UrlChecker } from "./components/UrlChecker";
import { Footer } from "./components/Footer";

export default function App() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Problem />
        <Loop />
        <ScenarioDemo />
        <UrlChecker />
        <Features />
        <KiroSection />
        <Risks />
      </main>
      <Footer />
    </>
  );
}
