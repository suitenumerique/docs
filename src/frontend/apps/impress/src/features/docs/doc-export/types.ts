import { Access } from '../doc-management';

export interface Template {
  id: string;
  abilities: {
    destroy: boolean;
    generate_document: boolean;
    accesses_manage: boolean;
    retrieve: boolean;
    update: boolean;
    partial_update: boolean;
  };
  accesses: Access[];
  title: string;
  is_public: boolean;
  css: string;
  code: string;
}
