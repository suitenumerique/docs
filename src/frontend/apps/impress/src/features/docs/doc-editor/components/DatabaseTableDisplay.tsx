import { useGristTableData } from '@/features/grist/useGristTableData';

export const DatabaseTableDisplay = ({
  documentId,
  tableId,
}: {
  documentId: string;
  tableId: string;
}) => {
  const { tableData } = useGristTableData({
    documentId,
    tableId,
  });

  return JSON.stringify(tableData, null, 2);
};
