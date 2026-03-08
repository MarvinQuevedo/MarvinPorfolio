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

You can use the `devlog-ai` command anywhere if you ran `npm link`.

### Generate a Daily Standup
Generates a structured standup report covering "Yesterday I...", "Today I will...", etc.
```bash
devlog-ai standup
```
Optionally, specify how many days back to look:
```bash
devlog-ai standup --days 3
```

### Generate a PR Description
Generates a comprehensive Pull Request description based on your recent activity.
```bash
devlog-ai pr
```
