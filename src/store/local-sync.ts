import Dexie from 'dexie';
import { OneBox } from '.';
import { VTextFile } from './files';
import { createEffect, createSignal, mapArray, onCleanup } from 'solid-js';
import { queuedAsync } from '~/utils/async';
import { watch } from '~/utils/solid';
import { Buffer } from 'buffer';
import { cloneDeep, forEach, pickBy } from 'lodash';
import { Fn } from 'yon-utils';

export async function setupLocalSync(oneBox: OneBox) {
  const [savingEnabled, setSavingEnabled] = createSignal(false)
  const createSaveEffect = (fn: () => void) => watch(savingEnabled, enabled => enabled && createEffect(fn))

  const readActions = [] as Fn[]

  const db = new Dexie("OneBox-DefaultProject");
  db.version(1).stores({
    files: '&filename, lang, mtime, ctime',
    settings: '&key',
  });

  await db.open()
  const files = db.table<VTextFile>('files')
  const settings = db.table<{ key: string, value: any }>('settings')

  //#region files

  readActions.push(async () => {
    // load files from local storage
    const loadedFiles = await files.toArray()
    oneBox.files.update('files', () => loadedFiles.map(it => ({
      ...it,
      filename: it.filename,
      contentBinary: it.contentBinary ? Buffer.from(it.contentBinary) : false,
    })))
  })
  createSaveEffect(mapArray(() => oneBox.files.state.files, (file) => {
    let lastFilename = file.filename

    const write = queuedAsync(async (copied) => {
      // const updatedCount = await files.update(lastFilename, copied)
      // if (updatedCount === 0) await files.add(copied)
      await files.put(copied);
      lastFilename = copied.filename;
    });

    // sync this file!
    watch(() => ({ ...file }), write)

    // delete this file!
    onCleanup(() => {
      write.cancel()
      Promise.resolve(write.waitCurrent()).then(() => files.delete(lastFilename))
    })
  }))

  //#endregion

  //#region dockview (must after files)

  readActions.push(async () => {
    const dockview = oneBox.panels.state.dockview
    if (!dockview) return

    const prevDockviewLayout = await settings.get('dockviewLayout')
    if (prevDockviewLayout?.value) setTimeout(() => {
      dockview.fromJSON(prevDockviewLayout.value)
    }, 10) // wait for files loaded
  })
  createSaveEffect(() => {
    const dockview = oneBox.panels.state.dockview
    if (!dockview) return

    const write = queuedAsync(async () => {
      const json = cloneDeep(dockview.toJSON());
      forEach(json.panels, it => {
        it.params = pickBy(it.params, x => typeof x !== 'function');
      });
      await settings.put({ key: 'dockviewLayout', value: json });
    });

    const listener = dockview.onDidLayoutChange(write)
    onCleanup(() => {
      listener.dispose()
      write.cancel()
    })
  })
  //#endregion


  async function load() {
    const wasSavingEnabled = savingEnabled()
    setSavingEnabled(false)
    try {
      for (const fn of readActions) await fn()
    } finally {
      setSavingEnabled(wasSavingEnabled)
    }
  }

  return {
    load,
    setSavingEnabled,
  }
}

export type LocalSync = ReturnType<typeof setupLocalSync> extends Promise<infer T> ? T : never
