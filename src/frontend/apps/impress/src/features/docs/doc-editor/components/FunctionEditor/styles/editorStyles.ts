import { VerticalAlign } from "docx";

export const containerStyles = {
  position: 'absolute',
  zIndex: 1000,
  padding: '1rem',
  background: 'white',
  border: '1px solid #e0e0e0',
  borderRadius: '4px',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'flex-start',
  boxSizing: 'border-box',
} as const;

export const editorContainerStyles = {
  width: '100%',
  marginRight: '1rem',
  position : 'relative',
} as const;

export const functionEditorsStyle = {
  position : 'relative',
  width : '100%',
  display : 'block',
  VerticalAlign : 'center',
} as const;

export const divContainer = {
  width : '100%',
  alignItems : 'top',
} as const;

export const functionEditorsContainer = {
  width : '70%',
  display : 'inline-block',
} as const;

export const leftButtonsContainer = {
  width : '10%',
  display : 'inline-block',
  verticalAlign : 'top',
  textAlign : 'center',
} as const;

export const rightButtonsContainer = {
  width : '20%',
  display : 'inline-block',
  verticalAlign : 'top',
  textAlign : 'center',
} as const;

export const inputStyle = {
  borderRadius : '5px',
} as const