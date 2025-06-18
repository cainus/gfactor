declare module 'stream-json/Parser' {
  import { Transform } from 'stream';
  export function parser(options?: any): Transform;
}

declare module 'stream-json/streamers/StreamValues' {
  import { Transform } from 'stream';
  export function streamValues(options?: any): Transform;
}

declare module 'stream-chain' {
  import { Transform } from 'stream';
  export function chain(transforms: any[]): Transform;
}