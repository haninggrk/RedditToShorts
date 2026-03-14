import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/db';

export async function GET() {
  try {
    const settings = getSettings();
    const apiKey = settings.gemini_api_key || process.env.GEMINI_API_KEY || '';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key is not configured' },
        { status: 400 }
      );
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Failed to fetch models: ${text}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Filter to models that support generateContent and return a clean list
    const models = (data.models || [])
      .filter((m: { supportedGenerationMethods: string[] }) =>
        m.supportedGenerationMethods?.includes('generateContent')
      )
      .map((m: { name: string; displayName: string; description?: string }) => ({
        id: m.name.replace('models/', ''),
        name: m.displayName,
        description: m.description || '',
      }));

    return NextResponse.json({ models });
  } catch (error) {
    console.error('Error fetching models:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch models' },
      { status: 500 }
    );
  }
}
