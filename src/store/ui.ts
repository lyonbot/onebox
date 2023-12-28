import { JSXElement } from 'solid-js';
import { createStore } from 'solid-js/store';
import { watch } from '~/utils/solid';

const LS_DARK_MODE = 'oneBox:darkMode';

export function createUIStore() {
  const tmp = localStorage.getItem(LS_DARK_MODE);

  const [state, update] = createStore({
    showSidebar: true,
    darkMode: tmp ? tmp === '1' : window.matchMedia('(prefers-color-scheme: dark)').matches,
    actionHints: [] as JSXElement[]
  });

  watch(() => state.darkMode, value => {
    localStorage.setItem(LS_DARK_MODE, value ? '1' : '0');
  }, true)

  const api = {
    toggleSidebar() {
      update('showSidebar', v => !v);
    },
    toggleDarkMode() {
      update('darkMode', v => !v);
    },
    addActionHint(hint: JSXElement) {
      update('actionHints', hints => [...hints, hint]);
      return () => {
        update('actionHints', hints => hints.filter(h => h !== hint));
      }
    },
    /** get a event handler for mouseenter */
    getActionHintEvForMouse(hint: JSXElement) {
      return (ev: MouseEvent) => {
        const target = ev.currentTarget as HTMLElement
        if (ev.target !== target) return;

        const actualRemove = api.addActionHint(hint)

        const timer = setInterval(() => { if (!target.offsetParent) remove() }, 100)
        const remove = () => {
          actualRemove()
          clearInterval(timer)
        };

        target.addEventListener('mouseleave', remove, { once: true });
      }
    }
  };

  return {
    state,
    update,
    api,
  };
}
