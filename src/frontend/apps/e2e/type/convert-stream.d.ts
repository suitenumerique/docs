declare module 'convert-stream' {
  export function toBuffer(
    _readableStream: NodeJS.ReadableStream,
  ): Promise<Buffer>;
}
