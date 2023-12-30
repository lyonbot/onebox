import { OneBox } from "~/store";
import { setupMonacoEmmet } from "./emmet";
import { setupMonacoLanguageDefaults } from "./language";
import { setupMonacoOneBoxFileIntegration } from './oneBoxFS';

export function setupMonacoEnv(oneBox: OneBox) {
  setupMonacoEmmet()
  setupMonacoLanguageDefaults()
  setupMonacoOneBoxFileIntegration(oneBox)
}


