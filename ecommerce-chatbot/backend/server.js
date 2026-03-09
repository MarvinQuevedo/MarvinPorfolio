const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');
const { Ollama } = require('ollama');
require('dotenv').config();
const fs = require('fs');
const crypto = require('crypto');

const products = require('./products');

// Configuración de Logging
const logStream = fs.createWriteStream(__dirname + '/chat_debug.log', {flags:'a'});
function logMessage(msg) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${msg}`);
  logStream.write(`[${timestamp}] ${msg}\n`);
}

const app = express();
app.use(cors());
app.use(express.json());

// In-memory DB
const orders = {}; 
// e.g. trackId: { trackId, productId, name, address, phone, status: 'Pending Payment', total: 699 }

const AI_PROVIDER = process.env.AI_PROVIDER || 'deepseek';

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
  {
    type: 'function',
    function: {
      name: 'create_order',
      description: 'Create an order and generate a payment link. Call this only when the user explicitly wants to buy and has provided their name, address, and phone.',
      parameters: {
        type: 'object',
        properties: {
          product_id: { type: 'string', description: 'The ID of the product' },
          client_name: { type: 'string', description: 'The full name of the client' },
          client_address: { type: 'string', description: 'The delivery address' },
          client_phone: { type: 'string', description: 'The phone number' },
        },
        required: ['product_id', 'client_name', 'client_address', 'client_phone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_status',
      description: 'Check the status of an order using its tracking code',
      parameters: {
        type: 'object',
        properties: {
          track_id: { type: 'string', description: 'The tracking code of the order' },
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

function handleToolCall(name, args) {
  if (name === 'create_order') {
    const { product_id, client_name, client_address, client_phone } = args;
    
    // Validate basics
    if (!product_id || !client_name || !client_address || !client_phone) {
      return JSON.stringify({ error: "Missing required fields" });
    }
    
    const product = products.find(p => p.id === product_id);
    if (!product) {
      return JSON.stringify({ error: "Product not found" });
    }

    if (product.inventory <= 0) {
      return JSON.stringify({ error: "Product out of stock" });
    }

    const tId = 'TRK-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    
    orders[tId] = {
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
    const order = orders[track_id];
    if (!order) return JSON.stringify({ error: "Order not found" });
    return JSON.stringify({ success: true, status: order.status, order_details: order });
  }
  if (name === 'update_status') {
    const { track_id, new_status } = args;
    const order = orders[track_id];
    if (!order) return JSON.stringify({ error: "Order not found" });
    order.status = sanitize(new_status);
    order.history.push({ status: order.status, timestamp: Date.now() });
    return JSON.stringify({ success: true, new_status: order.status, message: "Status updated" });
  }
  return JSON.stringify({ error: "Function not found" });
}

const getSystemPrompt = (language = "Spanish") => `
You are a sales assistant for an electronics store.
CRITICAL RULES:
1. NEVER invent products. Available products:
${JSON.stringify(products, null, 2)}
2. BE EXTREMELY CONCISE. When presenting a product, ONLY show its Name and Price. DO NOT write long paragraphs.
3. If the user comes from an ad, check if inventory > 0 internally. If 0, politely say it's out of stock.
4. DO NOT mention stock numbers or how the inventory works.
5. To sell a product, you MUST collect: Full Name, Delivery Address, Phone Number.
   WARNING: DO NOT call the \`create_order\` tool with empty fields. Make sure the user has provided their real name, address, and phone before generating the link.
6. NEVER output raw JSON (like [{"name":"create_order"}...]) in the chat text. ALWAYS use the actual tool calling framework.
7. ONCE YOU HAVE ALL 3 PIECES OF CONCTACT INFO, call the \`create_order\` TOOL natively. Stop chatting and trigger the tool.
8. When the \`create_order\` tool returns the URL, present it clearly to the user.
9. Tell the user the payment link is only valid for 5 minutos.
10. Users can check their order status by providing a tracking code. Use the \`check_status\` tool.
11. Speak in ${language} and be EXTREMELY brief.
`;

app.post('/api/chat', async (req, res) => {
  const { messages, language } = req.body;
  if (!messages) return res.status(400).json({ error: "messages array required" });

  if (AI_PROVIDER === 'ollama') {
    try {
      // Check if Ollama is running
      await fetch('http://127.0.0.1:11434/', { method: 'GET' });
    } catch(e) {
      return res.status(500).json({ error: "Ollama no está corriendo. Por favor inicia Ollama localmente." });
    }
  }

  try {
    // Optimization: Only keep the last 8 messages to save tokens and prevent context loss
    const recentMessages = messages.slice(-8);
    
    const currentMessages = [
      { role: 'system', content: getSystemPrompt(language) },
      ...recentMessages
    ];

    let messageObj;

    if (AI_PROVIDER === 'deepseek') {
      let completion = await openai.chat.completions.create({
        model: DEEPSEEK_MODEL,
        messages: currentMessages,
        tools: tools
      });
      messageObj = completion.choices[0].message;
    } else {
      let response = await ollama.chat({
        model: OLLAMA_MODEL,
        messages: currentMessages,
        tools: tools
      });
      messageObj = response.message;
    }

    logMessage(`--- NEW CHAT REQUEST ---`);
    logMessage(`Provider: ${AI_PROVIDER}`);
    logMessage(`Last User Input: ${recentMessages[recentMessages.length - 1]?.content}`);
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
        
        const toolResult = handleToolCall(functionName, functionArgs);
        logMessage(`<- Tool Result: ${toolResult}`);
        
        if (AI_PROVIDER === 'deepseek') {
          currentMessages.push({
            tool_call_id: toolCallId,
            role: 'tool',
            name: functionName,
            content: toolResult
          });
        } else {
          currentMessages.push({
            role: 'tool',
            name: functionName,
            content: toolResult
          });
        }
      }

      // Get final response from model after tools
      if (AI_PROVIDER === 'deepseek') {
        let completion = await openai.chat.completions.create({
          model: DEEPSEEK_MODEL,
          messages: currentMessages
        });
        messageObj = completion.choices[0].message;
      } else {
        let response = await ollama.chat({
          model: OLLAMA_MODEL,
          messages: currentMessages
        });
        messageObj = response.message;
      }
      logMessage(`Final AI Content Appended: ${messageObj.content}`);
    }

    res.json({ message: { role: messageObj.role || 'assistant', content: messageObj.content } });
  } catch (error) {
    logMessage(`ERROR: ${error.message}`);
    res.status(500).json({ error: "Error en la IA. " + error.message });
  }
});

app.get('/api/orders/:id', (req, res) => {
  const order = orders[req.params.id];
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(order);
});

// Admin Endpoint: Get all orders
app.get('/api/orders', (req, res) => {
  res.json(Object.values(orders));
});

// Admin Endpoint: Update order status directly
app.put('/api/orders/:id/status', (req, res) => {
  const order = orders[req.params.id];
  if (!order) return res.status(404).json({ error: "Order not found" });
  order.status = req.body.status;
  order.history.push({ status: order.status, timestamp: Date.now() });
  res.json({ success: true, order });
});

app.get('/api/products', (req, res) => {
  res.json(products);
});

// Endpoint to simulate payment
app.post('/api/orders/:id/pay', (req, res) => {
  const order = orders[req.params.id];
  if (!order) return res.status(404).json({ error: "Order not found" });
  
  if (order.status !== 'Pending Payment') {
    return res.status(400).json({ error: "Order already processed" });
  }

  // Check 5 minutes expiration
  const elapsed = Date.now() - order.createdAt;
  if (elapsed > 5 * 60 * 1000) {
    order.status = 'Expired';
    return res.status(400).json({ error: "Link expired. Please request a new one." });
  }
  
  const product = products.find(p => p.id === order.productId);
  if (!product || product.inventory <= 0) {
    order.status = 'Out of Stock - Cancelled';
    return res.status(400).json({ error: "Product is no longer available in inventory" });
  }
  
  // Deduct inventory
  product.inventory -= 1;
  order.status = 'Paid / Processing';
  res.json({ success: true, message: "Payment successful. Inventory deducted." });
});

// Endpoint to update tracking
app.post('/api/orders/:id/update-status', (req, res) => {
    const { status } = req.body;
    const order = orders[req.params.id];
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (!status) return res.status(400).json({ error: "Status required" });
    
    order.status = sanitize(status);
    res.json({ success: true, message: "Status updated", order });
});

app.listen(3001, () => {
  console.log("Backend runs on http://localhost:3001");
});
