const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { Ollama } = require('ollama');

const products = require('./products');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory DB
const orders = {}; 
// e.g. trackId: { trackId, productId, name, address, phone, status: 'Pending Payment', total: 699 }

// Initialize Ollama
const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });
const MODEL_NAME = 'mistral:7b'; // Available locally

const tools = [
  {
    type: 'function',
    function: {
      name: 'get_products',
      description: 'Get the list of products available in the store.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
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
  if (name === 'get_products') {
    return JSON.stringify(products);
  }
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

    const tId = uuidv4().substring(0, 8).toUpperCase();
    
    orders[tId] = {
      trackId: tId,
      productId: product_id,
      name: sanitize(client_name),
      address: sanitize(client_address),
      phone: sanitize(client_phone),
      status: 'Pending Payment',
      amount: product.price
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
    return JSON.stringify({ success: true, new_status: order.status, message: "Status updated" });
  }
  return JSON.stringify({ error: "Function not found" });
}

const SYSTEM_PROMPT = `
You are a helpful sales assistant for an electronics store.
You help users find products, answer questions, and assist in buying.
When asked about products, use the \`get_products\` tool to fetch them, and present them clearly.
If a user wants to buy something, ask for their full name, delivery address, and phone number.
Do not make up fake payment links. Always use the \`create_order\` tool when you have all the user's details to generate a payment link and tracking code.
When you receive the payment link from the tool, present it to the user.
Users can check their order status by providing a tracking code. Use \`check_status\` tool.
Be concise, friendly, and speak in Spanish (since the user spoke in Spanish).
`;

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages) return res.status(400).json({ error: "messages array required" });

  try {
    // Check if Ollama is running
    await fetch('http://127.0.0.1:11434/', { method: 'GET' });
  } catch(e) {
    return res.status(500).json({ error: "Ollama no está corriendo. Por favor inicia Ollama localmente." });
  }

  try {
    const currentMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages
    ];

    let response = await ollama.chat({
      model: MODEL_NAME,
      messages: currentMessages,
      tools: tools
    });

    // Handle tool calls
    if (response.message.tool_calls && response.message.tool_calls.length > 0) {
      currentMessages.push(response.message);
      
      for (const toolCall of response.message.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = toolCall.function.arguments;
        
        console.log(`Calling tool: ${functionName} with args:`, functionArgs);
        
        const toolResult = handleToolCall(functionName, functionArgs);
        
        currentMessages.push({
          role: 'tool',
          name: functionName,
          content: toolResult
        });
      }

      // Get final response from model
      response = await ollama.chat({
        model: MODEL_NAME,
        messages: currentMessages
      });
    }

    res.json({ message: response.message });
  } catch (error) {
    console.error("Chat error:", error);
    // Use fallback model if llama3.2 is not found, try llama3
    res.status(500).json({ error: "Error en la IA. " + error.message });
  }
});

app.get('/api/orders/:id', (req, res) => {
  const order = orders[req.params.id];
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(order);
});

// Endpoint to simulate payment
app.post('/api/orders/:id/pay', (req, res) => {
  const order = orders[req.params.id];
  if (!order) return res.status(404).json({ error: "Order not found" });
  
  order.status = 'Paid / Processing';
  res.json({ success: true, message: "Payment successful" });
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
