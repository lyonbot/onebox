# onebox-run-script

OneBox plugin that run JavaScript / TypeScript, and provide a Chrome DevTool panel inside.

## How to Use

In JavaScript or TypeScript file, simply press `F5`, or invoke the action via `Cmd+Enter`.

Your code will be executed in a separate iframe, and a Chrome DevTool panel will be opened. You can inspect and view variables, but `debugger` breakpoints still require the real DevTool of your browser.

Once code updated, press `F5` again to re-run. By default we reload the whole iframe, but you can switch to **Incremental Mode** (on the left-top corner of runner panel) to execute the script, retains existing variables in iframe.

## Features

- [x] Run JavaScript in browser
- [x] Provide a Chrome DevTool panel
- [x] Optional incremental mode: intact existing variables in iframe when re-run
- [x] HTML Preview
- [x] See network requests
- [x] ~~Breakpoints~~ (please open real DevTool to make `debugger` works)
- [ ] Transpile JSX / TypeScript in browser ⚛️
- [ ] Support `import` / `export` syntax
- [ ] Import third-party libraries like `lodash`, `axios` etc.
- [ ] Asserting and testing 🚦

## Tech Stack

- [OneBox](https://github.com/lyonbot/onebox) - a scratch book for developer.

- [chii](https://github.com/liriliri/chii) - debugging in browser, with Chrome DevTool frontend.

  - specifically, using its [separate iframe mode](https://chii.liriliri.io/test/iframe.html)

  - the `target.js` is served from local, and resources are from `cdn` <https://cdn.jsdelivr.net/npm/chii/public>

- [@babel/standalone](https://babeljs.io/docs/babel-standalone) - the babel in browser

  - transform JSX, TypeScript syntax
  - analyze ESM dependencies and transform its syntax to AMD.
