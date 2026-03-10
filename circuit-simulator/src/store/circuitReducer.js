export const initialState = {
  components: [],
  wires: [],
  selectedElementId: null,
  isSimulating: false,
  simulationResults: {
    nodeVoltages: {}, // pinId -> voltage
    branchCurrents: {} // compId -> current
  }
};

export function circuitReducer(state, action) {
  switch (action.type) {
    case 'ADD_COMPONENT':
      return {
        ...state,
        components: [...state.components, action.payload]
      };
    
    case 'REMOVE_ELEMENT': {
      const id = action.payload;
      // Is it a component?
      if (state.components.some(c => c.id === id)) {
        const comp = state.components.find(c => c.id === id);
        const pinIds = comp.pins.map(p => p.id);
        return {
          ...state,
          components: state.components.filter(c => c.id !== id),
          // Also remove any wire connected to this component
          wires: state.wires.filter(w => !pinIds.includes(w.startPinId) && !pinIds.includes(w.endPinId)),
          selectedElementId: state.selectedElementId === id ? null : state.selectedElementId
        };
      }
      // Is it a wire?
      if (state.wires.some(w => w.id === id)) {
        return {
          ...state,
          wires: state.wires.filter(w => w.id !== id),
          selectedElementId: state.selectedElementId === id ? null : state.selectedElementId
        };
      }
      return state;
    }

    case 'ADD_WIRE':
      return {
        ...state,
        wires: [...state.wires, action.payload]
      };

    case 'MOVE_COMPONENT':
      return {
        ...state,
        components: state.components.map(c => 
          c.id === action.payload.id 
            ? { ...c, x: action.payload.x, y: action.payload.y } 
            : c
        )
      };

    case 'UPDATE_PROPERTY':
      return {
        ...state,
        components: state.components.map(c => 
          c.id === action.payload.id 
            ? { ...c, properties: { ...c.properties, [action.payload.key]: action.payload.value } } 
            : c
        )
      };

    case 'SET_SELECTED':
      return { ...state, selectedElementId: action.payload };

    case 'ROTATE_COMPONENT':
      return {
        ...state,
        components: state.components.map(c => 
          c.id === action.payload 
            ? { ...c, rotation: (c.rotation + 90) % 360 } 
            : c
        )
      };

    case 'TOGGLE_SWITCH':
      return {
        ...state,
        components: state.components.map(c => 
          c.id === action.payload && c.type === 'SWITCH'
            ? { ...c, properties: { ...c.properties, closed: !c.properties.closed } } 
            : c
        )
      };

    case 'SET_SIMULATION_RESULTS':
      return { ...state, simulationResults: action.payload };

    case 'TOGGLE_SIMULATION':
      return { ...state, isSimulating: !state.isSimulating };

    case 'LOAD_CIRCUIT':
      return { ...initialState, ...action.payload };

    case 'CLEAR_CIRCUIT':
      return { ...initialState };

    default:
      return state;
  }
}
