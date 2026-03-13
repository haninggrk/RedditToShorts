import { GoogleGenerativeAI } from '@google/generative-ai';
import { ThreadWithComments } from './reddit';
import { GenerationOptions, GeneratedContent, formatThreadForPrompt, buildPrompt, parseGeneratedResponse } from './prompt';

export type { GenerationOptions, GeneratedContent, Scene } from './prompt';

interface GeminiOptions extends GenerationOptions {
  api_key: string;
  model: string;
}

export async function generateWithGemini(
  threadData: ThreadWithComments,
  options: GeminiOptions
): Promise<GeneratedContent> {
  if (!options.api_key) {
    throw new Error('Gemini API key is not configured. Please add it in Settings.');
  }
  
  const genAI = new GoogleGenerativeAI(options.api_key);
  const model = genAI.getGenerativeModel({ model: options.model || 'gemini-2.5-flash' });
  
  const threadContent = formatThreadForPrompt(threadData);
  const prompt = buildPrompt(threadContent, options);

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  
  try {
    return parseGeneratedResponse(text);
  } catch (error) {
    console.error('Failed to parse Gemini response:', text);
    throw new Error('Failed to parse AI response. Please try again.');
  }
}
