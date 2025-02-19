import { TreeViewDataType } from '@/features/docs/doc-tree/types/tree';
import {
  DataType,
  LeftPanelDocContent,
} from '@/features/left-panel/components/LeftPanelDocContent';

const initialData: TreeViewDataType<DataType>[] = [
  { id: 'Noeud #1', name: 'Noeud #1', children: [] },
  { id: 'Noeud #2', name: 'Noeud #2', children: [] },
  {
    id: 'Noeud #3',
    name: 'Noeud #3',
    childrenCount: 0,
    children: [],
  },
  {
    id: 'Noeud #4',
    name: 'Noeud #4',
    children: [
      { id: 'Noeud #4.1', name: 'Noeud #4.1' },
      { id: 'Noeud #4.2', name: 'Noeud #4.2' },
      { id: 'Noeud #4.3', name: 'Noeud #4.3' },
    ],
  },
  { id: 'Noeud #5', name: 'Noeud #5', children: [] },
  { id: 'Noeud #6', name: 'Noeud #6', children: [] },
  { id: 'Noeud #7', name: 'Noeud #7', children: [] },
  {
    id: 'Noeud #8 fjdsk nfjksdn fjksd nfjdks nkjfsdn fjkds',
    name: 'Noeud #8  hfi sfd hjk sd shjf bdsjhs fbdjhfsdbj kj bq',
    children: [],
  },
];

export default function Test() {
  return <LeftPanelDocContent />;
}
