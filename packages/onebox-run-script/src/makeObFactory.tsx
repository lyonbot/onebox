import jsyaml from 'js-yaml';
import { OneBox } from '~/store';
import { OBAPI } from './types/onebox-runtime';
import { Buffer } from 'buffer';
import { OBAPIFactory } from './runtime-api';

// Note: we can't use `Buffer` directly, because it is not the one that injected to sandbox iframe
const isBinary = (x: any) => typeof x === 'object' && x && typeof x.byteLength === 'number' && typeof x.slice === 'function';

export function makeObFactory(oneBox: OneBox): OBAPIFactory {
  return (file, getWindow): OBAPI => {
    const norm = (fn: string) => file.resolvePath(decodeURI(fn));

    return ({
      readText: fn => {
        fn = norm(fn);
        return oneBox.files.api.getControllerOf(fn)?.content || '';
      },
      readJSON(path) {
        path = norm(path);
        return getWindow().JSON5.parse(this.readText(path));
      },
      readYAML(path) {
        path = norm(path);
        return getWindow().jsyaml.load(this.readText(path)) as any;
      },
      readBuffer(path) {
        path = norm(path);
        const file = oneBox.files.api.getControllerOf(path);
        if (!file) return null

        const Buffer = getWindow().Buffer
        return file.contentBinary ? Buffer.from(file.contentBinary) : Buffer.from(file.content);
      },
      writeFile: (fn, content, format) => {
        fn = norm(fn);

        if (format === 'json') content = JSON.stringify(content, null, 2) + '\n';
        if (format === 'yaml') content = jsyaml.dump(content) + '\n';
        if (typeof content === 'object') content = JSON.stringify(content, null, 2) + '\n';

        content = String(content);

        const file = oneBox.files.api.getControllerOf(fn);
        if (file) file.setContent(content);
        else oneBox.files.api.createFile({ content, filename: fn });
      },
      writeBinaryFile(path, content) {
        path = norm(path);

        const buffer = Buffer.from(content);
        const file = oneBox.files.api.getControllerOf(path);

        if (file) file.setContentBinary(buffer);
        else oneBox.files.api.createFile({ contentBinary: buffer, filename: path });
      },
      appendFile: (fn, content) => {
        fn = norm(fn);
        const file = oneBox.files.api.getControllerOf(fn);

        if (isBinary(content)) {
          const prev = file?.contentBinary
          const prevLength = (prev && prev.byteLength) || 0

          const appendData = Buffer.from(content)
          const contentBinary = prevLength ? Buffer.allocUnsafe(prevLength + appendData.byteLength) : appendData

          if (prevLength) {
            (prev as Buffer).copy(contentBinary)
            appendData.copy(contentBinary, prevLength)
          }

          if (file) file.setContentBinary(contentBinary)
          else oneBox.files.api.createFile({ contentBinary, filename: fn });
        } else {
          if (typeof content === 'object') content = JSON.stringify(content, null, 2) + '\n';
          else content = String(content);

          if (file) file.setContent(file.content + content);
          else oneBox.files.api.createFile({ content, filename: fn });
        }
      },
      openFile: (fn, pos) => {
        fn = norm(fn);
        if (!oneBox.files.api.getControllerOf(fn)) oneBox.files.api.createFile({ filename: fn });
        if (pos === true) pos = 'right';
        oneBox.api.openFile(fn, pos);
      },
    });
  };
}
