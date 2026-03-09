const GRID_SIZE = 20;

class Engine {
  constructor() {
    this.world = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill('grass'));
    
    // Procedural generation: Water lake
    for(let y=8; y<12; y++) {
        for(let x=8; x<13; x++) {
            this.world[y][x] = 'water';
        }
    }
    
    // Procedural generation: Trees and Rocks
    for(let i=0; i<40; i++) {
        let rx = Math.floor(Math.random() * GRID_SIZE);
        let ry = Math.floor(Math.random() * GRID_SIZE);
        if(this.world[ry][rx] === 'grass') this.world[ry][rx] = 'tree';
    }
    for(let i=0; i<20; i++) {
        let rx = Math.floor(Math.random() * GRID_SIZE);
        let ry = Math.floor(Math.random() * GRID_SIZE);
        if(this.world[ry][rx] === 'grass') this.world[ry][rx] = 'rock';
    }

    this.agents = [
      { id: 1, class: 'a1', x: 2, y: 2, name: 'Agent 1', type: 'Lumberjack', inventory: { wood: 0, stone: 0 } },
      { id: 2, class: 'a2', x: 18, y: 17, name: 'Agent 2', type: 'Miner', inventory: { wood: 0, stone: 0 } }
    ];
    this.turn = 0;
  }
  
  getState() {
    return {
      world: this.world,
      agents: this.agents,
      turn: this.turn
    };
  }

  getAgentSight(agent) {
    let sight = [];
    // 5x5 surrounding radius view
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx === 0 && dy === 0) continue;
        let nx = agent.x + dx, ny = agent.y + dy;
        
        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
          let cellType = this.world[ny][nx];
          let otherAgent = this.agents.find(a => a.x === nx && a.y === ny);

          // Build a semantic direction string
          let dirY = dy < 0 ? 'north' : (dy > 0 ? 'south' : '');
          let dirX = dx < 0 ? 'west' : (dx > 0 ? 'east' : '');
          let generalDir = dirY && dirX ? `${dirY}-${dirX}` : (dirY || dirX);
          let dist = Math.abs(dx) + Math.abs(dy); // Manhattan distance
          
          let objType = otherAgent ? 'Agent' : (cellType !== 'grass' ? cellType : null);

          if (objType) {
              sight.push({ type: objType, dir: generalDir, dist: dist });
          }
        }
      }
    }
    // Sort by closest and only return top 4 to save LLM tokens heavily
    return sight.sort((a, b) => a.dist - b.dist).slice(0, 4);
  }

  processAction(agentId, actionObj) {
    let agent = this.agents.find(a => a.id === agentId);
    if (!agent) return false;

    try {
      if (actionObj.action === 'MOVE') {
        let nx = agent.x, ny = agent.y;
        if (actionObj.direction === 'north' || actionObj.direction === 'UP') ny--;
        else if (actionObj.direction === 'south' || actionObj.direction === 'DOWN') ny++;
        else if (actionObj.direction === 'east' || actionObj.direction === 'RIGHT') nx++;
        else if (actionObj.direction === 'west' || actionObj.direction === 'LEFT') nx--;

        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && this.world[ny][nx] !== 'water' && this.world[ny][nx] !== 'wall' && this.world[ny][nx] !== 'tree' && this.world[ny][nx] !== 'rock') {
            let collision = this.agents.find(a => a.x === nx && a.y === ny);
            if (!collision) {
                agent.x = nx;
                agent.y = ny;
                return `Moved to [${nx}, ${ny}]`;
            } else {
                return `Action failed. Collision with another agent.`;
            }
        } else {
          return `Action failed. Cannot move to [${nx}, ${ny}] due to obstacle or boundary.`;
        }
      } else if (actionObj.action === 'GATHER') {
        let nx = agent.x, ny = agent.y;
        if (actionObj.direction === 'north' || actionObj.direction === 'UP') ny--;
        else if (actionObj.direction === 'south' || actionObj.direction === 'DOWN') ny++;
        else if (actionObj.direction === 'east' || actionObj.direction === 'RIGHT') nx++;
        else if (actionObj.direction === 'west' || actionObj.direction === 'LEFT') nx--;

        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
            let targetCell = this.world[ny][nx];
            if (targetCell === 'tree') {
                agent.inventory.wood = (agent.inventory.wood || 0) + 1;
                this.world[ny][nx] = 'grass'; // Chopped down
                return `Gathered +1 wood from [${nx}, ${ny}]`;
            } else if (targetCell === 'rock') {
                agent.inventory.stone = (agent.inventory.stone || 0) + 1;
                this.world[ny][nx] = 'grass'; // Mined
                return `Gathered +1 stone from [${nx}, ${ny}]`;
            } else {
                return `Action failed. Found nothing to gather targeting [${nx}, ${ny}]`;
            }
        } else {
             return `Action failed. Gather direction is out of bounds.`;
        }
      } else if (actionObj.action === 'TALK') {
          return `Said: "${actionObj.message}"`;
      } else {
         return `Action ${actionObj.action} not fully implemented yet or recognized.`;
      }
    } catch(e) {
      return `Action invalid: ${e.message}`;
    }
  }
}

module.exports = Engine;
