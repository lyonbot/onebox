// this file runs in the context of the sandbox

import { elt } from "yon-utils";

const global = window as any;
global.React = {
  createElement: elt,
}
