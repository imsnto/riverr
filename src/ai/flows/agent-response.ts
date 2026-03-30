'use server';
/**
 * @fileOverview A flow for generating grounded agent responses.
 *
 * Calls Python AI service for response generation.
 */

export interface ContextChunk {
  title: string;
  text: string;
  url?: string;
}

export interface AgentResponseInput {
  query: string;
  botName: string;
  context: ContextChunk[];
  greetingScript?: string;
}

export interface AgentResponseOutput {
  answer: string;
}

const PYTHON_AI_SERVICE_URL = process.env.NEXT_PUBLIC_PYTHON_AI_SERVICE_URL || 'http://localhost:8000';

export async function agentResponse(input: AgentResponseInput): Promise<AgentResponseOutput> {
  try {
    const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: input.query,
        botName: input.botName,
        context: input.context,
        instruction: input.greetingScript,
      }),
    });

    if (!response.ok) {
      throw new Error(`Python AI service error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      answer: data.answer || '',
    };
  } catch (error) {
    console.error('Agent response generation failed:', error);
    throw error;
  }
}
