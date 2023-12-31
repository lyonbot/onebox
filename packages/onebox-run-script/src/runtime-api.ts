import { createSignal } from "solid-js";
import { OBAPI } from "./types/onebox-runtime";
import { VTextFileController } from "~/store/files";

export const [obFactory, setObFactory] = createSignal<(file: VTextFileController) => OBAPI>(null as any)
