# Mock-It-AI

A local, intelligent proxy server that intercepts 404 responses from an under-development backend and instantly generates realistic, dynamic JSON mock responses using AI (OpenAI).

## Problem Solved
Frontend and mobile app developers frequently face bottlenecks when the backend API endpoints they need to consume are not yet implemented or are unstable. Writing static mock data for every endpoint is time-consuming and brittle.

## The Solution
When your frontend makes a request to a non-existent endpoint (e.g., `GET /api/v1/users/45/orders`), this proxy intercepts the 404 response. Instead of failing, it uses AI to infer the requested data structure based on the URL path, HTTP method, and any provided headers/query parameters, instantly generating and returning a realistic JSON mock.

## Setup & Running

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Setup environment variables**:
   Copy `.env.example` to `.env` and fill in your details required.
   ```bash
   cp .env.example .env
   ```
3. **Add your API Key**:
   Set `OPENAI_API_KEY` in the newly created `.env` file to your valid OpenAI API key.
4. **Set your target URL**:
   Set `TARGET_URL` to point to your real but under-development backend API server (e.g., `http://localhost:8080`).

## Running the Proxy

Run the dev server:
```bash
npm run dev
```

Point your frontend environment or Postman to the running proxy port (`http://localhost:3000/api/...`). If the backend returns a 200, it'll pass through as expected. If the backend returns a 404 (Not Found), `Mock-It-AI` will instantly generate a contextual mock response on the fly.

## Future Dashboard UI
Next up: building a Dashboard UI (React/Vite) to view intercepted requests, see generated mocks, and manually override them if needed.
