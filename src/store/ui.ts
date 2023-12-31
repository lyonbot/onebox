import localForage from 'localforage';
import { JSXElement, getOwner, runWithOwner } from 'solid-js';
import { createStore } from 'solid-js/store';
import { PromptRequest } from '~/components/PromptBox';
import { watch } from '~/utils/solid';

const LS_DARK_MODE = 'oneBox:darkMode';


export function createUIStore() {
  const [state, update] = createStore({
    showSidebar: true,
    darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
    actionHints: [] as JSXElement[],
    promptRequest: null as [req: PromptRequest, resolve: (value: string | null) => void] | null,
    rootHasFocus: 0,
  });

  const owner = getOwner()
  localForage.getItem<boolean>(LS_DARK_MODE).then(val => {
    if (val !== null) update('darkMode', val);
    runWithOwner(owner, () => watch(() => state.darkMode, value => localForage.setItem(LS_DARK_MODE, value)))
  })

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
    /** get a event handler for mouseenter / focusout */
    getActionHintEvFor(hint: JSXElement, anotherEv = 'mouseleave', strictTarget = true) {
      return (ev: Event) => {
        const target = ev.currentTarget as HTMLElement
        if (strictTarget && ev.target !== target) return;

        const actualRemove = api.addActionHint(hint)

        const timer = setInterval(() => { if (!target.offsetParent) remove() }, 100)
        const remove = () => {
          actualRemove()
          clearInterval(timer)
        };

        ev.target!.addEventListener(anotherEv, () => {
          remove()
        }, { once: true });
      }
    },
    prompt(title: JSXElement | (() => JSXElement), opts?: Partial<PromptRequest>): Promise<string | null> {
      if (state.promptRequest) state.promptRequest[1](null);

      return new Promise(resolve => {
        const actEl = document.activeElement as HTMLElement | null;

        const req: PromptRequest = {
          title,
          ...opts,
        }
        update('promptRequest', [req, (value) => {
          update('promptRequest', null);
          actEl?.focus?.()
          resolve(value);
        }]);
      })
    },
    confirm(title: JSXElement | (() => JSXElement)): Promise<boolean> {
      const options = [
        { label: 'Yes', value: 'yes' },
        { label: 'No', value: 'no' },
      ];
      return api.prompt(title, {
        enumOptions: (input) => {
          if (!input) return options;
          if (/[y1t]|^o/i.test(input)) return [options[0]]
          if (/[n0f]/i.test(input)) return [options[1]]

          return []
        },
      }).then(v => v === 'yes')
    },
  };

  return {
    state,
    update,
    api,
  };
}
