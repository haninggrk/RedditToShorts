import { ThreadWithComments } from './reddit';
import { GenerationOptions, GeneratedContent, formatThreadForPrompt, buildPrompt, parseGeneratedResponse } from './prompt';

export type { GenerationOptions, GeneratedContent, Scene } from './prompt';

interface CopilotOptions extends GenerationOptions {
  api_url: string;
  model: string;
}

export async function generateWithCopilot(
  threadData: ThreadWithComments,
  options: CopilotOptions,
  viralReferences?: { title: string; transcript: string }[]
): Promise<GeneratedContent> {
  if (!options.api_url) {
    throw new Error('Copilot API URL is not configured. Please add it in Settings.');
  }
  
  const threadContent = formatThreadForPrompt(threadData);
  const prompt = buildPrompt(threadContent, options, viralReferences);

  const baseUrl = options.api_url.replace(/\/+$/, '');
  
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dummy', // copilot-api doesn't need a real token
    },
    body: JSON.stringify({
      model: options.model || 'gpt-4.1',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Copilot API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('No content returned from Copilot API');
  }
  
  try {
    return parseGeneratedResponse(text);
  } catch (error) {
    console.error('Failed to parse Copilot response:', text);
    throw new Error('Failed to parse AI response. Please try again.');
  }
}

export async function listCopilotModels(apiUrl: string): Promise<{ id: string; name: string }[]> {
  const baseUrl = apiUrl.replace(/\/+$/, '');
  
  const response = await fetch(`${baseUrl}/v1/models`, {
    headers: {
      'Authorization': 'Bearer dummy',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.statusText}`);
  }

  const data = await response.json();
  
  return (data.data || []).map((m: { id: string; owned_by?: string }) => ({
    id: m.id,
    name: `${m.id}${m.owned_by ? ` (${m.owned_by})` : ''}`,
  }));
}
