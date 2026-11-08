import { useEffect, useState } from "react";

/**
 * Tracks scroll direction and page position to support smart header:
 * - Always visible at the top of the page (scrollY <= 20).
 * - Hides when scrolling DOWN.
 * - Shows when scrolling UP.
 */
export function useHeaderVisibility() {
  const [visible, setVisible] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          setScrolled(currentScrollY > 20);

          const section3 = document.getElementById("investigate");
          const isInsideSection3 =
            section3 &&
            (() => {
              const rect = section3.getBoundingClientRect();
              return rect.top <= 60 && rect.bottom >= window.innerHeight - 60;
            })();

          if (isInsideSection3) {
            // Suppress header while inside Section 3 (even when scrolling up)
            setVisible(false);
          } else if (currentScrollY <= 20) {
            // Always show at the top of the page
            setVisible(true);
          } else if (currentScrollY > lastScrollY + 5 && currentScrollY > 80) {
            // Scrolling DOWN by at least 5px past 80px: hide
            setVisible(false);
          } else if (currentScrollY < lastScrollY - 5) {
            // Scrolling UP by at least 5px: show
            setVisible(true);
          }

          lastScrollY = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return { visible, scrolled };
}
