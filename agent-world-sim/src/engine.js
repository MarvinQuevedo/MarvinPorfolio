const fs = require('fs');
const path = require('path');

const GRID_SIZE = 20;
const DATA_DIR = path.join(__dirname, '..', 'data');
const SAVE_FILE = path.join(DATA_DIR, 'savegame.json');

class Engine {
  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(SAVE_FILE)) {
      try {
        const savedData = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8'));
        this.world = savedData.world;
        this.agents = savedData.agents;
        this.turn = savedData.turn;
        console.log("Loaded savegame at Turn:", this.turn);
        return;
      } catch(e) {
        console.error("Could not load save file, generating new world.", e);
      }
    }

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
      { id: 1, class: 'a1', x: 2, y: 2, name: 'Agent 1', type: 'Lumberjack', traits: "Greedy, loves wood, dislikes water", mood: "Neutral", inventory: { wood: 0, stone: 0 } },
      { id: 2, class: 'a2', x: 18, y: 17, name: 'Agent 2', type: 'Miner', traits: "Patient, obsessed with stones", mood: "Neutral", inventory: { wood: 0, stone: 0 } }
    ];
    this.turn = 0;
  }

  save() {
    const data = {
      world: this.world,
      agents: this.agents,
      turn: this.turn
    };
    fs.writeFileSync(SAVE_FILE, JSON.stringify(data, null, 2));
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
        
        let dirY = dy < 0 ? 'north' : (dy > 0 ? 'south' : '');
        let dirX = dx < 0 ? 'west' : (dx > 0 ? 'east' : '');
        let generalDir = dirY && dirX ? `${dirY}-${dirX}` : (dirY || dirX);
        let dist = Math.max(Math.abs(dx), Math.abs(dy)); // Chebyshev distance (diagonals are 1 step!)

        if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) {
           sight.push({ type: 'wall', dir: generalDir, dist: dist });
        } else {
          let cellType = this.world[ny][nx];
          let otherAgent = this.agents.find(a => a.x === nx && a.y === ny);
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
        let dir = actionObj.direction || "";
        if (dir.includes('north') || dir.includes('UP')) ny--;
        if (dir.includes('south') || dir.includes('DOWN')) ny++;
        if (dir.includes('east') || dir.includes('RIGHT')) nx++;
        if (dir.includes('west') || dir.includes('LEFT')) nx--;

        if (nx === agent.x && ny === agent.y) {
            agent.mood = "Confused (Invalid Move)";
            return `Action failed. Invalid direction.`;
        }

        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && this.world[ny][nx] !== 'water' && this.world[ny][nx] !== 'wall' && this.world[ny][nx] !== 'tree' && this.world[ny][nx] !== 'rock') {
            let collision = this.agents.find(a => a.x === nx && a.y === ny && a.id !== agent.id);
            if (!collision) {
                agent.x = nx;
                agent.y = ny;
                agent.mood = "Wandering";
                return `Moved to [${nx}, ${ny}]`;
            } else {
                agent.mood = "Annoyed (bumped into someone)";
                return `Action failed. Collision with another agent.`;
            }
        } else {
          agent.mood = "Frustrated (blocked by obstacle)";
          return `Action failed. Cannot move to [${nx}, ${ny}] due to obstacle or boundary.`;
        }
      } else if (actionObj.action === 'GATHER') {
        let nx = agent.x, ny = agent.y;
        let dir = actionObj.direction || "";
        if (dir.includes('north') || dir.includes('UP')) ny--;
        if (dir.includes('south') || dir.includes('DOWN')) ny++;
        if (dir.includes('east') || dir.includes('RIGHT')) nx++;
        if (dir.includes('west') || dir.includes('LEFT')) nx--;

        if (nx === agent.x && ny === agent.y) {
            agent.mood = "Confused (Invalid Gather)";
            return `Action failed. Invalid direction.`;
        }

        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
            let targetCell = this.world[ny][nx];
            if (targetCell === 'tree') {
                agent.inventory.wood = (agent.inventory.wood || 0) + 1;
                this.world[ny][nx] = 'grass'; // Chopped down
                agent.mood = "Happy (Collected wood)";
                
                // Slightly evolve traits
                if (!agent.traits.includes("experienced")) agent.traits += ", experienced";

                return `Gathered +1 wood from [${nx}, ${ny}]`;
            } else if (targetCell === 'rock') {
                agent.inventory.stone = (agent.inventory.stone || 0) + 1;
                this.world[ny][nx] = 'grass'; // Mined
                agent.mood = "Satisfied (Mined stone)";
                return `Gathered +1 stone from [${nx}, ${ny}]`;
            } else {
                agent.mood = "Confused (Gathered nothing)";
                return `Action failed. Found nothing to gather targeting [${nx}, ${ny}]`;
            }
        } else {
             agent.mood = "Confused (Out of bounds)";
             return `Action failed. Gather direction is out of bounds.`;
        }
      } else if (actionObj.action === 'TALK') {
          agent.mood = "Chatty";
          return `Said: "${actionObj.message}"`;
      } else {
        agent.mood = "Idle";
         return `Action ${actionObj.action} not fully implemented yet or recognized.`;
      }
    } catch(e) {
      return `Action invalid: ${e.message}`;
    }
  }
}

module.exports = Engine;
