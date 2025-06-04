export interface FunctionEditorProps {
  functions: string[];
  min: number;
  max: number;
  num: number;
  onChange: (fun: string[], min : number, max : number, num : number) => void;
  onClickOutside: () => void;
  parentRef?: React.RefObject<HTMLDivElement | null>;
}

export interface EditorDimensions {
  height: number;
  width: number;
}
