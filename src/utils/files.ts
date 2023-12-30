import JSZip from "jszip";
import { basename } from "path";
import { ExportedProjectData } from "~/store";
import { guessLangFromName } from "./langUtils";

type YieldItem = [name: string, file: File]
export async function* scanFilesFromEntry(e: FileSystemEntry): AsyncGenerator<YieldItem> {
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

export async function* scanFilesFromDataTransferItem(item: DataTransferItem): AsyncGenerator<YieldItem> {
  const handle = item.webkitGetAsEntry?.();
  if (handle) yield* scanFilesFromEntry(handle);
  else {
    // maybe just a file from screenshot
    const file = item.getAsFile();
    if (file) yield [file.name, file]
  }
}

export async function getProjectArchiveReader(file: File) {
  const zip = await JSZip.loadAsync(file)
  const jsonName = 'onebox.project.json'
  const projectFile = zip.file(jsonName)
  if (!projectFile) return

  const project = JSON.parse(await projectFile.async('text')) as Omit<ExportedProjectData, 'files'>
  if (project.is !== 'oneBox:projectData') return

  return {
    project,
    async getCompletedFiles() {
      const outFiles = [] as ExportedProjectData['files']
      let promise = Promise.resolve()
      zip.forEach((filename, file) => {
        if (filename === jsonName) return

        promise = promise.then(async () => {
          const isTextFile = guessFileNameType(filename) === 'text'
          outFiles.push({
            filename,
            lang: guessLangFromName(filename),
            content: isTextFile ? await file.async('text') : '',
            contentBinary: isTextFile ? false : await file.async('base64'),
          })
        })
      })

      await promise
      return outFiles
    },
  }
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
  if (/^([jt]sx?|txt|md|html|json|log|ini|ya?ml|s?css|srt)$/i.test(ext)) return 'text'

  return 'unknown'
}

export function isValidFilename(filename: string) {
  return !!filename && /^[^\\:*?"<>|]+$/.test(filename)
}
