import * as monaco from 'monaco-editor';
import { isEqual } from 'lodash'
import { createEffect, createSignal, untrack } from 'solid-js'
import { OneBoxPlugin } from "~/plugins";

const getFileLinkRe = () => /[<[('"](\.\.?\/[^'")\]>?#]+)/g  // [0]=leading paren + filename, [1]=filename

/**
 * a plugin that find out dependencies in markdown / js / ts / text files
 */
export const OneBoxDependenciesPlugin: OneBoxPlugin = () => {
  return ({
    name: 'dependencies',
    getDependencies(file) {
      if (file.contentBinary) return;

      const [out, setOut] = createSignal<OneBoxPlugin.FileDependency[]>([]);
      createEffect(() => {
        const names = new Set<string>();
        for (const match of file.content.matchAll(getFileLinkRe())) {
          const rel = match[1];
          names.add(rel);
        }

        const sorted = Array.from(names, n => file.resolvePath(decodeURI(n)))
          .sort()
          .map<OneBoxPlugin.FileDependency>(filename => ({
            filename,
          }));
        untrack(() => (!isEqual(sorted, out()) && setOut(sorted)));
      });

      return out;
    },
    onDependencyChangeName(file, oldName, newName) {
      const ops: monaco.editor.ISingleEditOperation[] = [];
      for (const iterator of file.content.matchAll(getFileLinkRe())) {
        if (file.resolvePath(decodeURI(iterator[1])) === oldName) {
          const startPos = file.model.getPositionAt(iterator.index! + 1); // skip the first char
          ops.push({
            range: monaco.Range.fromPositions(startPos, startPos.delta(0, iterator[1].length)),
            text: encodeURI(file.relativePath(newName)),
          });
        }
      }
      file.model.pushEditOperations(null, ops, null as any);
    },
  });
}
