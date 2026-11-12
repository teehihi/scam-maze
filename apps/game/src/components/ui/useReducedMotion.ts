import { useContext } from "react";
import { ComfortContext } from "../../features/chapter1/comfort/ComfortProvider";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * Effective reduced motion. Inside a ComfortProvider it combines the setting with the OS query;
 * outside it returns the OS query, exactly like usePrefersReducedMotion.
 */
export function useReducedMotion(): boolean {
  const os = usePrefersReducedMotion();
  const comfort = useContext(ComfortContext);
  return comfort ? comfort.reducedMotion : os;
}
