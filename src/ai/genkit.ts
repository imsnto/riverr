import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

// Gemini 3 Pro preview is not currently available for generateContent on Gemini API.
// Use a broadly supported default; override anytime via AI_RESPONSE_MODEL.
const DEFAULT_RESPONSE_MODEL = 'googleai/gemini-2.5-pro';
const responseModel = process.env.AI_RESPONSE_MODEL?.trim() || DEFAULT_RESPONSE_MODEL;

export const ai = genkit({
  plugins: [googleAI()],
  model: responseModel,
});
