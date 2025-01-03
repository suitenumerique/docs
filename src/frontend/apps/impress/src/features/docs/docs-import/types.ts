import { Doc } from "../doc-management/types";

export type DocToImport = {
    doc: Doc;
    state: 'pending' | 'success' | 'error';
    error?: Error;
    children?: DocToImport[];
};

export type ImportState = 'idle' | 'importing' | 'completed'; 