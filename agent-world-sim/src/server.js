const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Engine = require('./engine.js');
const { getAgentAction } = require('./ai.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

const engine = new Engine();
let autoPlayInterval = null;
let isProcessingTurn = false;
let currentTickDelayMs = 2000; // Target baseline
let tickMetrics = {
    lastTickDuration: 0,
    averageDuration: 0,
    history: []
};

io.on('connection', (socket) => {
  console.log('Client connected');
  // Send initial state upon connection
  socket.emit('stateUpdate', engine.getState());
  socket.emit('log', { msg: '[System] View connected. Current state synchronized.', type: 'log-sys' });

  socket.on('runTick', async () => {
     await runTick(io);
  });

  socket.on('toggleAutoPlay', () => {
      if (autoPlayInterval) {
          clearTimeout(autoPlayInterval);
          autoPlayInterval = null;
          io.emit('log', { msg: `[System] Auto-Play paused.`, type: 'log-sys' });
      } else {
          io.emit('log', { msg: `[System] Auto-Play started (Target: ${currentTickDelayMs}ms). Adjusting dynamically based on LLM load...`, type: 'log-sys' });
          scheduleNextTick();
      }
  });
});

function scheduleNextTick() {
    autoPlayInterval = setTimeout(async () => {
        await runTick(io);
        if (autoPlayInterval !== null) { // if not paused during run
            scheduleNextTick();
        }
    }, currentTickDelayMs);
}

async function runTick(emitter) {
  if (isProcessingTurn) {
    // Drop tick, system is overloaded
    emitter.emit('log', { msg: `[System] Overload! Tick skipped to let LLM catch up.`, type: 'log-sys' });
    // Increase delay slightly to back off
    currentTickDelayMs = Math.min(10000, currentTickDelayMs + 500);
    return;
  }
  isProcessingTurn = true;
  const startTime = Date.now();
  
  engine.turn++;
  emitter.emit('log', { msg: `--- Turn ${engine.turn} ---`, type: 'log-sys' });
  
  // Parallel Processing to save resources and time
  const agentPromises = engine.agents.map(async (agent) => {
      let sight = engine.getAgentSight(agent);
      
      // Update the frontend with current target payloads for debug
      emitter.emit('payloadDebug', { agent: agent.name, payload: { pos: [agent.x, agent.y], sight, inv: agent.inventory } });
      emitter.emit('log', { msg: `[System] Pending LLM decision for ${agent.name}...`, type: 'log-sys' });
      
      let actionObj = await getAgentAction(agent, sight);
      return { agent, actionObj };
  });

  const results = await Promise.all(agentPromises);
  
  for (const { agent, actionObj } of results) {
      let result = engine.processAction(agent.id, actionObj);
      let cssClass = agent.id === 1 ? 'log-agent1' : 'log-agent2';
      emitter.emit('log', { msg: `[${agent.name}] Action: ${JSON.stringify(actionObj)} => ${result}`, type: cssClass });
  }

  const duration = Date.now() - startTime;
  
  // Track metrics and dynamically adjust speed
  tickMetrics.history.push(duration);
  if (tickMetrics.history.length > 5) tickMetrics.history.shift();
  tickMetrics.averageDuration = tickMetrics.history.reduce((a,b)=>a+b, 0) / tickMetrics.history.length;
  tickMetrics.lastTickDuration = duration;

  // Adaptive throttling logic
  // If LLM processes faster than our delay, we could speed up (min 500ms)
  // If LLM processes slower, we must slow our delay to match the load + buffer
  currentTickDelayMs = Math.max(500, Math.floor(tickMetrics.averageDuration * 1.2)); 
  
  emitter.emit('perfUpdate', {
      durationMs: duration,
      avgMs: Math.floor(tickMetrics.averageDuration),
      nextTickTarget: currentTickDelayMs
  });

  emitter.emit('stateUpdate', engine.getState());
  isProcessingTurn = false;
}

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`World Simulator Engine listening on http://localhost:${PORT}`);
});
