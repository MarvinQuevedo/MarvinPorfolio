import React from 'react';
import { COMPONENT_DEFINITIONS, registry } from '../core/ComponentDefs';

const renderIcon = (type) => {
  const model = registry.get(type);
  if (model) {
    return (
      <svg width="24" height="24" viewBox="-40 -40 80 80">
        {model.renderIcon()}
      </svg>
    );
  }
  return null;
};

export default function Sidebar({ onAddComponent }) {
  const handleDragStart = (e, type) => {
    e.dataTransfer.setData('componentType', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const groupedComponents = Object.values(COMPONENT_DEFINITIONS).reduce((acc, def) => {
    if (!acc[def.category]) acc[def.category] = [];
    acc[def.category].push(def);
    return acc;
  }, {});

  return (
    <div className="sidebar glass-panel" style={{ userSelect: 'none', overflowY: 'auto' }}>
      <h2 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '20px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Components
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {Object.entries(groupedComponents).map(([category, defs]) => (
          <div key={category}>
            <h3 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid var(--panel-border)', paddingBottom: '4px' }}>
              {category}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {defs.map(def => (
                <div 
                  key={def.type}
                  draggable
                  onDragStart={(e) => handleDragStart(e, def.type)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-color)',
                    border: `1px solid var(--panel-border)`,
                    borderRadius: '8px',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                >
                  <div style={{ 
                    width: '32px', height: '32px', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '6px' 
                  }}>
                    {renderIcon(def.type, def.color)}
                  </div>
                  <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{def.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, borderTop: '1px solid var(--panel-border)', paddingTop: '10px' }}>
          Drag and drop components to the canvas.
        </p>
      </div>
    </div>
  );
}
