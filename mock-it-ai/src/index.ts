import express, { type Request, type Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const TARGET_URL = process.env.TARGET_URL || 'http://localhost:8080'; // Change this to the real backend URL

// We parse json, but ensure proxy still works
app.use(cors());
app.use(morgan('dev'));
app.use(express.json()); 

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateMockResponse(method: string, path: string, query: any, body: any) {
  const prompt = `
You are a smart API mock generator. A frontend application hit a 404 on the backend for the following route:
Method: ${method}
Path: ${path}
Query Parameters: ${JSON.stringify(query)}
Request Body: ${JSON.stringify(body)}

Infer what the requested entity should be based on standard RESTful or GraphQL conventions.
Generate a realistic and comprehensive JSON response for it.
Provide ONLY valid JSON as your output. No markdown formatting, just the raw JSON.
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    return content ? JSON.parse(content) : { error: "Failed to generate mock (empty content)" };
  } catch (error) {
    console.error("OpenAI Error computing mock:", error);
    return { error: "Mock generation failed due to an error" };
  }
}

// Ensure the proxy can read the body if it was parsed by express.json()
// https://github.com/chimurai/http-proxy-middleware/issues/40#issuecomment-249430255
const fixRequestBody = (proxyReq: any, req: any) => {
  if (req.body && Object.keys(req.body).length > 0) {
    const bodyData = JSON.stringify(req.body);
    proxyReq.setHeader('Content-Type', 'application/json');
    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
    proxyReq.write(bodyData);
  }
};

const apiProxy = createProxyMiddleware({
  target: TARGET_URL,
  changeOrigin: true,
  selfHandleResponse: true, 
  on: {
    proxyReq: fixRequestBody,
    // intercept the response to check for 404
    proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
      // If the target responds with 404 Not Found, generate a mock
      if (proxyRes.statusCode === 404) {
        console.log(`[Mock-It-AI] Intercepted 404 for ${req.method} ${req.url}. Generating mock...`);
        
        const mockData = await generateMockResponse(
          req.method || 'GET',
          req.url || '/',
          (req as any).query,
          (req as any).body
        );

        res.statusCode = 200;
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.setHeader('x-mock-it-generated', 'true');
        
        return JSON.stringify(mockData, null, 2);
      }

      // Allow 200s, 500s, etc., to pass through unmodified
      return responseBuffer;
    })
  }
});

app.use('/api', apiProxy);

// Fallback health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    name: 'Mock-It-AI Proxy',
    status: 'ok',
    target: TARGET_URL,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Mock-It-AI Proxy running on http://localhost:${PORT}`);
  console.log(`📡 Proxying /api traffic to ${TARGET_URL}`);
  console.log(`🧠 AI Interception is ENABLED for 404s calls`);
  console.log(`Make a request to http://localhost:${PORT}/api/some/missing/endpoint to test it.\n`);
});
