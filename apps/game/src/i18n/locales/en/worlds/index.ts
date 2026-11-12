import testmove from "./testmove";
import ueh from "./ueh";
import hue from "./hue";

/** The `worlds` namespace, composed from area files with disjoint top-level key groups. */
const worlds = {
  ...testmove,
  ...ueh,
  ...hue,
};

export default worlds;
