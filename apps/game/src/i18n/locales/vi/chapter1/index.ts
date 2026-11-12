import type en from "../../en/chapter1";
import type { LocaleShape } from "../../../types";
import hud from "./hud";
import phone from "./phone";
import story from "./story";
import outcome from "./outcome";

const chapter1: LocaleShape<typeof en> = {
  ...hud,
  ...phone,
  ...story,
  ...outcome,
};

export default chapter1;
