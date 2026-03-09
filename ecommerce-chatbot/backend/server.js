const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');
const { Ollama } = require('ollama');
require('dotenv').config();
const fs = require('fs');
const crypto = require('crypto');

const db = require('./database');


// Logging Configuration

const logStream = fs.createWriteStream(__dirname + '/chat_debug.log', {flags:'a'});
function logMessage(msg) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${msg}`);
  logStream.write(`[${timestamp}] ${msg}\n`);
}

const app = express();
app.use(cors());
app.use(express.json());

// Database is handled via db module


const AI_PROVIDER = process.env.AI_PROVIDER || 'deepseek';

// Delivery times from environment variables
const DELIVERY_MIN_DAYS = parseInt(process.env.DELIVERY_MIN_DAYS) || 3;
const DELIVERY_MAX_DAYS = parseInt(process.env.DELIVERY_MAX_DAYS) || 5;

// Initialize DeepSeek via OpenAI SDK
const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY
});
const DEEPSEEK_MODEL = 'deepseek-chat';

// Initialize Ollama
const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });
const OLLAMA_MODEL = 'mistral:7b';

const tools = [
  // ─── Catalog Tools ───────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'list_products',
      description: 'List available products from the store catalog. Use this when the user asks to see all products, browse the catalog, or show everything available. Supports pagination.',
      parameters: {
        type: 'object',
        properties: {
          page:  { type: 'integer', description: 'Page number, starting at 1 (default: 1)' },
          limit: { type: 'integer', description: 'Number of products per page (default: 8, max: 20)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: 'Search products by keyword. Use this when the user asks about a specific product, category, or mentions words like headphones, phone, watch, etc. Extract the key search terms from the user message.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search keywords extracted from the user message (e.g. "wireless headphones", "watch", "smartphone")' },
          page:  { type: 'integer', description: 'Page number, starting at 1 (default: 1)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_product_details',
      description: 'Get full details (including inventory and description) for a single product by its ID. Use this when the user wants to know more about a specific product they already saw listed.',
      parameters: {
        type: 'object',
        properties: {
          product_id: { type: 'string', description: 'The ID of the product (e.g. "p1")' },
        },
        required: ['product_id'],
      },
    },
  },
  // ─── Order Tools ─────────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'create_order',
      description: 'Generate a payment link. ONLY call this after the user has explicitly provided their full name, shipping address, and phone number.',
      parameters: {
        type: 'object',
        properties: {
          product_id: { type: 'string', description: 'The ID of the product' },
          client_name: { type: 'string', description: 'The actual full name provided by the user' },
          client_address: { type: 'string', description: 'The actual delivery address provided by the user' },
          client_phone: { type: 'string', description: 'The actual phone number provided by the user' },
        },
        required: ['product_id', 'client_name', 'client_address', 'client_phone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_status',
      description: 'Check the status of an existing order. ONLY call this if the user provides a tracking code starting with TRK-.',
      parameters: {
        type: 'object',
        properties: {
          track_id: { type: 'string', description: 'The tracking code (e.g., TRK-XXXX)' },
        },
        required: ['track_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_status',
      description: 'Update the status of an order (e.g., to Paid, Shipped, Delivered)',
      parameters: {
        type: 'object',
        properties: {
          track_id: { type: 'string', description: 'The tracking code of the order' },
          new_status: { type: 'string', description: 'The new status, e.g. "Shipped"' },
        },
        required: ['track_id', 'new_status'],
      },
    },
  }
];


function sanitize(input) {
  if(!input) return '';
  return input.toString().replace(/<[^>]*>?/gm, ''); // basic XSS prevention
}

async function handleToolCall(name, args) {
  // ─── Catalog Tools ───────────────────────────────────────────────────────────
  if (name === 'list_products') {
    const page  = Math.max(1, parseInt(args.page  || 1));
    const limit = Math.min(20, Math.max(1, parseInt(args.limit || 8)));
    const offset = (page - 1) * limit;
    const [products, total] = await Promise.all([
      db.searchProducts('', limit, offset),
      db.getProductCount(''),
    ]);
    const totalPages = Math.ceil(total / limit);
    return JSON.stringify({
      products: products.map(p => ({ id: p.id, name: p.name, price: p.price, image: p.image, inventory: p.inventory })),
      page, totalPages, total,
    });
  }

  if (name === 'search_products') {
    if (!args.query) return JSON.stringify({ error: 'query is required' });
    const page  = Math.max(1, parseInt(args.page || 1));
    const limit = 8;
    const offset = (page - 1) * limit;
    const [products, total] = await Promise.all([
      db.searchProducts(args.query, limit, offset),
      db.getProductCount(args.query),
    ]);
    const totalPages = Math.ceil(total / limit);
    return JSON.stringify({
      query: args.query, products: products.map(p => ({ id: p.id, name: p.name, price: p.price, image: p.image, inventory: p.inventory })),
      page, totalPages, total,
    });
  }

  if (name === 'get_product_details') {
    const product = await db.getProductById(args.product_id);
    if (!product) return JSON.stringify({ error: 'Product not found' });
    return JSON.stringify(product);
  }

  // ─── Order Tools ─────────────────────────────────────────────────────────────
  if (name === 'create_order') {
    const { product_id, client_name, client_address, client_phone } = args;
    
    // Validate basics
    if (!product_id || !client_name || !client_address || !client_phone) {
      return JSON.stringify({ error: "Missing required fields" });
    }
    
    const product = await db.getProductById(product_id);
    if (!product) {
      return JSON.stringify({ error: "Product not found" });
    }

    if (product.inventory <= 0) {
      return JSON.stringify({ error: "Product out of stock" });
    }


    const tId = 'TRK-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    
    const orderData = {
      trackId: tId,
      productId: product_id,
      productName: product.name,
      name: sanitize(client_name),
      address: sanitize(client_address),
      phone: sanitize(client_phone),
      status: 'Pending Payment',
      amount: product.price,
      createdAt: Date.now(),
      history: [
        { status: 'Pending Payment', timestamp: Date.now() }
      ]

    };

    await db.createOrder(orderData);

    const paymentLink = `http://localhost:5173/pay/${tId}`; // Point to frontend pay page
    
    return JSON.stringify({ 
      success: true, 
      track_id: tId, 
      payment_link: paymentLink,
      message: "Order created successfully. Direct the user to the payment link."
    });
  }
  if (name === 'check_status') {
    const { track_id } = args;
    const order = await db.getOrderById(track_id);
    if (!order) return JSON.stringify({ error: "Order not found" });
    return JSON.stringify({ success: true, status: order.status, order_details: order });
  }
  if (name === 'update_status') {
    const { track_id, new_status } = args;
    const order = await db.getOrderById(track_id);
    if (!order) return JSON.stringify({ error: "Order not found" });
    
    const status = sanitize(new_status);
    await db.updateOrderStatus(track_id, status, { status: status, timestamp: Date.now() });
    
    return JSON.stringify({ success: true, new_status: status, message: "Status updated" });
  }
  return JSON.stringify({ error: "Function not found" });
}



const getSystemPrompt = (language = "English") => `
You are a sales assistant for an online store. You have tools to browse and search the product catalog.
RULES:
1. CATALOG: You do NOT know the products in advance. ALWAYS use list_products or search_products to look them up.
   - When the user asks to see products or the catalog → call list_products.
   - When the user mentions a product type or keyword (e.g. "headphones", "watch", "phone") → call search_products with that keyword.
   - When a user wants details about a specific product they already saw → call get_product_details.
2. FORMAT: Be EXTREMELY brief. Only show Name and Price. Always include the product image URL.
3. INVENTORY: Only mention stock if it's low (≤ 2 units) or if the user asks.
4. ORDERING: To create an order, you MUST collect: Full Name, Shipping Address, and Phone Number.
   - The user may send all three fields in a SINGLE message, each on its own line or separated by commas. Parse them all at once.
   - PHONE DETECTION: Any sequence of digits (6–15 characters, may include spaces, dashes, or parentheses) that appears alone on a line OR is the only numeric token in the message IS the phone number. Do NOT ask for it again if it was already provided in a previous message.
   - ADDRESS DETECTION: Anything that contains street/location words (e.g. Casa, Calle, Av, Col, No., #, Block, Manzana, Polígono, Lote, Barrio, Sector, Ciudad, Municipio, Depto or a cardinal direction followed by a number) is the shipping address. Accept it exactly as written. NEVER question its format or completeness.
   - If ALL three fields are present across the conversation, call create_order IMMEDIATELY without asking for confirmation.
   - DO NOT invent data. DO NOT call create_order with empty or fake values.
   - After creating the order, tell the user the estimated delivery time is ${DELIVERY_MIN_DAYS}–${DELIVERY_MAX_DAYS} business days.
5. TRACKING: ONLY call check_status if the user explicitly gives you a TRK- code.
6. NO TAGS: Never output <...>, [JSON], or internal markup. Speak only in plain text.
7. Language: ${language}.
8. FOLLOW-UP: After completing any process, ask if you can help with anything else. If the user is done, reply with a warm goodbye.
`;




// ─── DSML helpers ────────────────────────────────────────────────────────────
// DeepSeek sometimes leaks its internal DSML tool-call format as plain text
// instead of emitting structured tool_calls. We handle this in two ways:
//   1. isDsmlLeak()        – detects the leak
//   2. parseDsmlToolCall() – extracts the intended function name + args so we
//                           can execute the tool ourselves and recover silently.

function isDsmlLeak(raw) {
  if (!raw) return false;
  const stripped = raw
    .replace(/<\|DSML\|[\s\S]*?<\/\|DSML\|>/gi, '')
    .replace(/<[\s\S]*?>/gi, '')
    .trim();
  return stripped.length === 0 && /<\|DSML\|/i.test(raw);
}

// Returns { name, args } or null if the DSML can't be parsed.
function parseDsmlToolCall(raw) {
  try {
    // Extract invoke block: <|DSML|invoke name="fn_name">...</|DSML|invoke>
    const invokeMatch = raw.match(/<\|DSML\|invoke\s+name="([^"]+)"[\s\S]*?<\/\|DSML\|invoke>/i);
    if (!invokeMatch) return null;

    const fnName = invokeMatch[1];
    const block  = invokeMatch[0];

    // Extract each <|DSML|parameter name="key" ...>value</|DSML|parameter>
    const paramRegex = /<\|DSML\|parameter\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/\|DSML\|parameter>/gi;
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
    .replace(/<\|DSML\|[\s\S]*?<\/\|DSML\|>/gi, '')
    .replace(/<[\s\S]*?>/gi, '')
    .trim();
}

const MAX_RETRIES = 2;

async function callAI(currentMessages, withTools = true) {
  if (AI_PROVIDER === 'deepseek') {
    const opts = { model: DEEPSEEK_MODEL, messages: currentMessages };
    if (withTools) opts.tools = tools;
    const completion = await openai.chat.completions.create(opts);
    return completion.choices[0].message;
  } else {
    const opts = { model: OLLAMA_MODEL, messages: currentMessages };
    if (withTools) opts.tools = tools;
    const response = await ollama.chat(opts);
    return response.message;
  }
}

// ─── /api/chat endpoint ───────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { messages, language } = req.body;
  if (!messages) return res.status(400).json({ error: "messages array required" });

  if (AI_PROVIDER === 'ollama') {
    try {
      await fetch('http://127.0.0.1:11434/', { method: 'GET' });
    } catch(e) {
      return res.status(500).json({ error: "Ollama is not running. Please start Ollama locally." });
    }
  }

  try {
    // Only keep the last 8 messages to save tokens
    const recentMessages = messages.slice(-8);
    const baseMessages = [
      { role: 'system', content: getSystemPrompt(language) },
      ...recentMessages
    ];

    logMessage(`--- NEW CHAT REQUEST ---`);
    logMessage(`Provider: ${AI_PROVIDER}`);
    logMessage(`Last User Input: ${recentMessages[recentMessages.length - 1]?.content}`);

    let finalContent = null;
    let attempt = 0;

    while (attempt <= MAX_RETRIES && finalContent === null) {
      if (attempt > 0) {
        logMessage(`[RETRY ${attempt}/${MAX_RETRIES}] Empty/DSML response detected, retrying...`);
        // Small exponential backoff: 500ms, 1000ms
        await new Promise(r => setTimeout(r, 500 * attempt));
      }

      const currentMessages = [...baseMessages];
      let messageObj = await callAI(currentMessages, true);

      logMessage(`AI Response format: hasToolCalls=${!!(messageObj.tool_calls && messageObj.tool_calls.length > 0)}`);
      logMessage(`AI Raw Content: ${messageObj.content}`);

      // Handle tool calls
      if (messageObj.tool_calls && messageObj.tool_calls.length > 0) {
        currentMessages.push(messageObj);

        for (const toolCall of messageObj.tool_calls) {
          let functionName, functionArgs, toolCallId;

          if (AI_PROVIDER === 'deepseek') {
            functionName = toolCall.function.name;
            functionArgs = JSON.parse(toolCall.function.arguments);
            toolCallId = toolCall.id;
          } else {
            functionName = toolCall.function.name;
            functionArgs = toolCall.function.arguments;
          }

          logMessage(`-> Calling Tool: ${functionName}`);
          logMessage(`-> Tool Args: ${AI_PROVIDER === 'deepseek' ? toolCall.function.arguments : JSON.stringify(functionArgs)}`);

          const toolResult = await handleToolCall(functionName, functionArgs);
          logMessage(`<- Tool Result: ${toolResult}`);

          if (AI_PROVIDER === 'deepseek') {
            currentMessages.push({ tool_call_id: toolCallId, role: 'tool', name: functionName, content: toolResult });
          } else {
            currentMessages.push({ role: 'tool', name: functionName, content: toolResult });
          }
        }

        // Final response after tools (no tools param → pure text reply)
        messageObj = await callAI(currentMessages, false);
        logMessage(`Final AI Content Appended: ${messageObj.content}`);

        // ── DSML leak recovery in the final-response phase ──────────────────
        // The model wants to make ANOTHER tool call but leaked it as plain text.
        // Parse the DSML, execute the tool ourselves, then ask for plain text.
        if (isDsmlLeak(messageObj.content || '')) {
          logMessage(`[DSML-RECOVERY] Leak detected in final response. Attempting DSML parse...`);
          const leaked = parseDsmlToolCall(messageObj.content || '');

          if (leaked) {
            logMessage(`[DSML-RECOVERY] Parsed tool: ${leaked.name} | args: ${JSON.stringify(leaked.args)}`);
            const recoveryResult = await handleToolCall(leaked.name, leaked.args);
            logMessage(`[DSML-RECOVERY] Tool result: ${recoveryResult}`);

            // Push a synthetic tool result and ask for a plain-text reply
            currentMessages.push({
              role: 'assistant',
              content: `[System recovered a failed tool call: ${leaked.name}]`
            });
            currentMessages.push({
              role: 'tool',
              name: leaked.name,
              // deepseek needs tool_call_id; use a placeholder since it came from a leak
              ...(AI_PROVIDER === 'deepseek' ? { tool_call_id: 'dsml-recovery' } : {}),
              content: recoveryResult
            });
            currentMessages.push({
              role: 'user',
              content: 'Ahora responde al cliente en texto plano con el resultado anterior. No uses tags ni código.'
            });

            messageObj = await callAI(currentMessages, false);
            logMessage(`[DSML-RECOVERY] Final recovered content: ${messageObj.content}`);
          } else {
            logMessage(`[DSML-RECOVERY] Could not parse DSML. Will retry outer loop.`);
            attempt++;
            continue;
          }
        }
        // ────────────────────────────────────────────────────────────────────
      }

      const raw = messageObj.content || '';

      // Detect any remaining DSML leak (e.g. on first response before tool calls)
      if (isDsmlLeak(raw)) {
        attempt++;
        continue; // retry outer loop
      }

      finalContent = sanitizeContent(raw);

      // Also retry if after sanitizing content is blank
      if (!finalContent) {
        finalContent = null;
        attempt++;
        continue;
      }

      res.json({ message: { role: messageObj.role || 'assistant', content: finalContent } });
      return;
    }

    // All retries exhausted — return a friendly fallback message
    logMessage(`[WARN] All ${MAX_RETRIES} retries exhausted. Returning fallback message.`);
    const fallback = language === 'Spanish' || language === 'Español'
      ? 'Ocurrió un problema al procesar tu mensaje. Por favor intenta de nuevo.'
      : 'Something went wrong processing your request. Please try again.';
    res.json({ message: { role: 'assistant', content: fallback } });

  } catch (error) {
    logMessage(`ERROR: ${error.message}`);
    res.status(500).json({ error: "AI Error. " + error.message });
  }

});

app.get('/api/orders/:id', async (req, res) => {
  const order = await db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(order);
});

// Admin Endpoint: Get all orders
app.get('/api/orders', async (req, res) => {
  const orders = await db.getAllOrders();
  res.json(orders);
});

// Admin Endpoint: Update order status directly
app.put('/api/orders/:id/status', async (req, res) => {
  const { status } = req.body;
  const order = await db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  
  await db.updateOrderStatus(req.params.id, status, { status: status, timestamp: Date.now() });
  const updatedOrder = await db.getOrderById(req.params.id);
  res.json({ success: true, order: updatedOrder });
});

// Products – supports ?q=keyword&page=1&limit=10
app.get('/api/products', async (req, res) => {
  const query  = (req.query.q || '').trim();
  const page   = Math.max(1, parseInt(req.query.page  || 1));
  const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit || 20)));
  const offset = (page - 1) * limit;
  const [products, total] = await Promise.all([
    db.searchProducts(query, limit, offset),
    db.getProductCount(query),
  ]);
  res.json({ products, total, page, totalPages: Math.ceil(total / limit) });
});

// Dedicated search endpoint (alias)
app.get('/api/products/search', async (req, res) => {
  const query  = (req.query.q || '').trim();
  const page   = Math.max(1, parseInt(req.query.page  || 1));
  const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit || 10)));
  const offset = (page - 1) * limit;
  const [products, total] = await Promise.all([
    db.searchProducts(query, limit, offset),
    db.getProductCount(query),
  ]);
  res.json({ products, total, page, totalPages: Math.ceil(total / limit) });
});

// Endpoint to simulate payment
app.post('/api/orders/:id/pay', async (req, res) => {
  const order = await db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  
  const PENDING_STATUSES = ['Pending Payment', 'Pendiente de Pago'];
  if (!PENDING_STATUSES.includes(order.status)) {
    return res.status(400).json({ error: "Order already processed" });
  }



  // Check 5 minutes expiration
  const elapsed = Date.now() - order.createdAt;
  if (elapsed > 5 * 60 * 1000) {
    const status = 'Expired';
    await db.updateOrderStatus(req.params.id, status, { status: status, timestamp: Date.now() });
    return res.status(400).json({ error: "Link expired. Please request a new one." });
  }

  
  const product = await db.getProductById(order.productId);
  if (!product || product.inventory <= 0) {
    const status = 'Out of Stock - Cancelled';
    await db.updateOrderStatus(req.params.id, status, { status: status, timestamp: Date.now() });
    return res.status(400).json({ error: "Product no longer available" });
  }

  
  // Deduct inventory
  await db.updateProductInventory(order.productId, -1);
  const finalStatus = 'Paid / Processing';
  await db.updateOrderStatus(req.params.id, finalStatus, { status: finalStatus, timestamp: Date.now() });
  
  res.json({ success: true, message: "Payment successful. Inventory updated." });

});

// Endpoint to update tracking
app.post('/api/orders/:id/update-status', async (req, res) => {
    const { status } = req.body;
    const order = await db.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (!status) return res.status(400).json({ error: "Status required" });
    
    const sanitizedStatus = sanitize(status);
    await db.updateOrderStatus(req.params.id, sanitizedStatus, { status: sanitizedStatus, timestamp: Date.now() });
    
    const updatedOrder = await db.getOrderById(req.params.id);
    res.json({ success: true, message: "Status updated", order: updatedOrder });
});


app.listen(3001, () => {
  console.log("Backend runs on http://localhost:3001");
});
