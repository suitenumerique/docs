type IdColumn = {
  id: number;
};
export type DatabaseRow =
  | Record<string, string | number | boolean | undefined>
  | IdColumn;
