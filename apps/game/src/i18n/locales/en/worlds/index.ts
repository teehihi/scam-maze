import testmove from "./testmove";
import ueh from "./ueh";
import hue from "./hue";
import mientay from "./mientay";
import khupho from "./khupho";
import roomv2 from "./roomv2";

/** The `worlds` namespace, composed from area files with disjoint top-level key groups. */
const worlds = {
  ...testmove,
  ...ueh,
  ...hue,
  ...mientay,
  ...khupho,
  ...roomv2,
};

export default worlds;
