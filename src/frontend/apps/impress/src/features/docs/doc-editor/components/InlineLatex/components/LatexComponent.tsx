import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useEffect, useRef, useState } from 'react';

import { styles } from '../styles';

interface LatexComponentProps {
  formula: string;
  updateFormula: (newFormula: string) => void;
  updateCatchFocus: (catchFocus: boolean) => void;
  catchFocus?: boolean;
}

export const LatexComponent: React.FC<LatexComponentProps> = ({
  formula,
  updateFormula,
  updateCatchFocus,
  catchFocus,
}) => {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(formula);
  const [isHovered, setIsHovered] = useState(false);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (catchFocus && containerRef.current) {
      setIsEditing(true);
      // Small delay to ensure the element is mounted
      setTimeout(() => {
        containerRef.current?.focus();
        selectAllText();
        updateCatchFocus(false);
      }, 0);
    }
  }, [catchFocus, updateCatchFocus]);

  useEffect(() => {
    if (!isEditing && containerRef.current) {
      try {
        katex.render(formula, containerRef.current, {
          displayMode: false,
          throwOnError: false,
        });
      } catch {
        containerRef.current.innerHTML = '/!\\ Invalid LaTeX formula';
      }
    }
  }, [formula, isEditing]);

  const handleClick = () => {
    if (!isEditing) {
      setIsEditing(true);
      setIsHovered(false);
      setEditValue(formula);
    }
  };

  const selectAllText = () => {
    if (!containerRef.current) {
      return;
    }

    // Focus the element first
    containerRef.current.focus();

    // Get the selection
    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    // Create a new range
    const range = document.createRange();

    // Set the range to the contentEditable element
    range.selectNodeContents(containerRef.current);

    // Collapse the range to the start
    range.collapse(true);

    // Extend the range to the end
    range.setEnd(containerRef.current, containerRef.current.childNodes.length);

    // Apply the selection
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.detail === 3) {
      e.preventDefault();
      e.stopPropagation();
      selectAllText();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isEditing) {
      if (e.key === 'Enter') {
        setIsHovered(false);
        setIsEditing(false);
        updateFormula(editValue);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        e.stopPropagation();
        selectAllText();
      } else if (e.key === 'Backspace') {
        const selection = window.getSelection();
        const range = selection?.getRangeAt(0);

        if (range?.startOffset === 0 && editValue === '') {
          e.preventDefault();
          setIsEditing(false);
          updateFormula('');
        }
      }
    } else {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    }
  };

  const handleBlur = () => {
    // Add a small delay to allow for triple-click selection
    blurTimeoutRef.current = setTimeout(() => {
      setIsEditing(false);
      updateFormula(editValue);
    }, 200);
  };

  const handleInput = (e: React.FormEvent<HTMLSpanElement>) => {
    const selection = window.getSelection();
    const range = selection?.getRangeAt(0);
    const start = range?.startOffset || 0;

    setEditValue(e.currentTarget.textContent || '');

    // Restore cursor position after state update
    requestAnimationFrame(() => {
      if (containerRef.current && selection && range) {
        const newRange = document.createRange();
        newRange.setStart(
          containerRef.current.firstChild || containerRef.current,
          start,
        );
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    });
  };

  if (isEditing) {
    return (
      <span
        ref={containerRef}
        contentEditable
        suppressContentEditableWarning
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        onMouseDown={handleMouseDown}
        role="textbox"
        tabIndex={0}
        aria-label="Edit LaTeX formula"
        style={{
          ...styles.editor,
          userSelect: 'text',
          WebkitUserSelect: 'text',
          MozUserSelect: 'text',
          msUserSelect: 'text',
        }}
      >
        {editValue}
      </span>
    );
  }

  return (
    <span
      ref={containerRef}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="button"
      tabIndex={0}
      aria-label="Click to edit LaTeX formula"
      style={{
        ...styles.container,
        ...(isHovered ? styles.containerHovered : styles.containerDefault),
      }}
    />
  );
};
