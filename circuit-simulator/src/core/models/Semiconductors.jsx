import BaseComponent from './BaseComponent';
import React from 'react';

export const DIODE_MODELS = {
  '1N4148': { label: '1N4148 (Fast Diode)', Vf: 0.6, Ron: 0.1, type: 'diode' },
  '1N4007': { label: '1N4007 (Rectifier)', Vf: 0.7, Ron: 0.05, type: 'diode' },
  '1N4733A': { label: '1N4733A (5.1V Zener)', Vf: 0.7, Ron: 0.1, Vz: 5.1, type: 'zener' },
};

export const LED_MODELS = {
  'RED': { label: 'Red LED', Vf: 1.8, Ron: 0.1, color: '#ef4444', glow: 'rgba(239, 68, 68, 0.6)' },
  'GREEN': { label: 'Green LED', Vf: 2.2, Ron: 0.1, color: '#22c55e', glow: 'rgba(34, 197, 94, 0.6)' },
  'BLUE': { label: 'Blue LED', Vf: 3.2, Ron: 0.1, color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.6)' },
  'YELLOW': { label: 'Yellow LED', Vf: 2.1, Ron: 0.1, color: '#eab308', glow: 'rgba(234, 179, 8, 0.6)' },
};

export class DiodeModel extends BaseComponent {
  get type() { return 'DIODE'; }
  get label() { return 'Diode'; }
  get category() { return 'Semiconductors'; }
  get numPins() { return 2; }
  get defaultProperties() { return { modelId: '1N4148' }; }
  
  // Custom metadata for PropertiesPanel to render a dropdown
  get propertyMeta() { 
    return {
      modelId: { 
        type: 'select', 
        label: 'Diode Model', 
        options: Object.entries(DIODE_MODELS).map(([k, v]) => ({ value: k, label: v.label })) 
      }
    };
  }

  get color() { return '#9ca3af'; } // Grayish

  applyMNA(A, Z, componentState, resolvedNodeMap, extraVarIndices, lastNodeVoltages) {
    const model = DIODE_MODELS[componentState.properties.modelId] || DIODE_MODELS['1N4148'];
    const pA = componentState.pins[0].id;
    const pC = componentState.pins[1].id;
    const nA = resolvedNodeMap.get(pA) || 0;
    const nC = resolvedNodeMap.get(pC) || 0;

    const vA = lastNodeVoltages ? (lastNodeVoltages[pA] || 0) : 0;
    const vC = lastNodeVoltages ? (lastNodeVoltages[pC] || 0) : 0;
    const Vd = vA - vC;

    let G = 1e-9;
    let Ieq = 0; // equivalent current injection

    if (Vd > model.Vf) {
      // Forward biased
      G = 1.0 / model.Ron;
      Ieq = model.Vf * G;
    } else if (model.Vz && Vd < -model.Vz) {
      // Reverse biased Zener breakdown
      G = 1.0 / model.Ron;
      Ieq = -model.Vz * G;
    }

    // Add conductances
    if (nA > 0) A[nA - 1][nA - 1] += G;
    if (nC > 0) A[nC - 1][nC - 1] += G;
    if (nA > 0 && nC > 0) {
      A[nA - 1][nC - 1] -= G;
      A[nC - 1][nA - 1] -= G;
    }

    // Add Norton equivalent current sources
    if (nA > 0) Z[nA - 1] += Ieq;
    if (nC > 0) Z[nC - 1] -= Ieq;
  }

  extractCurrent(componentState, nodeVoltages) {
    const model = DIODE_MODELS[componentState.properties.modelId] || DIODE_MODELS['1N4148'];
    const vA = nodeVoltages[componentState.pins[0].id] || 0;
    const vC = nodeVoltages[componentState.pins[1].id] || 0;
    const Vd = vA - vC;
    
    if (Vd > model.Vf) {
      return (Vd - model.Vf) / model.Ron;
    } else if (model.Vz && Vd < -model.Vz) {
      return (Vd + model.Vz) / model.Ron; // Negative current
    }
    return Vd * 1e-9; 
  }

  renderShape(componentState) {
    const model = DIODE_MODELS[componentState.properties.modelId] || DIODE_MODELS['1N4148'];
    const isZener = model.type === 'zener';

    return (
      <g>
        <line x1="-30" y1="0" x2="-15" y2="0" stroke={this.color} strokeWidth="3" />
        <line x1="15" y1="0" x2="30" y2="0" stroke={this.color} strokeWidth="3" />
        {/* Triangle */}
        <polygon points="-15,10 -15,-10 5,0" fill={this.color} />
        {/* Cathode line */}
        <line x1="5" y1="-10" x2="5" y2="10" stroke={this.color} strokeWidth="3" />
        {isZener && (
          <>
            <line x1="5" y1="-10" x2="10" y2="-10" stroke={this.color} strokeWidth="2" />
            <line x1="5" y1="10" x2="0" y2="10" stroke={this.color} strokeWidth="2" />
          </>
        )}
      </g>
    );
  }

  renderIcon() {
    return (
      <g stroke={this.color}>
        <line x1="-30" y1="0" x2="-12" y2="0" strokeWidth="3" />
        <line x1="12" y1="0" x2="30" y2="0" strokeWidth="3" />
        <polygon points="-12,12 -12,-12 12,0" fill={this.color} />
        <line x1="12" y1="-12" x2="12" y2="12" strokeWidth="3" />
      </g>
    );
  }
}

export class LedModel extends DiodeModel {
  get type() { return 'LED'; }
  get label() { return 'LED'; }
  get category() { return 'Output'; }
  get defaultProperties() { return { modelId: 'RED' }; }
  
  get propertyMeta() { 
    return {
      modelId: { 
        type: 'select', 
        label: 'Color', 
        options: Object.entries(LED_MODELS).map(([k, v]) => ({ value: k, label: v.label })) 
      }
    };
  }

  applyMNA(A, Z, componentState, resolvedNodeMap, extraVarIndices, lastNodeVoltages) {
    const model = LED_MODELS[componentState.properties.modelId] || LED_MODELS['RED'];
    // Temporarily replace DIODE_MODELS mapped values with LED model for applyMNA
    const originalModelId = componentState.properties.modelId;
    DIODE_MODELS['_TEMP_LED'] = model;
    componentState.properties.modelId = '_TEMP_LED';
    
    super.applyMNA(A, Z, componentState, resolvedNodeMap, extraVarIndices, lastNodeVoltages);
    
    componentState.properties.modelId = originalModelId;
    delete DIODE_MODELS['_TEMP_LED'];
  }

  extractCurrent(componentState, nodeVoltages) {
    const model = LED_MODELS[componentState.properties.modelId] || LED_MODELS['RED'];
    const originalModelId = componentState.properties.modelId;
    DIODE_MODELS['_TEMP_LED'] = model;
    componentState.properties.modelId = '_TEMP_LED';
    
    const ans = super.extractCurrent(componentState, nodeVoltages);
    
    componentState.properties.modelId = originalModelId;
    delete DIODE_MODELS['_TEMP_LED'];
    return ans;
  }

  renderShape(componentState, simulationCurrent) {
    const model = LED_MODELS[componentState.properties.modelId] || LED_MODELS['RED'];
    const isGlowing = simulationCurrent > 0.001; // > 1mA forward
    const brightness = Math.min(1, Math.max(0, simulationCurrent) * 20); // Scale up brightness
    const baseColor = model.color;

    return (
      <g>
        <line x1="-30" y1="0" x2="-15" y2="0" stroke={baseColor} strokeWidth="3" />
        <line x1="15" y1="0" x2="30" y2="0" stroke={baseColor} strokeWidth="3" />
        <polygon points="-15,10 -15,-10 5,0" fill={baseColor} />
        <line x1="5" y1="-10" x2="5" y2="10" stroke={baseColor} strokeWidth="3" />
        
        {/* Light rays */}
        <line x1="8" y1="-12" x2="14" y2="-18" stroke={baseColor} strokeWidth="2" opacity={isGlowing ? 1 : 0.3} />
        <polygon points="12,-18 16,-19 15,-15" fill={baseColor} opacity={isGlowing ? 1 : 0.3} />
        
        <line x1="0" y1="-14" x2="4" y2="-22" stroke={baseColor} strokeWidth="2" opacity={isGlowing ? 1 : 0.3}/>
        <polygon points="2,-22 6,-24 6,-20" fill={baseColor} opacity={isGlowing ? 1 : 0.3}/>

        {/* Glow halo */}
        <circle cx="-5" cy="0" r="22" fill={isGlowing ? model.glow : 'transparent'} style={{ transition: 'opacity 0.1s', opacity: brightness }} pointerEvents="none" />
      </g>
    );
  }

  renderIcon() {
    return (
      <g stroke="#ef4444">
        <line x1="-30" y1="0" x2="-12" y2="0" strokeWidth="3" />
        <line x1="12" y1="0" x2="30" y2="0" strokeWidth="3" />
        <polygon points="-12,12 -12,-12 12,0" fill="#ef4444" />
        <line x1="12" y1="-12" x2="12" y2="12" strokeWidth="3" />
        <line x1="10" y1="-15" x2="18" y2="-23" strokeWidth="2" />
        <line x1="0" y1="-18" x2="5" y2="-28" strokeWidth="2" />
      </g>
    );
  }
}
