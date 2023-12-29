type YieldItem = [name: string, file: File]
export async function* scanFiles(e: FileSystemEntry): AsyncGenerator<YieldItem> {
  async function* traverse(entry: FileSystemEntry, pathPrefix: string): AsyncGenerator<YieldItem> {
    const name = pathPrefix + entry.name
    if (entry.isDirectory) {
      const directoryReader = (entry as FileSystemDirectoryEntry).createReader();
      const subEntries = await new Promise<FileSystemEntry[]>(resolve => {
        directoryReader.readEntries(resolve, () => resolve([]));
      })

      for (const subEntry of subEntries) {
        yield* traverse(subEntry, `${name}/`)
      }
      return;
    }

    if (entry.isFile) {
      const file = await new Promise<File | null>(resolve => (entry as FileSystemFileEntry).file(resolve, () => resolve(null)))
      if (file) yield [name, file]
    }
  }

  yield* traverse(e, '')
}
