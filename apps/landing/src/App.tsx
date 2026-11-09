import { useEffect, useState } from "react";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { HangingHalloween } from "./components/ui/HangingHalloween";
import { Hero } from "./components/sections/Hero";
import { WorldOfScams } from "./components/sections/WorldOfScams";
import { InvestigateAndUncover } from "./components/sections/InvestigateAndUncover";
import { FinalCallToAction } from "./components/sections/FinalCallToAction";
import { BottomAlert } from "./components/ui/BottomAlert";
import { GameEntryProvider } from "./components/ui/GameEntry";
import { InfoPage, INFO_PAGE_IDS, type InfoPageId } from "./components/pages/InfoPage";

/**
 * SCAMMAZE Main Application
 * Supports full-page routes for Knowledge Hub / Legal & Documentation pages (#docs, #privacy, etc.)
 * as well as the 4-section interactive landing page.
 */
export default function App() {
  const [activeInfoPage, setActiveInfoPage] = useState<InfoPageId | null>(() => {
    const hash = window.location.hash.replace(/^#/, "");
    return INFO_PAGE_IDS.has(hash) ? (hash as InfoPageId) : null;
  });

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (INFO_PAGE_IDS.has(hash)) {
        setActiveInfoPage((prev) => {
          // Only scroll to top if transitioning from landing page into an InfoPage
          if (!prev) {
            window.scrollTo({ top: 0, behavior: "instant" });
          }
          return hash as InfoPageId;
        });
      } else {
        setActiveInfoPage(null);
      }
    };
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  // When on an informational / legal / docs page, render full page layout
  if (activeInfoPage) {
    return (
      <GameEntryProvider>
        <Header />
        <main id="main" tabIndex={-1} className="outline-none">
          <InfoPage
            pageId={activeInfoPage}
            onSelectPage={(id) => {
              window.location.hash = `#${id}`;
            }}
            onBackToHome={() => {
              window.location.hash = "#top";
            }}
          />
        </main>
        <Footer />
      </GameEntryProvider>
    );
  }

  // Normal interactive landing page
  return (
    <GameEntryProvider>
      <Header />
      <HangingHalloween />
      <main id="main" tabIndex={-1} className="outline-none">
        {/* 1 · Hero – Enter the Maze */}
        <Hero />

        {/* 2 · The World of Scams */}
        <WorldOfScams />

        {/* 3 · Investigate & Uncover */}
        <InvestigateAndUncover />

        {/* 4 · Final Call to Action & Debriefs */}
        <FinalCallToAction />
      </main>
      <Footer />
      <BottomAlert />
    </GameEntryProvider>
  );
}
