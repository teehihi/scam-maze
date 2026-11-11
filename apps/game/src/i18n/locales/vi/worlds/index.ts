import type en from "../../en/worlds";
import type { LocaleShape } from "../../../types";
import hcm from "./hcm";
import testmove from "./testmove";
import ueh from "./ueh";
import hue from "./hue";

const worlds: LocaleShape<typeof en> = {
  ...hcm,
  ...testmove,
  ...ueh,
  ...hue,
};

export default worlds;
