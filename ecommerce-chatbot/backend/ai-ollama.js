/**
 * ai-ollama.js
 * Optimized Ollama provider for local models (e.g. mistral, llama3, qwen2.5).
 *
 * Key differences vs DeepSeek:
 *  1. Shorter, more imperative system prompt — avoids overwhelming small models.
 *  2. Agentic loop: keeps calling tools until the model stops asking for them
 *     (up to MAX_TOOL_ROUNDS) before requesting the final plain-text reply.
 *  3. Explicit tool-call guard: before emitting a final reply the model is
 *     reminded not to invent data and to call a tool if it needs information.
 *  4. Robust argument parsing: handles both object and JSON-string arg formats.
 */

const { Ollama } = require('ollama');

const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });

// ─── Config ───────────────────────────────────────────────────────────────────
// Change this to any model you have pulled locally:
//   ollama pull mistral        (7B, good balance)
//   ollama pull llama3         (8B, good tool use)
//   ollama pull qwen2.5:7b     (7B, great tool use)
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL || 'mistral';
const MAX_TOOL_ROUNDS = 5;   // max consecutive tool-call rounds per request
const MAX_RETRIES     = 2;   // retries when response is empty

// ─── Optimized system prompt for local models ─────────────────────────────────
// Keep it SHORT and IMPERATIVE. Small models get confused by long prompts.
const getOllamaSystemPrompt = (language = 'Spanish', deliveryMin = 3, deliveryMax = 5) => `
You are a friendly sales assistant for an online store. Respond ONLY in ${language}.

## CRITICAL RULES — follow EXACTLY:

### Tools — ALWAYS call tools, NEVER invent data
- You NEVER know the catalog in advance. ALWAYS call a tool to get real data.
- User asks about a product → call search_products (translate terms to English first).
- User asks to see all products → call list_products.
- User wants details about a product → call get_product_details.
- User confirms they want to buy → collect Name, Address, Phone, then call create_order.
- User provides a TRK- code → call check_status.
- NEVER make up product names, prices, IDs, or stock. ONLY use tool results.

### Order flow
1. Ask the user for: full name, shipping address, phone number.
2. Once you have all three, call create_order immediately.
3. Use EXACTLY the product_id from the search/list result — never guess.
4. After order is created: tell the user the tracking ID, the payment link,
   and that delivery takes ${deliveryMin}–${deliveryMax} business days.

### Format
- Be brief and warm. Use emojis occasionally.
- After showing a product with a purchase offer, end with:
  (1) Sí, quiero comprarlo  (2) No, gracias
- After any completed process, ask if you can help with something else, ending with:
  (1) Sí  (2) No, gracias

### Inventory
- NEVER say stock count unless inventory ≤ 2. Just skip that info.
- If inventory ≤ 2: add urgency "¡Quedan muy pocas unidades! ⚡"

### Strict prohibitions
- NO raw JSON, tags, or code in replies.
- NO invented data. If you don't know → call a tool to find out.
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseArgs(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

function sanitizeContent(raw) {
  return (raw || '').replace(/<[\s\S]*?>/gi, '').trim();
}

// ─── Main chat function ───────────────────────────────────────────────────────
/**
 * @param {object[]} baseMessages      - system + conversation history
 * @param {object[]} tools             - tool definitions (OpenAI format)
 * @param {Function} handleToolCall    - (name, args) => Promise<string>
 * @param {Function} logMessage        - (msg: string) => void
 * @param {string}   language          - response language
 * @param {number}   deliveryMin
 * @param {number}   deliveryMax
 * @param {string}   modelOverride     - Optional model to use instead of the default
 * @returns {Promise<string>}          - final assistant plain-text reply
 */
async function chat(baseMessages, tools, handleToolCall, logMessage, language, deliveryMin, deliveryMax, modelOverride) {
  // Replace the system message with the Ollama-optimised one
  const systemMsg = { role: 'system', content: getOllamaSystemPrompt(language, deliveryMin, deliveryMax) };
  const historyMessages = baseMessages.filter(m => m.role !== 'system');

  let finalContent = null;
  let attempt = 0;

  while (attempt <= MAX_RETRIES && finalContent === null) {
    if (attempt > 0) {
      logMessage(`[Ollama][RETRY ${attempt}/${MAX_RETRIES}] Retrying...`);
      await new Promise(r => setTimeout(r, 700 * attempt));
    }

    try {
      const currentMessages = [systemMsg, ...historyMessages];

      // ── Agentic tool-call loop ──────────────────────────────────────────────
      let toolRound = 0;
      let lastMessageObj = null;
      const targetModel = modelOverride || OLLAMA_MODEL;

      while (toolRound < MAX_TOOL_ROUNDS) {
        const response = await ollama.chat({
          model: targetModel,
          messages: currentMessages,
          tools,
        });
        lastMessageObj = response.message;

        logMessage(`[Ollama] Round ${toolRound + 1} hasToolCalls=${!!(lastMessageObj.tool_calls?.length > 0)}`);
        logMessage(`[Ollama] Raw Content: ${lastMessageObj.content || '(empty)'}`);

        if (!lastMessageObj.tool_calls || lastMessageObj.tool_calls.length === 0) {
          // No more tool calls — model is ready to respond
          break;
        }

        // Push the assistant message with tool calls
        currentMessages.push(lastMessageObj);

        // Execute each tool call
        for (const toolCall of lastMessageObj.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = parseArgs(toolCall.function.arguments);

          logMessage(`[Ollama] -> Tool: ${functionName}`);
          logMessage(`[Ollama] -> Args: ${JSON.stringify(functionArgs)}`);

          const toolResult = await handleToolCall(functionName, functionArgs);
          logMessage(`[Ollama] <- Result: ${toolResult}`);

          currentMessages.push({
            role: 'tool',
            name: functionName,
            content: toolResult,
          });
        }

        toolRound++;
      }

      // ── Final plain-text response ──────────────────────────────────────────
      // If the last message already has text content (and no tool calls), use it.
      // Otherwise, ask explicitly for a plain-text reply.
      let rawContent = lastMessageObj?.content || '';

      if (!rawContent.trim() || lastMessageObj?.tool_calls?.length > 0) {
        // Ask model to synthesize a reply from tool results
        const currentMsgs = [...(lastMessageObj ? [lastMessageObj] : [])];
        const finalMessages = [
          systemMsg,
          ...historyMessages,
          // include tool results already in currentMessages
          ...currentMsgs,
          {
            role: 'user',
            content: 'Por favor, con base en los resultados de las herramientas, responde al cliente en texto plano. No uses tags ni JSON.',
          },
        ];

        const finalResp = await ollama.chat({
          model: targetModel,
          messages: finalMessages,
        });
        rawContent = finalResp.message?.content || '';
        logMessage(`[Ollama] Final synthesized content: ${rawContent}`);
      } else {
        logMessage(`[Ollama] Final AI Content: ${rawContent}`);
      }

      finalContent = sanitizeContent(rawContent);
      if (!finalContent) { finalContent = null; attempt++; continue; }

    } catch (err) {
      logMessage(`[Ollama][ERROR] ${err.message}`);
      attempt++;
      continue;
    }
  }

  return finalContent;
}

module.exports = { chat, OLLAMA_MODEL };
