import React from 'react';

export default function SplitDivider({ isDragging, onMouseDown }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className={`w-1.5 hover:w-2 bg-slate-200 hover:bg-[#84cc16] cursor-col-resize select-none flex-shrink-0 flex items-center justify-center transition-colors z-20 ${
        isDragging ? 'bg-[#84cc16] w-2' : ''
      }`}
      title="Drag to adjust column widths"
    >
      <div className="h-8 w-0.5 bg-slate-400 rounded-full" />
    </div>
  );
}
