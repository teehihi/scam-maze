import type en from "../../en/worlds";
import type { LocaleShape } from "../../../types";
import testmove from "./testmove";
import ueh from "./ueh";
import hue from "./hue";
import mientay from "./mientay";
import khupho from "./khupho";
import roomv2 from "./roomv2";

const worlds: LocaleShape<typeof en> = {
  ...testmove,
  ...ueh,
  ...hue,
  ...mientay,
  ...khupho,
  ...roomv2,
};

export default worlds;
