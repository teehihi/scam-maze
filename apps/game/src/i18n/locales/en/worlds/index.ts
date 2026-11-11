import hcm from "./hcm";
import testmove from "./testmove";
import ueh from "./ueh";
import hue from "./hue";

/** The `worlds` namespace, composed from area files with disjoint top-level key groups. */
const worlds = {
  ...hcm,
  ...testmove,
  ...ueh,
  ...hue,
};

export default worlds;
