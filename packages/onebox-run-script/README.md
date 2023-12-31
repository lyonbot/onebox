# onebox-run-script

OneBox plugin that run JavaScript / TypeScript, and provide a Chrome DevTool panel inside.

## How to Use

In JavaScript or TypeScript file, simply press `F5`, or invoke the action via `Cmd+Enter`.

Your code will be executed in a separate iframe, and a Chrome DevTool panel will be opened. You can inspect and view variables, but `debugger` breakpoints still require the real DevTool of your browser.

Once code updated, press `F5` again to re-run. By default we reload the whole iframe, but you can switch to **Incremental Mode** (on the left-top corner of runner panel) to execute the script, retains existing variables in iframe.

To interact with OneBox API, you can use the `ob` object, which is exposed to the global scope of iframe.

```js
var data = ob.readJSON("./data.json");
data.processed = true;
ob.writeFile("./data2.json", data);
```

## Features

- [x] Run JavaScript in browser
- [x] Provide a Chrome DevTool panel
- [x] Optional incremental mode: intact existing variables in iframe when re-run
- [x] HTML Preview
- [x] Exposed `ob` object to access OneBox API and Files
- [x] See network requests
- [x] ~~Breakpoints~~ (please open real DevTool to make `debugger` works)
- [x] Transpile JSX / TypeScript in browser \*
- [x] Support `import` / `export` syntax
- [ ] Import third-party libraries like `lodash`, `axios` etc.
- [ ] Asserting and testing 🚦

> NOTE: the JSX is not React, and each JSX element is a `HTMLElement` instance, not a React component.
>
> Maybe one day we can support React, but for now, you can use JSX to create DOM elements.
>
> ```jsx
> function sayHello() {
>   alert("Hello");
> }
>
> document.body.appendChild(
>   <div class="foobar">
>     <p>Yes everything is a HTMLElement</p>
>     <button onclick={sayHello}> like this </button>
>     <style>{` body {color: red} `}</style>
>   </div>
> );
> ```

## Tech Stack

- [OneBox](https://github.com/lyonbot/onebox) - a scratch book for developer.

- [chii](https://github.com/liriliri/chii) - debugging in browser, with Chrome DevTool frontend.

  - specifically, using its [separate iframe mode](https://chii.liriliri.io/test/iframe.html)

  - the `target.js` is served from local, and resources are from `cdn` <https://cdn.jsdelivr.net/npm/chii/public>

- typescript worker of monaco

  - transpile TypeScript in browser
