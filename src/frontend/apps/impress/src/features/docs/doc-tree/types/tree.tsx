export type BaseType<T> = T & {
  id: string;
  childrenCount?: number;
  parentId?: string;
  children?: BaseType<T>[];
};

export type TreeViewDataType<T> = BaseType<T>;

export enum TreeViewMoveModeEnum {
  FIRST_CHILD = 'first-child',
  LAST_CHILD = 'last-child',
  LEFT = 'left',
  RIGHT = 'right',
}

export type TreeViewMoveResult = {
  targetNodeId: string;
  mode: TreeViewMoveModeEnum;
  sourceNodeId: string;
  oldParentId?: string;
};
