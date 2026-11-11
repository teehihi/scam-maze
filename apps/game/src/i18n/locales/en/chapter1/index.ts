import hud from "./hud";
import phone from "./phone";
import story from "./story";
import outcome from "./outcome";

/** The `chapter1` namespace, composed from area files with disjoint top-level key groups. */
const chapter1 = {
  ...hud,
  ...phone,
  ...story,
  ...outcome,
};

export default chapter1;
