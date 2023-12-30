/** exposed in `ob` */
/**
 * the OneBox interface. exposed as global `ob` in the script.
 */
export interface OBAPI {
  /**
   * Reads the content of a file.
   * @param path - The relative path of the file to read. eg. `"./foobar.txt"`
   * @returns The content of the file as a string.
   */
  readText(path: string): string;

  /**
   * Reads the content of a file as JSON.
   * @param path - The relative path of the file to read. eg. `"./foobar.json"`
   * @returns The content of the file as a JSON object.
   */
  readJSON<T=any>(path: string): T;

  /**
   * Writes content to a file. If the file does not exist, it will be created.
   * @param path - The relative path of the file to write. eg. `"./foobar.txt"`
   * @param content - The content to write. If is object, will be JSON.stringify-ed.
   */
  writeFile(path: string, content: any): void;

  /**
   * Appends content to a file. If the file does not exist, it will be created.
   * @param path - The relative path of the file to update. eg. `"./foobar.txt"`
   * @param content - The content to write. If is object, will be JSON.stringify-ed.
   */
  appendFile(path: string, content: any): void;

  /**
   * Opens a file.
   * @param path - The relative path of the file to open. eg. `"./foobar.txt"`
   * @param aside - Optional. Specifies whether to open the file in a separate window or in the current window.
   */
  openFile(path: string, aside?: boolean | 'right' | 'below'): void;
}
