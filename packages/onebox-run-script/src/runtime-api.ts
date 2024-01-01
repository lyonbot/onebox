import { createSignal } from "solid-js";
import type { OBAPI } from "./types/onebox-runtime";
import type { VTextFileController } from "~/store/files";
import type { SandboxWindow } from "./runtime-inject";

export type OBAPIFactory = (file: VTextFileController, window: () => (Window & typeof globalThis & SandboxWindow)) => OBAPI;

export const [obFactory, setObFactory] = createSignal<OBAPIFactory>(null as any)
