const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const fs = require('fs');
const crypto = require('crypto');

// ─── AI Providers ─────────────────────────────────────────────────────────────
const deepseekProvider = require('./ai-deepseek');
const ollamaProvider   = require('./ai-ollama');

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

// ─── SSE: in-memory connection registry ──────────────────────────────────────
// sseClients: Map<trackId, Set<res>>
const sseClients = new Map();

function sseSubscribe(trackId, res) {
  if (!sseClients.has(trackId)) sseClients.set(trackId, new Set());
  sseClients.get(trackId).add(res);
}

function sseUnsubscribe(trackId, res) {
  const set = sseClients.get(trackId);
  if (set) { set.delete(res); if (set.size === 0) sseClients.delete(trackId); }
}

function sseEmit(trackId, event, data) {
  const set = sseClients.get(trackId);
  if (!set || set.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try { res.write(payload); } catch (_) {}
  }
  logMessage(`[SSE] emitted '${event}' to ${set.size} listener(s) for ${trackId}`);
}

// Database is handled via db module


const AI_PROVIDER = process.env.AI_PROVIDER || 'deepseek';

// Delivery times from environment variables
const DELIVERY_MIN_DAYS = parseInt(process.env.DELIVERY_MIN_DAYS) || 3;
const DELIVERY_MAX_DAYS = parseInt(process.env.DELIVERY_MAX_DAYS) || 5;

// AI clients are initialised inside their respective provider modules.

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
      description: 'Search products by keyword. IMPORTANT: The product catalog is in ENGLISH. Always translate queries to English before searching. For example: "auriculares" → "headphones", "reloj" → "watch", "teléfono" → "phone". Use this when the user asks about a specific product, category, or similar items to an out-of-stock product.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search keywords in ENGLISH (e.g. "wireless headphones", "watch", "smartphone"). NEVER use Spanish words — always translate first.' },
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
          product_id: { type: 'string', description: 'The ID of the product (e.g. "p3"). MUST be the exact id from list_products or search_products.' },
          product_name: { type: 'string', description: 'The name of the product (e.g. "Smart Watch"). Used as a fallback if product_id lookup fails.' },
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
    // Normalize aliases: AI sometimes leaks DSML with 'customer_*' instead of 'client_*'
    const product_id    = args.product_id;
    const client_name   = args.client_name   || args.customer_name   || args.name;
    const client_address= args.client_address|| args.customer_address|| args.address;
    const client_phone  = args.client_phone  || args.customer_phone  || args.phone;

    // Validate basics
    if (!product_id || !client_name || !client_address || !client_phone) {
      return JSON.stringify({ error: "Missing required fields", received_keys: Object.keys(args) });
    }
    
    let product = await db.getProductById(product_id);
    // Fallback: if the AI hallucinated a wrong ID, try to find by product_name
    if (!product && args.product_name) {
      const fallbackResults = await db.searchProducts(args.product_name, 1, 0);
      if (fallbackResults && fallbackResults.length > 0) {
        product = fallbackResults[0];
        logMessage(`[create_order] product_id "${product_id}" not found — recovered via name search "${args.product_name}": ${product.id} (${product.name})`);
      }
    }
    if (!product) {
      return JSON.stringify({ error: "Product not found", hint: "Use the exact product_id from the search results. Pass product_name as a backup." });
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




// ─── /api/chat endpoint ───────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { messages, language, model } = req.body;
  if (!messages) return res.status(400).json({ error: "messages array required" });

  // Quick Ollama connectivity check
  if (AI_PROVIDER === 'ollama') {
    try {
      await fetch('http://127.0.0.1:11434/', { method: 'GET' });
    } catch (e) {
      return res.status(500).json({ error: "Ollama is not running. Please start Ollama locally." });
    }
  }

  try {
    // Keep only the last 8 messages to save tokens (no system message — each provider adds its own)
    const history = messages.slice(-8);

    logMessage(`--- NEW CHAT REQUEST ---`);
    logMessage(`Provider: ${AI_PROVIDER}`);
    logMessage(`Last User Input: ${history[history.length - 1]?.content}`);

    let finalContent = null;

    if (AI_PROVIDER === 'deepseek') {
      finalContent = await deepseekProvider.chat(history, tools, handleToolCall, logMessage, language, DELIVERY_MIN_DAYS, DELIVERY_MAX_DAYS, model);
    } else {
      finalContent = await ollamaProvider.chat(history, tools, handleToolCall, logMessage, language, DELIVERY_MIN_DAYS, DELIVERY_MAX_DAYS, model);
    }

    if (!finalContent) {
      logMessage(`[WARN] No content returned from provider. Sending fallback.`);
      const fallback = (language === 'Spanish' || language === 'Español')
        ? 'Ocurrió un problema al procesar tu mensaje. Por favor intenta de nuevo.'
        : 'Something went wrong processing your request. Please try again.';
      return res.json({ message: { role: 'assistant', content: fallback } });
    }

    res.json({ message: { role: 'assistant', content: finalContent } });

  } catch (error) {
    logMessage(`ERROR: ${error.message}`);
    res.status(500).json({ error: 'AI Error. ' + error.message });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  const order = await db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(order);
});

// ─── SSE subscription endpoint ────────────────────────────────────────────────
// The chat subscribes here while an order is active.
app.get('/api/orders/:id/events', (req, res) => {
  const trackId = req.params.id;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send a heartbeat immediately so the browser knows the stream is open
  res.write(': connected\n\n');

  sseSubscribe(trackId, res);
  logMessage(`[SSE] client subscribed to ${trackId}`);

  // Keepalive ping every 25 s to prevent proxy timeouts
  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) { clearInterval(ping); }
  }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    sseUnsubscribe(trackId, res);
    logMessage(`[SSE] client disconnected from ${trackId}`);
  });
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

  // Notify any open chat sessions listening for this order
  sseEmit(req.params.id, 'status_updated', { trackId: req.params.id, status });

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

app.get('/api/config', async (req, res) => {
  if (AI_PROVIDER === 'ollama') {
    try {
      const resp = await fetch('http://127.0.0.1:11434/api/tags');
      if (resp.ok) {
        const data = await resp.json();
        const models = data.models.map(m => m.name);
        return res.json({ provider: 'ollama', models: models.length ? models : ['mistral'] });
      }
    } catch (e) {
      logMessage('[CONFIG] Could not fetch ollama models: ' + e.message);
    }
    return res.json({ provider: 'ollama', models: [process.env.OLLAMA_MODEL || 'mistral'] });
  } else {
    return res.json({ provider: 'deepseek', models: ['deepseek-chat'] });
  }
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

  // Notify any open chat sessions listening for this order
  sseEmit(req.params.id, 'order_paid', { trackId: req.params.id, status: finalStatus });

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
