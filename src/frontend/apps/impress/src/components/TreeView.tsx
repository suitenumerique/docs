/* eslint-disable jsx-a11y/no-static-element-interactions */
import { NodeRendererProps, Tree } from 'react-arborist';

type DataType = {
  id: string;
  name: string;
  children?: DataType[];
};

const data: DataType[] = [
  { id: '1', name: 'TESTTING', children: [] },
  { id: '2', name: 'Threads' },
  {
    id: '3',
    name: 'Chat Rooms',
    children: [
      { id: 'c1', name: 'General' },
      { id: 'c2', name: 'Random' },
      { id: 'c3', name: 'Open Source Projects' },
    ],
  },
  {
    id: '4',
    name: 'Direct Messages',
    children: [
      { id: 'd1', name: 'Alice' },
      { id: 'd2', name: 'Bob' },
      { id: 'd3', name: 'Charlie' },
    ],
  },
];

export const TreeView = () => {
  return (
    <Tree
      initialData={data}
      openByDefault={false}
      width={600}
      height={1000}
      indent={24}
      rowHeight={36}
      overscanCount={1}
      paddingTop={30}
      paddingBottom={10}
      padding={25}
    >
      {/* Specify the Node component as a renderer prop */}
      {(props) => <Node {...props} />}
    </Tree>
  );
};

function Node({ node, style, dragHandle }: NodeRendererProps<DataType>) {
  /* This node instance can do many things. See the API reference. */

  const isLeaf = node.isLeaf || node.children?.length === 0;
  const handleClick = () => {
    console.log(isLeaf);
    if (!isLeaf) {
      node.toggle();
    }
    return;
  };

  console.log(node.willReceiveDrop);
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <div
      style={{
        ...style,
        background: node.willReceiveDrop ? 'blue' : undefined,
      }}
      ref={dragHandle}
      onClick={handleClick}
    >
      {node.isLeaf || node.children?.length === 0 ? '🍁' : 'x'}
      {node.data.name}
    </div>
  );
}
