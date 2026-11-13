import type en from "../../en/worlds";
import type { LocaleShape } from "../../../types";
import testmove from "./testmove";
import ueh from "./ueh";
import hue from "./hue";
import mientay from "./mientay";

const worlds: LocaleShape<typeof en> = {
  ...testmove,
  ...ueh,
  ...hue,
  ...mientay,
};

export default worlds;
