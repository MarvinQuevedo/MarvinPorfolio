import { OpenAI } from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const provider = process.env.AI_PROVIDER || 'openai';

export async function summarizeWork(gitData: string, format: 'standup' | 'pr'): Promise<string> {
    const prompt = buildPrompt(gitData, format);

    if (provider === 'ollama') {
        const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        try {
            const response = await fetch(`${baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'llama3', // Defaulting to llama3, can be configurable
                    prompt: prompt,
                    stream: false
                })
            });
            const data = await response.json();
            return data.response;
        } catch (error) {
            console.error("Error connecting to Ollama:", error);
            return "Failed to generate summary with Ollama.";
        }
    } else {
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'system', content: 'You are an advanced Git log summarizer.' },
                           { role: 'user', content: prompt }],
            });
            return response.choices[0].message.content || '';
        } catch (error) {
            console.error("Error connecting to OpenAI:", error);
            return "Failed to generate summary with OpenAI.";
        }
    }
}

function buildPrompt(gitData: string, format: 'standup' | 'pr'): string {
    if (format === 'standup') {
        return `
Based on the following git repository activity, generate a concise Daily Standup report.
Format it as:
- Yesterday I:
- Today I will:
- Blockers:

Context clues: Uncommitted changes are what the developer is currently working on ("Today I will" or current tasks). Commits from the past day are what they completed ("Yesterday I"). 

Git Data:
${gitData}
`;
    } else {
        return `
Based on the following git repository activity, generate a comprehensive Pull Request description.
Format it clearly with sections:
- Title
- Description (What is changing and why)
- Key Changes
- Testing Steps (if inferable)

Git Data:
${gitData}
`;
    }
}
