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

export function downloadFile(filename: string, content: BlobPart) {
  const blob = new Blob([content], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = basename(filename)
  a.click()
  URL.revokeObjectURL(url)
}

export function guessFileNameType(filename: string) {
  const ext = filename.split('.').pop() || ''

  if (/^(png|jpe?g|gif|webp|bmp|ico|svg|tiff?)$/i.test(ext)) return 'image'
  if (/^(mp4|webm|ogg|mov|avi|flv|wmv|mpg)$/i.test(ext)) return 'video'
  if (/^(mp3|wav|ogg|flac|aac)$/i.test(ext)) return 'audio'

  return 'unknown'
}

export function basename(filename: string) {
  return filename.split('/').pop() || ''
}
