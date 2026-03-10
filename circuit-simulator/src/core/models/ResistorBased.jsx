import BaseComponent from './BaseComponent';
import React from 'react';

export class ResistorModel extends BaseComponent {
  get type() { return 'RESISTOR'; }
  get label() { return 'Resistor'; }
  get category() { return 'Passive'; }
  get numPins() { return 2; }
  get defaultProperties() { return { resistance: 1000 }; }
  get propertyLabels() { return { resistance: 'Resistance (Ω)' }; }
  get color() { return '#f59e0b'; }

  applyMNA(A, Z, componentState, finalNodeMap) {
    let r = componentState.properties.resistance || 1000;
    // Prevent division by zero
    if (r < 1e-6) r = 1e-6; 
    
    const g = 1.0 / r;
    const n1 = finalNodeMap.get(componentState.pins[0].id) || 0;
    const n2 = finalNodeMap.get(componentState.pins[1].id) || 0;

    if (n1 > 0) A[n1 - 1][n1 - 1] += g;
    if (n2 > 0) A[n2 - 1][n2 - 1] += g;
    if (n1 > 0 && n2 > 0) {
      A[n1 - 1][n2 - 1] -= g;
      A[n2 - 1][n1 - 1] -= g;
    }
  }

  extractCurrent(componentState, nodeVoltages) {
    let r = componentState.properties.resistance || 1000;
    if (r < 1e-6) r = 1e-6;
    const v1 = nodeVoltages[componentState.pins[0].id] || 0;
    const v2 = nodeVoltages[componentState.pins[1].id] || 0;
    return (v1 - v2) / r;
  }

  renderShape() {
    return (
      <path d="M -30 0 L -15 0 L -10 -10 L 0 10 L 10 -10 L 15 0 L 30 0" stroke={this.color} strokeWidth="3" fill="none" />
    );
  }

  renderIcon() {
    return (
      <path d="M -30 0 L -15 0 L -10 -15 L 0 15 L 10 -15 L 15 0 L 30 0" stroke={this.color} strokeWidth="4" fill="none" />
    );
  }
}

export class SwitchModel extends ResistorModel {
  get type() { return 'SWITCH'; }
  get label() { return 'Switch'; }
  get category() { return 'Interactive'; }
  get defaultProperties() { return { closed: false }; }
  get propertyLabels() { return {}; }
  get color() { return '#a8a29e'; }

  applyMNA(A, Z, componentState, finalNodeMap) {
    // A switch is just a resistor that is ~0 ohms when closed and ~infinite ohms when open.
    const originalR = componentState.properties.resistance;
    componentState.properties.resistance = componentState.properties.closed ? 1e-6 : 1e9;
    super.applyMNA(A, Z, componentState, finalNodeMap);
    componentState.properties.resistance = originalR;
  }

  extractCurrent(componentState, nodeVoltages) {
    const originalR = componentState.properties.resistance;
    componentState.properties.resistance = componentState.properties.closed ? 1e-6 : 1e9;
    const ans = super.extractCurrent(componentState, nodeVoltages);
    componentState.properties.resistance = originalR;
    return ans;
  }

  renderShape(componentState) {
    const closed = componentState.properties.closed;
    return (
      <g>
        <circle cx="-15" cy="0" r="3" fill={this.color} />
        <circle cx="15" cy="0" r="3" fill={this.color} />
        <line x1="-30" y1="0" x2="-15" y2="0" stroke={this.color} strokeWidth="3" />
        <line x1="15" y1="0" x2="30" y2="0" stroke={this.color} strokeWidth="3" />
        <line x1="-15" y1="0" x2={closed ? "15" : "12"} y2={closed ? "0" : "-15"} stroke={this.color} strokeWidth="3" style={{ transition: 'all 0.2s' }} />
      </g>
    );
  }

  renderIcon() {
    return (
      <g stroke={this.color}>
        <circle cx="-15" cy="0" r="4" fill={this.color} />
        <circle cx="15" cy="0" r="4" fill={this.color} />
        <line x1="-30" y1="0" x2="-15" y2="0" strokeWidth="4" />
        <line x1="15" y1="0" x2="30" y2="0" strokeWidth="4" />
        <line x1="-15" y1="0" x2="10" y2="-15" strokeWidth="4" />
      </g>
    );
  }
}

export class BulbModel extends ResistorModel {
  get type() { return 'BULB'; }
  get label() { return 'Light Bulb'; }
  get category() { return 'Output'; }
  get defaultProperties() { return { resistance: 100 }; }
  get propertyLabels() { return { resistance: 'Resistance (Ω)' }; }
  get color() { return '#fbbf24'; }

  renderShape(componentState, simulationCurrent) {
    const isGlowing = Math.abs(simulationCurrent) > 0.001; // > 1mA
    const brightness = Math.min(1, Math.abs(simulationCurrent) * 10); // Scale brightness
    return (
      <g>
        <line x1="-30" y1="0" x2="-15" y2="0" stroke={this.color} strokeWidth="3" />
        <line x1="15" y1="0" x2="30" y2="0" stroke={this.color} strokeWidth="3" />
        <circle cx="0" cy="0" r="15" fill={isGlowing ? `rgba(251, 191, 36, ${0.4 + brightness * 0.6})` : 'transparent'} stroke={this.color} strokeWidth="2" style={{ transition: 'fill 0.2s' }} />
        <path d="M -8 5 L -4 -5 L 4 5 L 8 -5" fill="none" stroke={this.color} strokeWidth="2" />
      </g>
    );
  }

  renderIcon() {
    return (
      <g stroke={this.color} fill="none">
        <line x1="-30" y1="0" x2="-15" y2="0" strokeWidth="4" />
        <line x1="15" y1="0" x2="30" y2="0" strokeWidth="4" />
        <circle cx="0" cy="0" r="18" strokeWidth="3" />
        <path d="M -10 6 L -5 -6 L 5 6 L 10 -6" strokeWidth="3" />
      </g>
    );
  }
}
