import React, { useState } from 'react';
import { COMPONENT_DEFINITIONS, registry } from '../core/ComponentDefs';

export default function ComponentNode({ 
  component, 
  isSelected, 
  onSelect, 
  onMove, 
  onRotate,
  onInteract,
  wiringHandlers,
  simulationCurrent,
  isSimulating,
  zoom = 1
}) {
  const { id, type, x, y, rotation, pins } = component;
  const def = COMPONENT_DEFINITIONS[type];
  const { startWiring, finishWiring, wiringStartPin } = wiringHandlers;

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handlePointerDown = (e) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    onSelect(id);
    setDragOffset({ x: e.clientX, y: e.clientY });
    if (!isSimulating) {
      setIsDragging(true);
      e.target.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e) => {
    if (isDragging && !isSimulating) {
      e.stopPropagation();
      const dx = (e.clientX - dragOffset.x) / zoom;
      const dy = (e.clientY - dragOffset.y) / zoom;
      
      // Calculate continuous new pos, snapping on render or state update
      const newX = x + dx;
      const newY = y + dy;
      
      const snappedX = Math.round(newX / 20) * 20;
      const snappedY = Math.round(newY / 20) * 20;
      
      // Only fire move if actually changed snapped grid
      if (snappedX !== x || snappedY !== y) {
        onMove(id, snappedX, snappedY);
        setDragOffset({ x: e.clientX, y: e.clientY }); // Reset origin to avoid drift
      }
    }
  };

  const handlePointerUp = (e) => {
    setIsDragging(false);
    if (!isSimulating) {
      e.target.releasePointerCapture(e.pointerId);
    }

    const dx = e.clientX - dragOffset.x;
    const dy = e.clientY - dragOffset.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 5 && onInteract) {
      onInteract(id);
    }
  };

  const renderShape = () => {
    const model = registry.get(type);
    if (model) {
      return model.renderShape(component, simulationCurrent);
    }
    return null;
  };

  return (
    <g 
      transform={`translate(${x}, ${y}) rotate(${rotation})`}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      <rect 
        x="-40" y="-30" width="80" height="60" 
        fill="transparent" 
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      {isSelected && (
        <g>
          <rect x="-35" y="-30" width="70" height="60" fill="none" stroke="var(--accent-color)" strokeWidth="1" strokeDasharray="4 2" />
          {/* Quick rotate button rendered above bounding box, scale down since it's SVG */}
          {!isSimulating && (
            <g 
              transform="translate(25, -45)" 
              style={{ cursor: 'pointer' }}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (e.button === 0 && onRotate) onRotate(id);
              }}
            >
              <circle cx="0" cy="0" r="10" fill="var(--panel-bg)" stroke="var(--accent-color)" strokeWidth="2" />
              <path d="M -4 0 A 4 4 0 1 1 0 -4 L 0 -6 L 4 -2 L 0 2 L 0 0 A 2 2 0 1 0 2 2 L 4 2 A 4 4 0 0 1 -4 0 Z" fill="var(--accent-color)" />
            </g>
          )}
        </g>
      )}
      {renderShape()}
      {pins.map((pin) => (
        <circle 
          key={pin.id}
          cx={pin.offsetX} 
          cy={pin.offsetY} 
          r="6" 
          fill={wiringStartPin?.pinId === pin.id ? "var(--wire-active)" : "var(--wire-color)"}
          stroke="var(--bg-color)"
          strokeWidth="2"
          className="component-pin"
          style={{ cursor: isSimulating ? 'not-allowed' : 'crosshair', transition: 'fill 0.2s', opacity: isSimulating ? 0 : 1 }}
          onPointerDown={(e) => {
            e.stopPropagation();
            if (e.button !== 0 || isSimulating) return;
            const rad = rotation * Math.PI / 180;
            const absX = x + pin.offsetX * Math.cos(rad) - pin.offsetY * Math.sin(rad);
            const absY = y + pin.offsetX * Math.sin(rad) + pin.offsetY * Math.cos(rad);
            startWiring(pin.id, absX, absY);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            if (wiringStartPin) finishWiring(pin.id);
          }}
        />
      ))}
    </g>
  );
}
