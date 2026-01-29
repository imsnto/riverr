'use client';
import React from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { cn } from '@/lib/utils';

export const ResizableImageNode = ({ editor, node, updateAttributes, selected }: NodeViewProps) => {
  const { src, alt, title, width } = node.attrs;

  const onResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = node.attrs.width ? parseInt(node.attrs.width, 10) : event.currentTarget.parentElement?.parentElement?.offsetWidth || 300;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = startWidth + (moveEvent.clientX - startX);
      updateAttributes({ width: `${Math.max(50, newWidth)}px` }); // Min width 50px
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
                <div
                    className="absolute -bottom-2 -right-2 w-4 h-4 bg-primary rounded-full border-2 border-background cursor-se-resize"
                    onMouseDown={onResizeStart}
                />
            )}
        </div>
    </NodeViewWrapper>
  );
};
