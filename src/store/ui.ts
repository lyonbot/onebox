import { JSXElement } from 'solid-js';
import { createStore } from 'solid-js/store';

export function createUIStore() {
  const [state, update] = createStore({
    showSidebar: true,
    actionHints: [] as JSXElement[]
  });

  const api = {
    toggleSidebar() {
      update('showSidebar', v => !v);
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
