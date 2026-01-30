'use client';
import React from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { cn } from '@/lib/utils';

export const ResizableImageNode = ({ editor, node, updateAttributes, selected }: NodeViewProps) => {
  const { src, alt, title, width } = node.attrs;

  const onResizeStart = (event: React.MouseEvent<HTMLDivElement>, handle: 'tl' | 'tr' | 'bl' | 'br') => {
    event.preventDefault();
    event.stopPropagation();
    
    const imageDiv = event.currentTarget.parentElement;
    if (!imageDiv) return;

    const startX = event.clientX;
    const startWidth = imageDiv.offsetWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      // For left handles, we invert the delta; for right, we use it as is.
      const widthDelta = handle.includes('l') ? -deltaX : deltaX;
      
      let newWidth = startWidth + widthDelta;
      newWidth = Math.max(50, newWidth); // Enforce a minimum width of 50px

      updateAttributes({ width: `${Math.round(newWidth)}px` });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };
  
  const align = node.attrs['data-align'] || 'center';
  const float = node.attrs['data-float'] || 'none';
  
  return (
    <NodeViewWrapper
      className={cn(
        'image-wrapper my-4',
        { 'float-left mr-4': float === 'left' },
        { 'float-right ml-4': float === 'right' },
        // Use flex for alignment only when not floated
        float === 'none' && {
            'flex justify-center': align === 'center',
            'flex justify-start': align === 'left',
            'flex justify-end': align === 'right',
        }
      )}
      data-drag-handle
    >
        <div 
          className={cn('relative inline-block', selected && 'ring-2 ring-primary ring-offset-2 rounded-lg')}
          style={{ width: width || 'auto' }}
        >
            <img src={src} alt={alt} title={title} className="block w-full h-auto rounded-lg"/>
            {selected && (
                <>
                    <div
                        className="absolute -top-2 -left-2 w-4 h-4 bg-primary rounded-full border-2 border-background cursor-nwse-resize"
                        onMouseDown={(e) => onResizeStart(e, 'tl')}
                    />
                    <div
                        className="absolute -top-2 -right-2 w-4 h-4 bg-primary rounded-full border-2 border-background cursor-nesw-resize"
                        onMouseDown={(e) => onResizeStart(e, 'tr')}
                    />
                    <div
                        className="absolute -bottom-2 -left-2 w-4 h-4 bg-primary rounded-full border-2 border-background cursor-nesw-resize"
                        onMouseDown={(e) => onResizeStart(e, 'bl')}
                    />
                    <div
                        className="absolute -bottom-2 -right-2 w-4 h-4 bg-primary rounded-full border-2 border-background cursor-nwse-resize"
                        onMouseDown={(e) => onResizeStart(e, 'br')}
                    />
                </>
            )}
        </div>
    </NodeViewWrapper>
  );
};
