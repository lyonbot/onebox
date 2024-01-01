/** exposed in `ob` */
/**
 * the OneBox interface. exposed as global `ob` in the script.
 */
export interface OBAPI {
  /**
   * Reads the content of a file.
   * @param path - The relative path of the file to read. eg. `"./foobar.txt"`
   * @returns The content of the file as a string. return empty string if file not exist
   */
  readText(path: string): string;

  /**
   * Reads the content of a file as JSON.
   * @param path - The relative path of the file to read. eg. `"./foobar.json"`
   * @returns The content of the file as a JSON object.
   */
  readJSON<T = any>(path: string): T;

  /**
   * Reads the content of a file as YAML.
   * @param path - The relative path of the file to read. eg. `"./foobar.yaml"`
   * @returns The content of the file as a YAML object. (parsed by js-yaml)
   */
  readYAML<T = any>(path: string): T;

  /**
   * Reads the content of a file as a Buffer.
   * @param path - The relative path of the file to read. eg. `"./foobar.txt"` or `"./foobar.jpg"`
   * @returns The content of the file as a Buffer. If file not exist, returns null
   */
  readBuffer(path: string): Buffer | null;

  /**
   * Writes content to a file. If the file does not exist, it will be created.
   * @param path - The relative path of the file to write. eg. `"./foobar.txt"`
   * @param content - The content to write. If is object, will be JSON.stringify-ed; is Buffer, will be written as binary file.
   * @param format - Optional. Specifies the format of the file. If omitted, will be inferred from the file extension.
   */
  writeFile(path: string, content: any, format?: 'yaml' | 'json' | 'binary'): void;

  /**
   * Appends content to a file. If the file does not exist, it will be created.
   *
   * This works with binary files too!
   *
   * @param path - The relative path of the file to update. eg. `"./foobar.txt"`
   * @param content - The content to write.
   */
  appendFile(path: string, content: any): void;

  /**
   * Opens a file.
   * @param path - The relative path of the file to open. eg. `"./foobar.txt"`
   * @param aside - Optional. Specifies whether to open the file in a separate window or in the current window.
   */
  openFile(path: string, aside?: boolean | 'right' | 'below'): void;
}
