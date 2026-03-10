import React, { useReducer, useEffect } from 'react';
import './App.css';
import { circuitReducer, initialState } from './store/circuitReducer';
import { createComponent, registry } from './core/ComponentDefs';
import { simulateCircuit } from './core/Solver';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import ComponentNode from './components/ComponentNode';
import WireNode from './components/WireNode';
import PropertiesPanel from './components/PropertiesPanel';

function App() {
  const [state, dispatch] = useReducer(circuitReducer, initialState);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeElement = document.activeElement;
      // Do not handle keydown if user is typing in an input
      if (activeElement && activeElement.tagName === 'INPUT') return;

      if ((e.key === 'Backspace' || e.key === 'Delete') && state.selectedElementId) {
        dispatch({ type: 'REMOVE_ELEMENT', payload: state.selectedElementId });
      } else if ((e.key === 'r' || e.key === 'R') && state.selectedElementId) {
        dispatch({ type: 'ROTATE_COMPONENT', payload: state.selectedElementId });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.selectedElementId]);

  useEffect(() => {
    if (state.isSimulating) {
      try {
        const results = simulateCircuit(state.components, state.wires);
        
        let newlyDamagedIds = [];
        if (state.enableDamage) {
          state.components.forEach(comp => {
            if (comp.properties.damaged) return;
            const model = registry.get(comp.type);
            if (model && model.checkDamage) {
              const current = Math.abs(results.branchCurrents[comp.id] || 0);
              const vA = results.nodeVoltages[comp.pins[0]?.id] || 0;
              const vB = results.nodeVoltages[comp.pins[1]?.id] || 0;
              const reason = model.checkDamage(comp, current, vA - vB);
              if (reason) {
                newlyDamagedIds.push({ id: comp.id, reason });
              }
            }
          });
        }
        
        if (newlyDamagedIds.length > 0) {
          dispatch({ type: 'APPLY_DAMAGE', payload: newlyDamagedIds });
          // state update will trigger a re-run of this hook next render
        } else {
          dispatch({ type: 'SET_SIMULATION_RESULTS', payload: results });
        }
      } catch (err) {
        console.error("Simulation error", err);
      }
    } else {
      dispatch({ type: 'SET_SIMULATION_RESULTS', payload: { nodeVoltages: {}, branchCurrents: {} } });
    }
  }, [state.isSimulating, state.components, state.wires, state.enableDamage]);

  const handleSave = () => {
    const data = JSON.stringify({ components: state.components, wires: state.wires });
    localStorage.setItem('circuit-backup', data);
    alert('Circuit saved successfully!');
  };

  const handleLoad = () => {
    const data = localStorage.getItem('circuit-backup');
    if (data) {
      try {
        const parsed = JSON.parse(data);
        dispatch({ type: 'LOAD_CIRCUIT', payload: parsed });
      } catch (e) {
        alert('Failed to load circuit.');
      }
    } else {
      alert('No saved circuit found.');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (state.isSimulating) {
      alert("Cannot add components while simulation is running.");
      return;
    }
    const type = e.dataTransfer.getData('componentType');
    if (type) {
      const canvasContainer = document.querySelector('.canvas-container');
      const canvasRect = canvasContainer.getBoundingClientRect();
      const x = Math.round((e.clientX - canvasRect.left) / 20) * 20;
      const y = Math.round((e.clientY - canvasRect.top) / 20) * 20;
      const newComponent = createComponent(type, x, y);
      dispatch({ type: 'ADD_COMPONENT', payload: newComponent });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  return (
    <div className="app-container" onDrop={handleDrop} onDragOver={handleDragOver}>
      <div className="top-bar glass-panel">
        <h1 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{color: 'var(--accent-color)'}}>⚡</span> Circuit Simulator
        </h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <input 
              type="checkbox" 
              checked={state.enableDamage} 
              onChange={() => dispatch({ type: 'TOGGLE_DAMAGE' })} 
            />
            Damage Physics
          </label>
          <button className="tb-btn" onClick={handleSave}>Save</button>
          <button className="tb-btn" onClick={handleLoad}>Load</button>
          <button className="tb-btn sim-btn" onClick={() => dispatch({ type: 'TOGGLE_SIMULATION' })}>
            {state.isSimulating ? 'Stop Simulation' : 'Start Simulation'}
            {state.isSimulating ? <span className="pulse-dot"></span> : null}
          </button>
        </div>
      </div>
      <div className="main-content">
        <Sidebar onAddComponent={() => {}} />
        <Canvas 
          components={state.components}
          wires={state.wires}
          dispatch={dispatch}
          selectedElementId={state.selectedElementId}
          isSimulating={state.isSimulating}
          renderComponent={(comp, wiringHandlers, zoom) => (
            <ComponentNode 
              key={comp.id}
              component={comp}
              isSelected={state.selectedElementId === comp.id}
              onSelect={(id) => dispatch({ type: 'SET_SELECTED', payload: id })}
              onMove={(id, x, y) => dispatch({ type: 'MOVE_COMPONENT', payload: { id, x, y } })}
              onRotate={(id) => dispatch({ type: 'ROTATE_COMPONENT', payload: id })}
              onInteract={(id) => dispatch({ type: 'TOGGLE_SWITCH', payload: id })}
              wiringHandlers={wiringHandlers}
              simulationCurrent={state.simulationResults.branchCurrents[comp.id] || 0}
              isSimulating={state.isSimulating}
              zoom={zoom}
            />
          )}
          renderWire={(wire) => (
            <WireNode 
              key={wire.id}
              wire={wire}
              components={state.components}
              isSelected={state.selectedElementId === wire.id}
              onSelect={(id) => dispatch({ type: 'SET_SELECTED', payload: id })}
              simulationCurrent={state.simulationResults.branchCurrents[wire.id] || 0}
              isSimulating={state.isSimulating}
            />
          )}
        />
        {state.selectedElementId && (
          <PropertiesPanel 
            elementId={state.selectedElementId}
            components={state.components}
            wires={state.wires}
            dispatch={dispatch}
          />
        )}
      </div>
    </div>
  );
}

export default App;
