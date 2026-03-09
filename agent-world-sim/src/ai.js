const axios = require('axios');
const fs = require('fs');
const path = require('path');
const LOG_FILE = path.join(__dirname, '..', 'data', 'simulation.log');

// Toggle this to switch between Traditional AI and LLM
let USE_TRADITIONAL_AI = false; 
let USE_EVOLUTIONARY_AI = false;
let USE_COMPLEX_AI = true; // The new complex state-machine AI

function setAIToggle(type) {
    USE_TRADITIONAL_AI = type === 'traditional';
    USE_EVOLUTIONARY_AI = type === 'evolutionary';
    USE_COMPLEX_AI = type === 'complex';
}

async function askLLM(promptText) {
  try {
    const response = await axios.post('http://127.0.0.1:11434/api/generate', {
      model: 'mistral:7b',
      prompt: promptText,      
      stream: false,
      options: {
        num_ctx: 128,  // Minimal micro-context! Barely takes memory!
        temperature: 0.5, 
        num_predict: 8, // Only predicting 2-3 characters now.
        stop: ["\n", "Explanation"] // IMMEDIATELY halt compute after 1 line
      }
    });
    return response.data.response;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
       console.error("Local Ollama not running or model not found. Retrying with dummy action.");
    } else {
       console.error("LLM Error:", error.message);
    }
    // Fallback if no connection
    return "MOVE north";
  }
}

async function getTraditionalAgentAction(agent, sight) {
  const dirMap = {
    'north': 'n', 'south': 's', 'east': 'e', 'west': 'w',
    'north-east': 'ne', 'north-west': 'nw', 'south-east': 'se', 'south-west': 'sw'
  };
  const revDirMap = {
    'n': 'north', 's': 'south', 'e': 'east', 'w': 'west',
    'ne': 'north-east', 'nw': 'north-west', 'se': 'south-east', 'sw': 'south-west'
  };

  let allCodes = Object.values(dirMap);
  let wallDirs = sight.filter(s => s.type === 'wall' && s.dist === 1).map(s => dirMap[s.dir]);
  let agentDirs = sight.filter(s => s.type === 'Agent' && s.dist === 1).map(s => dirMap[s.dir]);
  
  let clearDirs = allCodes.filter(d => !wallDirs.includes(d) && !agentDirs.includes(d));
  if (clearDirs.length === 0) clearDirs = ['s']; // safety fallback

  let targetType = agent.type === 'Lumberjack' ? 'tree' : 'rock';
  let targets = sight.filter(s => s.type === targetType);
  
  // 1. If target is adjacent, GATHER it
  let adjacentTarget = targets.find(s => s.dist === 1);
  if (adjacentTarget) {
      return { action: 'GATHER', direction: adjacentTarget.dir };
  }
  
  // 2. If target is visible, move towards it if the path is clear
  if (targets.length > 0) {
      let nearestTarget = targets.sort((a,b) => a.dist - b.dist)[0];
      let targetCode = dirMap[nearestTarget.dir];
      if (clearDirs.includes(targetCode)) {
          return { action: 'MOVE', direction: nearestTarget.dir };
      }
  }

  // 3. Otherwise wander randomly into a clear space
  let randomCode = clearDirs[Math.floor(Math.random() * clearDirs.length)];
  return { action: 'MOVE', direction: revDirMap[randomCode] };
}

// --- Q-LEARNING EVOLUTIONARY ENGINE ---
// Persistent brain between turns
const Q_TABLE = {}; 
const Q_ACTIONS = [
    { action: 'MOVE', direction: 'north' }, { action: 'MOVE', direction: 'south' },
    { action: 'MOVE', direction: 'east' }, { action: 'MOVE', direction: 'west' },
    { action: 'MOVE', direction: 'north-east' }, { action: 'MOVE', direction: 'north-west' },
    { action: 'MOVE', direction: 'south-east' }, { action: 'MOVE', direction: 'south-west' },
    { action: 'GATHER', direction: 'north' }, { action: 'GATHER', direction: 'south' },
    { action: 'GATHER', direction: 'east' }, { action: 'GATHER', direction: 'west' },
    { action: 'GATHER', direction: 'north-east' }, { action: 'GATHER', direction: 'north-west' },
    { action: 'GATHER', direction: 'south-east' }, { action: 'GATHER', direction: 'south-west' }
];

function getQLearningState(agent, sight) {
    const dirMap = { 'north': 'n', 'south': 's', 'east': 'e', 'west': 'w', 'north-east': 'ne', 'north-west': 'nw', 'south-east': 'se', 'south-west': 'sw' };
    let targetType = agent.type === 'Lumberjack' ? 'tree' : 'rock';
    let targets = sight.filter(s => s.type === targetType);
    
    let tDir = 'x';
    let tDist = 0;
    if (targets.length > 0) {
        let nearest = targets.sort((a,b) => a.dist - b.dist)[0];
        tDir = dirMap[nearest.dir] || 'x';
        tDist = nearest.dist === 1 ? 1 : 2;
    }
    
    let walls = sight.filter(s => s.type === 'wall' && s.dist === 1).map(s => dirMap[s.dir]).join('');
    
    return `T:${tDir}${tDist}_W:${walls}`;
}

async function getEvolutionaryAgentAction(agent, sight) {
    if (!Q_TABLE[agent.type]) Q_TABLE[agent.type] = {};
    let qTable = Q_TABLE[agent.type];
    
    let currentState = getQLearningState(agent, sight);
    if (!qTable[currentState]) qTable[currentState] = Array(Q_ACTIONS.length).fill(0);
    
    // 1. Calculate Reward from previous turn
    let reward = -0.1; // base penalty for wasting time
    if (agent.__lastInv) {
        let targetType = agent.type === 'Lumberjack' ? 'wood' : 'stone';
        if (agent.inventory[targetType] > agent.__lastInv[targetType]) {
            reward = 100; // HUGE Reward for successful gathering!
        } else if (agent.__lastPos && agent.x === agent.__lastPos.x && agent.y === agent.__lastPos.y && agent.__lastActionStr && agent.__lastActionStr.includes('MOVE')) {
            reward = -5; // Penalty for bumping into obstacles 
        }
        
        // 2. Update Q-Table (Learn!)
        if (agent.__lastState && agent.__lastActionIdx !== undefined) {
            if (!qTable[agent.__lastState]) {
                qTable[agent.__lastState] = Array(Q_ACTIONS.length).fill(0);
            }
            let lastQ = qTable[agent.__lastState][agent.__lastActionIdx];
            let maxCurrentQ = Math.max(...qTable[currentState]);
            // Q-Learning Formula
            const ALPHA = 0.2; // Learn rate
            const GAMMA = 0.9; // Discount
            qTable[agent.__lastState][agent.__lastActionIdx] = lastQ + ALPHA * (reward + GAMMA * maxCurrentQ - lastQ);
        }
    }
    
    // 3. Select next Action (Epsilon-Greedy approach)
    let epsilon = agent.__epsilon !== undefined ? agent.__epsilon : 0.8; // Start with 80% random exploration
    let actionIdx;
    
    if (Math.random() < epsilon) {
        // Explore: random action
        actionIdx = Math.floor(Math.random() * Q_ACTIONS.length);
    } else {
        // Exploit: use best known action for this state
        let maxQ = Math.max(...qTable[currentState]);
        let bestActions = qTable[currentState].map((q, i) => q === maxQ ? i : -1).filter(i => i !== -1);
        actionIdx = bestActions[Math.floor(Math.random() * bestActions.length)];
    }
    
    // Decay exploration: slowly become smarter and rely on learned table
    agent.__epsilon = Math.max(0.05, epsilon * 0.998); // Slowing epsilon so it learns better
    
    // 4. Save state for next turn's reward check
    agent.__lastState = currentState;
    agent.__lastActionIdx = actionIdx;
    agent.__lastActionStr = Q_ACTIONS[actionIdx].action;
    agent.__lastInv = { wood: agent.inventory.wood || 0, stone: agent.inventory.stone || 0 };
    agent.__lastPos = { x: agent.x, y: agent.y };
    
    return Q_ACTIONS[actionIdx];
}
// --------------------------------------

// --- COMPLEX STATE-MACHINE AI ---
async function getComplexAgentAction(agent, sight) {
    const dirMap = { 'north': 'n', 'south': 's', 'east': 'e', 'west': 'w', 'north-east': 'ne', 'north-west': 'nw', 'south-east': 'se', 'south-west': 'sw' };
    const revDirMap = { 'n': 'north', 's': 'south', 'e': 'east', 'w': 'west', 'ne': 'north-east', 'nw': 'north-west', 'se': 'south-east', 'sw': 'south-west' };

    let allCodes = Object.values(dirMap);
    const obstaclesAtDist1 = sight.filter(s => s.dist === 1 && ['wall', 'Agent', 'shelter', 'tree', 'rock', 'water'].includes(s.type));
    let blockedDirs = obstaclesAtDist1.map(s => dirMap[s.dir] || s.dir);
    
    let clearDirs = allCodes.filter(d => !blockedDirs.includes(d));
    if (clearDirs.length === 0) clearDirs = ['s'];

    // State Management
    if (!agent.__state) agent.__state = "gather";

    // Update State based on inventory
    let wood = agent.inventory.wood || 0;
    let stone = agent.inventory.stone || 0;
    
    if (wood >= 2 && stone >= 1) {
        agent.__state = "build"; // Ready to build shelter!
    } else {
        agent.__state = "gather";
    }

    // Occasional talking if another agent is near
    let otherAgents = sight.filter(s => s.type === 'Agent');
    if (otherAgents.length > 0 && Math.random() < 0.2) {
        const msgs = [
            `I have ${wood} wood and ${stone} stone!`,
            agent.__state === 'build' ? "I'm going to build a shelter!" : "I need more materials.",
            "Hello there, what are you doing?"
        ];
        return { action: 'TALK', message: msgs[Math.floor(Math.random() * msgs.length)] };
    }

    // Execution Logic
    if (agent.__state === "build") {
        // Build anywhere clear that is adjacent
        let buildDir = clearDirs[Math.floor(Math.random() * clearDirs.length)];
        return { action: 'BUILD', direction: revDirMap[buildDir] };
    }

    // Gather State
    let targetType = "tree";
    if (wood >= 2) targetType = "rock"; // I have wood, now I need stone
    if (agent.type === 'Miner' && stone < 1) targetType = "rock";
    if (agent.type === 'Miner' && stone >= 1 && wood < 2) targetType = "tree";

    // Try to find the specific target we need
    let targets = sight.filter(s => s.type === targetType);
    if (targets.length === 0) targets = sight.filter(s => s.type === 'tree' || s.type === 'rock'); // Fallback to anything useful

    if (targets.length > 0) {
        let nearestTarget = targets.sort((a,b) => a.dist - b.dist)[0];
        if (nearestTarget.dist === 1) {
            return { action: 'GATHER', direction: nearestTarget.dir }; 
        } else {
            let tCode = dirMap[nearestTarget.dir] || nearestTarget.dir;
            if (clearDirs.includes(tCode)) {
                return { action: 'MOVE', direction: nearestTarget.dir }; 
            }
            
            // Advanced Pathfinding: We need to move in a direction that reduces distance to target
            // tgt.dir contains words like 'north', 'north-west' etc.
            let goDirs = nearestTarget.dir.split('-'); // e.g. 'north-west' -> ['north', 'west']
            
            // Filter only the sub-directions that are actually clear!
            let clearGoDirs = goDirs.filter(d => clearDirs.includes(dirMap[d] || d));
            
            if (clearGoDirs.length > 0) {
                // Move in one of the clear directions that leads to the target
                let chosenDir = clearGoDirs[Math.floor(Math.random() * clearGoDirs.length)];
                return { action: 'MOVE', direction: chosenDir };
            }
        }
    }

    // Wander randomly to find resources, making sure we pick a TRULY clear direction
    // AVOID ANY direction that isn't explicitly in clearDirs
    let validClearDirs = clearDirs.filter(d => d !== 's' || clearDirs.length === 1);
    
    // Safety check just in case "clearDirs" was manipulated to empty
    if (validClearDirs.length === 0) validClearDirs = ['s'];

    let randomCode = validClearDirs[Math.floor(Math.random() * validClearDirs.length)];
    return { action: 'MOVE', direction: revDirMap[randomCode] || 'south' };
}
// --------------------------------------

async function getAgentAction(agent, sight) {
  if (USE_COMPLEX_AI) {
      try {
        const ts = new Date().toISOString();
        if (agent.__state === 'build') {
             fs.appendFileSync(LOG_FILE, `[${ts}] [COMPLEX AI: ${agent.name}] ESTADO: ¡Intentando construir!\n`);
        } else {
             fs.appendFileSync(LOG_FILE, `[${ts}] [COMPLEX AI: ${agent.name}] ESTADO: Recolectando (${agent.inventory.wood||0}W, ${agent.inventory.stone||0}S)\n`);
        }
      } catch(e) {}
      return await getComplexAgentAction(agent, sight);
  }

  if (USE_EVOLUTIONARY_AI) {
      try {
        const ts = new Date().toISOString();
        fs.appendFileSync(LOG_FILE, `[${ts}] [EVOLUCION Q-LEARNING: ${agent.name}] Aprendiendo... Epsilon(Tasa de exploración): ${(agent.__epsilon||0.8).toFixed(3)}\n`);
      } catch(e) {}
      return await getEvolutionaryAgentAction(agent, sight);
  }
  if (USE_TRADITIONAL_AI) {
      try {
        const ts = new Date().toISOString();
        fs.appendFileSync(LOG_FILE, `[${ts}] [TRADITIONAL AI DEBUG: ${agent.name}] Running CPU-efficient heuristic algorithm\n`);
      } catch(e) {}
      return await getTraditionalAgentAction(agent, sight);
  }

  const dirMap = {
    'north': 'n', 'south': 's', 'east': 'e', 'west': 'w',
    'north-east': 'ne', 'north-west': 'nw', 'south-east': 'se', 'south-west': 'sw'
  };
  let contextStr = sight.map(s => `${s.type}@${dirMap[s.dir] || s.dir}:${s.dist}`).join(',');
  if (!contextStr) contextStr = "empty";

  // Figure out clear directions (no dist:1 walls)
  const allCodes = Object.values(dirMap);
  const wallDirs = sight.filter(s => s.type === 'wall' && s.dist === 1).map(s => dirMap[s.dir]);
  let clearDirs = allCodes.filter(d => !wallDirs.includes(d));
  if (clearDirs.length === 0) clearDirs.push('s'); // safety fallback
  
  // Shuffle clearDirs to prevent the LLM from always picking the first option (North/South bias)
  clearDirs = clearDirs.sort(() => Math.random() - 0.5);

  // Ultra-compressed micro-syntax (Less than 40 tokens!)
  const prompt = `Bot. No chat.
Role:${agent.type}
See:${contextStr}
Valid_Dirs:${clearDirs.join(',')}
Task:If tree/rock dist:1 -> "G <dir>". Else "M <dir>".
Output ONLY Act [M,G] and Dir.
Ex: M ${clearDirs[0]}`;

  const rawResponse = await askLLM(prompt);
  try {
    const ts = new Date().toISOString();
    fs.appendFileSync(LOG_FILE, `[${ts}] [LLM DEBUG: ${agent.name}]\n--- PROMPT ---\n${prompt}\n--- RESPONSE ---\n${rawResponse}\n----------------\n`);
  } catch(e) {}

  // Parse Compressed Micro Syntax
  let text = rawResponse.trim().toUpperCase();
  let parts = text.split(/[\s,]+/); 
  
  // Decrypt Act
  let codeAct = parts.find(p => ['M', 'G'].includes(p)) || "M";
  let act = codeAct === 'G' ? 'GATHER' : 'MOVE';
  
  // Decrypt Direction - must be one of the clearDirs!
  let codeDir = parts.find(p => clearDirs.includes(p.toLowerCase()));
  if (!codeDir) {
      codeDir = clearDirs[Math.floor(Math.random() * clearDirs.length)].toUpperCase();
  }
  const revDirMap = {
      'N': 'north', 'S': 'south', 'E': 'east', 'W': 'west',
      'NE': 'north-east', 'NW': 'north-west', 'SE': 'south-east', 'SW': 'south-west'
  };
  let dir = revDirMap[codeDir];

  // Interceptor Safety Override: Prevent infinite collision loops
  if (act === 'MOVE' && dir) {
       const obstacle = sight.find(s => s.dist === 1 && s.dir === dir);
       if (obstacle) {
           if (obstacle.type === 'wall' || obstacle.type === 'Agent') {
               // Instead of bouncing directly backward (which causes 1-step oscillations), 
               // pick a random clear direction
               const oldDir = dir;
               const newCode = clearDirs[Math.floor(Math.random() * clearDirs.length)];
               dir = revDirMap[newCode.toUpperCase()];
               fs.appendFileSync(LOG_FILE, `[SYSTEM OVERRIDE] Hit ${obstacle.type} at ${oldDir}. Deflecting to ${dir}.\n`);
           } else {
               fs.appendFileSync(LOG_FILE, `[SYSTEM OVERRIDE] LLM output M ${codeDir} but dist:1 obstacle '${obstacle.type}' is there. Forced GATHER.\n`);
               act = 'GATHER';
           }
       }
  }

  return { action: act, direction: dir };
}

module.exports = { getAgentAction, setAIToggle };
