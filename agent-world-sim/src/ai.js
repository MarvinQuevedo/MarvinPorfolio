const axios = require('axios');
const fs = require('fs');
const path = require('path');
const LOG_FILE = path.join(__dirname, '..', 'data', 'simulation.log');

// Toggle this to switch between Traditional AI and LLM
let USE_TRADITIONAL_AI = true; 

function setTraditionalAIToggle(val) {
    USE_TRADITIONAL_AI = val;
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

async function getAgentAction(agent, sight) {
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

module.exports = { getAgentAction, setTraditionalAIToggle };
