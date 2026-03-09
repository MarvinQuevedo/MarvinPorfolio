const axios = require('axios');

async function askLLM(promptText) {
  try {
    const response = await axios.post('http://127.0.0.1:11434/api/generate', {
      model: 'mistral:7b', // A fast open-source model like mistral or llama3
      prompt: promptText,      stream: false,
      format: "json",
      options: {
        temperature: 0.2, // Low temperature for deterministic logic choices
        num_predict: 150
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
    return JSON.stringify({ action: "MOVE", direction: ["north", "south", "east", "west"][Math.floor(Math.random()*4)] });
  }
}

async function getAgentAction(agent, sight) {
  const context = {
    pos: [agent.x, agent.y],
    sight: sight,
    inv: agent.inventory
  };
  
  const prompt = `You are ${agent.name}. Your type is ${agent.type}.
Your visual context is: ${JSON.stringify(context)}.
Choose ONLY ONE action. Supported actions ONLY:
- {"action": "MOVE", "direction": "north"|"south"|"east"|"west"}
- {"action": "GATHER", "direction": "north"|"south"|"east"|"west"}
- {"action": "TALK", "message": "hello world"}

CRITICAL RULES:
1. Do NOT use action "LOOK". It is forbidden.
2. The sight array tells you objects nearby: {"type": "tree", "dir": "north-east", "dist": 2}.
3. To approach a tree/rock, MOVE towards its "dir" (e.g., if dir is "north-east", MOVE "north" or "east").
4. If "dist": 1 (adjacent) to a "tree" or "rock", YOU MUST use GATHER towards its exact "dir" (north, south, east, or west).
5. If an agent or wall or water is in your path with dist: 1, DO NOT move there.
6. You must respond with ONLY valid JSON code. Do not include markdown or explanations.`;

  const rawResponse = await askLLM(prompt);
  try {
    return JSON.parse(rawResponse);
  } catch (e) {
    console.error("Could not parse LLM payload:", rawResponse);
    return { action: "TALK", message: "My brain is confused." };
  }
}

module.exports = { getAgentAction };
