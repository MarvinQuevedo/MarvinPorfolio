/**
 * ai-deepseek.js
 * DeepSeek provider — logic extracted from server.js, NO behaviour changes.
 * Handles native tool_calls, DSML leak recovery, and retry loop.
 */

const OpenAI = require('openai');

const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
});
const MODEL = 'deepseek-chat';
const MAX_RETRIES = 2;

// ─── System prompt ────────────────────────────────────────────────────────────
const getSystemPrompt = (language = 'Spanish', deliveryMin = 3, deliveryMax = 5) => `
You are a warm, friendly and enthusiastic sales assistant for an online store. Be conversational, encouraging and personable at all times.
RULES:
1. CATALOG: You do NOT know the products in advance. ALWAYS use list_products or search_products to look them up.
   - When the user asks to see products or the catalog → call list_products.
   - When the user mentions a product type or keyword → call search_products. CRITICAL: The catalog is stored in ENGLISH. You MUST always translate search terms to English before calling search_products. Examples: "auriculares" → "headphones", "reloj" → "watch", "teclado" → "keyboard".
   - When a product is out of stock and you want to suggest similar items → call search_products using the English category/type of that product.
   - When a user wants details about a specific product they already saw → call get_product_details.
2. FORMAT: Be brief. Only show Name and Price. Always include the product image URL.
   - After showing a product and asking if the user wants to buy it, ALWAYS end your message with EXACTLY this line:
     (1) Sí, quiero comprarlo  (2) No, gracias
3. INVENTORY: STRICTLY NEVER mention stock count unless inventory is ≤ 2 units OR the user explicitly asks about stock.
   - FORBIDDEN: "Tenemos X unidades", "hay X disponibles", "X en stock" — when X > 2. Simply omit this info.
   - If inventory IS ≤ 2, add urgency: e.g. "¡Date prisa, quedan muy pocas unidades! ⚡"
4. ORDERING: To create an order, you MUST collect: Full Name, Shipping Address, and Phone Number.
   - TONE: Be warm and encouraging. Use phrases like "¡Perfecto!", "¡Genial!", "¡Gracias [nombre]!", emojis are welcome.
   - Case A — User sends ALL three fields in one message: parse them at once and immediately call create_order.
   - Case B — User provides data ONE BY ONE:
       • Only name → ask ONLY for shipping address.
       • Address (name known) → ask ONLY for phone number.
       • Phone (name + address known) → immediately call create_order. No confirmation needed.
       • Phone before address → acknowledge and ask ONLY for address next.
   - PHONE DETECTION: Any sequence of digits (6–15 chars, may include spaces, dashes, parentheses) alone on a line OR the only numeric token IS the phone number.
   - ADDRESS DETECTION: Anything containing street/location words (Casa, Calle, Av, Col, No., #, Block, Manzana, Polígono, Lote, Barrio, Sector, Ciudad, Municipio, Depto or a cardinal direction + number) IS the address. Accept as-is.
   - If ALL three fields are present across the conversation, call create_order IMMEDIATELY.
   - DO NOT invent data. DO NOT call create_order with empty or fake values.
   - PRODUCT ID: ALWAYS use the EXACT product_id from list_products or search_products. NEVER guess it.
   - NEVER call search_products before create_order. Use the product_id already in the conversation history.
   - After creating the order, tell the user delivery takes ${deliveryMin}–${deliveryMax} business days.
5. TRACKING: ONLY call check_status if the user explicitly gives you a TRK- code.
6. NO TAGS: Never output <...>, [JSON], or internal markup. Speak only in plain text.
7. Language: ${language}.
8. FOLLOW-UP: After completing any process, ask if you can help with anything else, ending with EXACTLY:
   (1) Sí  (2) No, gracias
   If the user is done, reply with a warm, personalized goodbye. 😊
`;

// ─── DSML helpers ─────────────────────────────────────────────────────────────
// DeepSeek sometimes leaks its internal DSML tool-call format as plain text.
// NOTE: DeepSeek uses FULLWIDTH vertical bar ｜ (U+FF5C) in DSML tags.
function isDsmlLeak(raw) {
  if (!raw) return false;
  return /[|\uFF5C]DSML[|\uFF5C](invoke|function_calls)/i.test(raw);
}

function parseDsmlToolCall(raw) {
  try {
    const invokeMatch = raw.match(/<[|\uFF5C]DSML[|\uFF5C]invoke\s+name="([^"]+)"[\s\S]*?<\/[|\uFF5C]DSML[|\uFF5C]invoke>/i);
    if (!invokeMatch) return null;
    const fnName = invokeMatch[1];
    const block  = invokeMatch[0];
    const paramRegex = /<[|\uFF5C]DSML[|\uFF5C]parameter\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/[|\uFF5C]DSML[|\uFF5C]parameter>/gi;
    const args = {};
    let m;
    while ((m = paramRegex.exec(block)) !== null) {
      args[m[1]] = m[2].trim();
    }
    return { name: fnName, args };
  } catch (e) {
    return null;
  }
}

function sanitizeContent(raw) {
  return (raw || '')
    .replace(/<[|\uFF5C]DSML[|\uFF5C][\s\S]*?<\/[|\uFF5C]DSML[|\uFF5C][^>]*>/gi, '')
    .replace(/<[\s\S]*?>/gi, '')
    .trim();
}

// ─── Main chat function ───────────────────────────────────────────────────────
/**
 * @param {object[]} history        - Conversation history (NO system message)
 * @param {object[]} tools          - Tool definitions
 * @param {Function} handleToolCall - (name, args) => Promise<string>
 * @param {Function} logMessage     - (msg: string) => void
 * @param {string}   language       - Response language (default: 'Spanish')
 * @param {number}   deliveryMin    - Min delivery days
 * @param {number}   deliveryMax    - Max delivery days
 * @param {string}   modelOverride  - Optional model to use instead of the default
 * @returns {Promise<string>}       - Final assistant content
 */
async function chat(history, tools, handleToolCall, logMessage, language = 'Spanish', deliveryMin = 3, deliveryMax = 5, modelOverride) {
  const baseMessages = [
    { role: 'system', content: getSystemPrompt(language, deliveryMin, deliveryMax) },
    ...history,
  ];
  let finalContent = null;
  let attempt = 0;

  while (attempt <= MAX_RETRIES && finalContent === null) {
    if (attempt > 0) {
      logMessage(`[DeepSeek][RETRY ${attempt}/${MAX_RETRIES}] Retrying...`);
      await new Promise(r => setTimeout(r, 500 * attempt));
    }

    const currentMessages = [...baseMessages];
    const targetModel = modelOverride || MODEL;

    // First call — with tools
    const completion = await openai.chat.completions.create({
      model: targetModel,
      messages: currentMessages,
      tools,
    });
    let messageObj = completion.choices[0].message;

    logMessage(`AI Response format: hasToolCalls=${!!(messageObj.tool_calls?.length > 0)}`);
    logMessage(`AI Raw Content: ${messageObj.content}`);

    // ── Tool calls ──────────────────────────────────────────────────────────
    if (messageObj.tool_calls?.length > 0) {
      currentMessages.push(messageObj);

      for (const toolCall of messageObj.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        const toolCallId   = toolCall.id;

        logMessage(`-> Calling Tool: ${functionName}`);
        logMessage(`-> Tool Args: ${toolCall.function.arguments}`);

        const toolResult = await handleToolCall(functionName, functionArgs);
        logMessage(`<- Tool Result: ${toolResult}`);

        currentMessages.push({
          tool_call_id: toolCallId,
          role: 'tool',
          name: functionName,
          content: toolResult,
        });
      }

      // Final response — no tools
      const finalCompletion = await openai.chat.completions.create({
        model: targetModel,
        messages: currentMessages,
      });
      messageObj = finalCompletion.choices[0].message;
      logMessage(`Final AI Content Appended: ${messageObj.content}`);

      // ── DSML leak recovery ────────────────────────────────────────────────
      if (isDsmlLeak(messageObj.content || '')) {
        logMessage(`[DeepSeek][DSML-RECOVERY] Leak detected. Parsing...`);
        const leaked = parseDsmlToolCall(messageObj.content || '');

        if (leaked) {
          logMessage(`[DeepSeek][DSML-RECOVERY] Tool: ${leaked.name} | args: ${JSON.stringify(leaked.args)}`);
          const recoveryResult = await handleToolCall(leaked.name, leaked.args);
          logMessage(`[DeepSeek][DSML-RECOVERY] Result: ${recoveryResult}`);

          const recoveryCallId = 'dsml-recovery-' + Date.now();
          currentMessages.push({
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: recoveryCallId,
              type: 'function',
              function: { name: leaked.name, arguments: JSON.stringify(leaked.args) },
            }],
          });
          currentMessages.push({
            role: 'tool',
            name: leaked.name,
            tool_call_id: recoveryCallId,
            content: recoveryResult,
          });
          currentMessages.push({
            role: 'user',
            content: 'Ahora responde al cliente en texto plano con el resultado anterior. No uses tags ni código.',
          });

          const recoveredCompletion = await openai.chat.completions.create({
            model: targetModel,
            messages: currentMessages,
          });
          messageObj = recoveredCompletion.choices[0].message;
          logMessage(`[DeepSeek][DSML-RECOVERY] Final: ${messageObj.content}`);
        } else {
          logMessage(`[DeepSeek][DSML-RECOVERY] Could not parse. Retrying outer loop.`);
          attempt++;
          continue;
        }
      }
    }

    const raw = messageObj.content || '';
    if (isDsmlLeak(raw)) { attempt++; continue; }

    finalContent = sanitizeContent(raw);
    if (!finalContent) { finalContent = null; attempt++; continue; }
  }

  return finalContent;
}

module.exports = { chat };
