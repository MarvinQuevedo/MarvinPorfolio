import React from 'react';

export default function WireNode({ wire, components, isSelected, onSelect, simulationCurrent }) {
  const getPinCoords = (pinId) => {
    for (const comp of components) {
      const pin = comp.pins.find(p => p.id === pinId);
      if (pin) {
        const rad = comp.rotation * Math.PI / 180;
        const absX = comp.x + pin.offsetX * Math.cos(rad) - pin.offsetY * Math.sin(rad);
        const absY = comp.y + pin.offsetX * Math.sin(rad) + pin.offsetY * Math.cos(rad);
        return { x: absX, y: absY };
      }
    }
    return null;
  };

  const startCoords = getPinCoords(wire.startPinId);
  const endCoords = getPinCoords(wire.endPinId);

  if (!startCoords || !endCoords) return null;

  // Orthogonal routing logic
  let pathData = '';
  // If mostly horizontal difference
  if (Math.abs(endCoords.x - startCoords.x) > Math.abs(endCoords.y - startCoords.y)) {
    const midX = (startCoords.x + endCoords.x) / 2;
    pathData = `M ${startCoords.x} ${startCoords.y} L ${midX} ${startCoords.y} L ${midX} ${endCoords.y} L ${endCoords.x} ${endCoords.y}`;
  } else {
    // mostly vertical difference
    const midY = (startCoords.y + endCoords.y) / 2;
    pathData = `M ${startCoords.x} ${startCoords.y} L ${startCoords.x} ${midY} L ${endCoords.x} ${midY} L ${endCoords.x} ${endCoords.y}`;
  }

  const hasCurrent = Math.abs(simulationCurrent) > 1e-6;
  const strokeColor = isSelected ? 'var(--accent-color)' : (hasCurrent ? 'var(--wire-active)' : 'var(--wire-color)');

  // Format current for tooltip
  let tooltipText = "Wire";
  if (hasCurrent) {
    const i = Math.abs(simulationCurrent);
    if (i < 0.001) tooltipText = `${(i * 1000000).toFixed(2)} µA`;
    else if (i < 1) tooltipText = `${(i * 1000).toFixed(2)} mA`;
    else tooltipText = `${(i).toFixed(3)} A`;
  }

  return (
    <g 
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.button === 0) onSelect(wire.id);
      }}
      style={{ cursor: 'pointer' }}
    >
      {/* Tooltip on hover */}
      <title>{tooltipText}</title>
      {/* Invisible thicker hit-box */}
      <path d={pathData} fill="none" stroke="transparent" strokeWidth="15" />
      
      {/* Actual wire */}
      <path 
        d={pathData} 
        fill="none" 
        stroke={strokeColor} 
        strokeWidth={isSelected ? "3" : "2"}
        style={{ transition: 'stroke 0.2s' }}
      />
      
      {/* Animated dashed line for current flow */}
      {hasCurrent && (
        <path 
          d={pathData} 
          fill="none" 
          stroke="#fbbf24" 
          strokeWidth="3"
          strokeDasharray="6 12"
          className="current-flow-animation"
          style={{ 
            animationDirection: simulationCurrent < 0 ? 'reverse' : 'normal',
            pointerEvents: 'none'
          }}
        />
      )}
    </g>
  );
}
