# DevLog AI

DevLog AI is a CLI tool developed to automatically generate Daily Standups and detailed Pull Request descriptions by analyzing your recent git activity. 

It supports both local-first privacy using Ollama and high-quality outputs via the OpenAI API.

## Features
- **Git Integration:** Automatically reads recent commits, branch info, and uncommitted changes.
- **AI Summarization:** Takes the aggregated git data and transforms it into plain English.
- **Privacy First:** If needed, you can use local models like Llama 3 using Ollama. 

## Installation

1. Make sure you have Node.js and npm installed.
2. In the `devlog-ai` directory, install dependencies and build the tool:
   ```bash
   npm install
   npm run build
   npm link
   ```

## Configuration

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Configure your environment variables:
- **`OPENAI_API_KEY`**: Provide your OpenAI key.
- **`AI_PROVIDER`**: Set to `ollama` to use locally hosted `Ollama` models, or leave empty/`openai` to use GPT-3.5-turbo.
- **`OLLAMA_BASE_URL`**: Override if your Ollama instance is not at `http://localhost:11434`.

## Usage

There are two primary ways to run the tool: using `npm start` for local development or using the linked global command `devlog-ai`.

### 1. Running Locally (Development)

You can run the tool directly using the `npm start` command. When passing arguments to the script via npm, remember to include `--` before the arguments.

```bash
# Generate a daily standup
npm start -- standup

# Specify how many days back to look
npm start -- standup --days 3

# Generate a PR description
npm start -- pr
```

### 2. Running as a Global Command

If you ran `npm link` during installation, the tool is linked globally on your system. You can use the `devlog-ai` command from any directory:

```bash
# Generate a daily standup
devlog-ai standup

# Specify how many days back to look
devlog-ai standup --days 3

# Generate a PR description
devlog-ai pr
```
