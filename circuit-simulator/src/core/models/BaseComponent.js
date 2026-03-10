/**
 * Base implementation for any circuit component.
 * Modders should extend this class or provide a compatible structure to add custom components.
 */
export default class BaseComponent {
  get type() { return 'GENERIC'; }
  get label() { return 'Generic Component'; }
  get category() { return 'Misc'; }
  get numPins() { return 2; }
  get defaultProperties() { return {}; }
  get propertyLabels() { return {}; }
  get color() { return '#ffffff'; }

  // Returns extra variables needed for MNA (e.g., Voltage sources need 1)
  getExtraVariablesCount() {
    return 0;
  }

  // Stamp the component's physics into the MNA matrices
  // A: The Admittance matrix
  // Z: The Known values vector
  // componentState: The JSON state of the component (properties, pins, id)
  // finalNodeMap: A Map resolving pin IDs to their mathematical MNA node index (0 is Ground)
  // extraVarIndices: Array of global indices assigned to this component's extra variables
  applyMNA(A, Z, componentState, finalNodeMap, extraVarIndices) {
    // Override in subclass
  }

  // Define how the component looks on the canvas
  // Returns SVG JSX elements
  renderShape(componentState, simulationCurrent) {
    return null;
  }

  // Define how the icon looks in the Sidebar
  // Returns SVG JSX elements to fit in a 24x24 viewBox (-40 -40 80 80)
  renderIcon() {
    return null;
  }

  // Determines the branch current through the component based on resolved voltages
  // nodeVoltages: Object mapping pinId -> Double (voltage)
  // extraVarValues: Array of solved values for the extra variables requested by this component
  extractCurrent(componentState, nodeVoltages, extraVarValues) {
    return 0; // Default zero current if not simulated
  }
}
