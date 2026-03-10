import React from 'react';
import { COMPONENT_DEFINITIONS } from '../core/ComponentDefs';

export default function PropertiesPanel({ elementId, components, wires, dispatch }) {
  const component = components.find(c => c.id === elementId);
  const wire = wires?.find(w => w.id === elementId);

  if (!component && !wire) return null;

  if (wire) {
    return (
      <div className="properties-panel glass-panel">
        <h3 style={{ marginTop: 0, marginBottom: '15px', color: 'var(--text-primary)' }}>Wire Connection</h3>
        <p style={{ color: 'var(--text-secondary)' }}>Connects two component pins.</p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', borderTop: '1px solid var(--panel-border)', paddingTop: '15px' }}>
          <button 
            className="tb-btn" 
            style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', width: '100%' }}
            onClick={() => dispatch({ type: 'REMOVE_ELEMENT', payload: wire.id })}
          >
            Delete Wire
          </button>
        </div>
      </div>
    );
  }

  const def = COMPONENT_DEFINITIONS[component.type];

  return (
    <div className="properties-panel glass-panel">
      <h3 style={{ marginTop: 0, marginBottom: '15px', color: 'var(--text-primary)' }}>{def?.label || 'Component'}</h3>
      
      {(def && def.propertyMeta) || (def && def.propertyLabels && Object.keys(def.propertyLabels).length > 0) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {Object.entries(def.propertyMeta || Object.keys(def.propertyLabels).reduce((a, k) => ({...a, [k]: {label: def.propertyLabels[k], type: 'number'}}), {})).map(([key, meta]) => {
            const val = component.properties[key];
            return (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{meta.label || meta}</label>
                {meta.type === 'select' ? (
                  <select 
                    value={val}
                    onChange={(e) => {
                      dispatch({ 
                        type: 'UPDATE_PROPERTY', 
                        payload: { id: component.id, key, value: e.target.value } 
                      });
                    }}
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid var(--panel-border)',
                      color: 'white',
                      padding: '8px',
                      borderRadius: '4px',
                      fontFamily: 'inherit'
                    }}
                  >
                    {meta.options.map(opt => (
                      <option key={opt.value} value={opt.value} style={{ background: '#1e293b' }}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type="number" 
                    value={val}
                    onChange={(e) => {
                      dispatch({ 
                        type: 'UPDATE_PROPERTY', 
                        payload: { id: component.id, key, value: parseFloat(e.target.value) || 0 } 
                      });
                    }}
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid var(--panel-border)',
                      color: 'white',
                      padding: '8px',
                      borderRadius: '4px',
                      fontFamily: 'inherit'
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No dynamic parameters.</p>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '20px', borderTop: '1px solid var(--panel-border)', paddingTop: '15px' }}>
        <button 
          className="tb-btn" 
          onClick={() => dispatch({ type: 'ROTATE_COMPONENT', payload: component.id })}
          title="Rotate (R)"
          style={{ flex: 1 }}
        >
          ↻ Rotate
        </button>
        <button 
          className="tb-btn" 
          style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', flex: 1 }}
          onClick={() => dispatch({ type: 'REMOVE_ELEMENT', payload: component.id })}
          title="Delete (Del)"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
