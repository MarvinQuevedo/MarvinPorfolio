# Agent World Sim (Multi-Agent World Simulation)

> [!WARNING]
> This project is an experiment and currently does not work correctly.

## 📌 Overview
This project is a simulation where multiple AI-driven agents (powered by Ollama or lightweight local models) coexist, interact, and have the ability to modify, expand, and improve their environment. The simulation is based on strict, simple rules that govern the physical and logical boundaries of the world to ensure that interactions make sense and remain coherent.

## 🎯 Main Objectives
1. **Multi-Agent Coexistence:** Agents can interact with each other, exchange information or resources, and collaborate (or compete).
2. **World Expansion:** Agents are not just observers; they can propose changes to the map, build logical "structures," or create new environmental rules based on consensus.
3. **Token Efficiency:** The system must operate with minimal token usage. Each agent's context must be serialized in an ultra-compact way, using standardized formats instead of long sentences, and limiting history to avoid overloading the LLM.
4. **Minimalist Visual Representation:** The user interface will be CLI-based or a very simple HTML web page (purist HTML/no heavy frameworks) to represent the grid and world state graphically but lightly.

---

## 📜 World Rules Engine

To help the LLM understand the environment without consuming many tokens, a central server/engine manages a "Rules Engine." Agents do not have total control; they can only request actions.

*   **Space and Inventory:** The world is a 2D grid. An agent can only "see" what is in their adjacent tiles or within their field of vision.
*   **Discrete Actions:** On each tick, an agent must generate a strict JSON selecting a single predefined action:
    *   `MOVE [north/south/east/west]`
    *   `TALK [agent_id] "[short message]"`
    *   `BUILD [structure] [coordinate]`
    *   `GATHER [resource] [coordinate]`
*   **Resource Economy:** To modify or expand the world (e.g., build bridges, walls, or farms), an agent needs resources that they previously had to gather from the map or trade with other agents.
*   **Simulated Laws of Physics:** 
    * They cannot walk through walls or solid structures.
    * They cannot occupy the exact same coordinate if the structure doesn't allow it.
    * All actions require "energy" or take "turns" to prevent a single agent from spamming actions.

---

## 🤖 Architecture and Mechanics

1. **The Rules Engine (Backend / Game Engine):**
   * Written in Go, Node.js, or Python.
   * Maintains the Global World State (map, resources, agent positions).
   * Acts as the judge: validates AI intents. If the AI "hallucinates" trying to teleport, the Engine rejects the action.

2. **The AI / Agent Brain (Local Ollama):**
   * Each agent is defined by a modest base prompt: "You are agent type X, your main goal is Y".
   * Models like `mistral` or `llama3` are used locally.
   * The LLM's response is heavily parsed to extract only the technical action object.

3. **The Interface (Frontend):**
   * A simple `index.html` with CSS Grid and some Vanilla JS.
   * Displays the world visually, agent avatars, and a log of the actions/dialogues they produce.

---

## 🧠 Prompting Strategy for Token Saving

Instead of long descriptive texts, context is delivered to the LLM in a compact format (pseudo-JSON or short XML tags):

**Example from system to agent:**
```json
{"turn":45,"pos":[2,3],"sight":[{"pos":[2,4],"type":"Agent","id":"Bob"},{"pos":[3,3],"type":"Tree"}],"inv":{"wood":2},"status":"OK"}
```

**Instruction to the model:**  
`Based on the context, choose your next action. Reply ONLY with valid JSON:`  
`{"action": "GATHER", "target": [3,3]}`

This way, requests and responses take < 100 tokens.

---

## 🚀 Initial Roadmap
- [ ] **Phase 1: Initial Graphic Engine:** Create a simple backend with a 10x10 grid as the map, and a basic HTML viewer.
- [ ] **Phase 2: LLM Connection:** Develop scripts to connect 2 primitive agents to Ollama and process their standardized responses.
- [ ] **Phase 3: Rules and Interaction:** Enable resource gathering and communication between the 2 agents.
- [ ] **Phase 4: World Expansion:** Enable agents to build new tiles or alter the terrain.
