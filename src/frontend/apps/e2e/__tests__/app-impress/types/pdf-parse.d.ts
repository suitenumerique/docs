/**
 * Type definitions for pdf-parse library
 * The library doesn't export complete type definitions for the parsed PDF data
 */

declare module 'pdf-parse' {
  export interface PdfInfo {
    Title?: string;
    Author?: string;
    Subject?: string;
    Keywords?: string;
    Creator?: string;
    Producer?: string;
    CreationDate?: string;
    ModDate?: string;
    [key: string]: unknown;
  }

  export interface PdfData {
    /** Total number of pages */
    numpages: number;
    /** Alias for numpages */
    total?: number;
    /** Extracted text content from the PDF */
    text: string;
    /** PDF metadata information */
    info?: PdfInfo;
    /** PDF metadata (alternative structure) */
    metadata?: unknown;
    /** PDF version */
    version?: string;
  }

  export function pdf(buffer: Buffer): Promise<PdfData>;

  export default pdf;
}
