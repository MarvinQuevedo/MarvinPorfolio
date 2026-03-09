# e-Commerce Chatbot AI

A modern, dynamic chat web app that connects to a local Node.js server to use AI (Ollama/DeepSeek). The chatbot can list store products, collect user details to generate a simulated payment link, check order status based on a tracking code, and simulate tracking status updates.

## Technologies Used
- **Frontend**: React, Vite, React Router, Lucide Icons, CSS3.
- **Backend**: Node.js, Express, Axios, uuid, SQLite (better-sqlite3).
- **AI**: Ollama (llama 3.2 function calling) or DeepSeek.

## Running the Project

This project assumes you have **Ollama** installed and running with the `llama3.2` model (or `llama3`), or a valid DeepSeek API key in the `.env` file.

### 1. Start the Services
You can use the provided script to start everything:
```bash
./start.sh
```

### 2. Manual Start (Optional)

#### Backend
From the root of the project, enter the backend directory:
```bash
cd backend
npm install
node server.js
```
The Node.js server will start on port 3001.

#### Frontend
In another terminal, run:
```bash
cd frontend
npm install
npm run dev
```
The app will open at `http://localhost:5173`.

## Recommended Test Flow
1. Write in the chat: `"I want to see the available products"`.
2. The bot will use a tool to read the database and list the options.
3. Tell the bot: `"I want to buy Smartphone X. My name is Juan Perez, I live at 123 Fake Street and my phone is 555-0199"`.
4. The bot will create the order and send a **Payment Link**.
5. Click the link, a new tab with the "Simulate Payment" interface will open. Click **Pay**, which will update the order status internally and return success.
6. Close the tab and tell the bot: `"I already paid, what is my tracking code and status?"` or manually go to the route `/track/:your-code`.
7. From the tracking page (`/track/:your-code`), you can view the information and simulate a status update (e.g., from "Paid" to "Shipped").
