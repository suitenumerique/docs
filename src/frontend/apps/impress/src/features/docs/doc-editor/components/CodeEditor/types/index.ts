export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onClickOutside: () => void;
  parentRef?: React.RefObject<HTMLDivElement | null>;
  language?: string;
  height?: string;
  width?: string;
}

export interface EditorDimensions {
  height: number;
  width: number;
}
