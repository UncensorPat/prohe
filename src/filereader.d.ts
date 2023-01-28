

declare module 'filereader' {
  import { EventEmitter } from "stream";

  interface Event {
    target: FileReader
  }

  class FileReader extends EventEmitter {
    constructor();

    addEventListener(a: string, b: any): void;
    removeEventListener(callback: any): void;
    dispatchEvent(on: any): void;

    result: any;
    EMPTY: number;
    LOADING: number;
    DONE: number;

    // Whatever the file object is, turn it into a Node.JS File.Stream
    createFileStream(): void;

    // Map `error`, `progress`, `load`, and `loadend`
    mapStreamToEmitter(format: any, encoding: any): void;

    // Abort is overwritten by readAsXyz
    abort(): void;

    mapUserEvents(): void;
    readFile(_file: any, format: any, encoding: any): void;
    readAsText(a: any): void;
  }
}
