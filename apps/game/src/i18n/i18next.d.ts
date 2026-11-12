import "i18next";
import type { EnResources } from "./resources";

// Typed `t`: keys are checked against the English dictionaries (the source of every locale).
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: EnResources;
    returnNull: false;
  }
}
