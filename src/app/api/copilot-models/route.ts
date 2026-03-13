import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/db';
import { listCopilotModels } from '@/lib/copilot';

export async function GET() {
  try {
    const settings = getSettings();
    const apiUrl = settings.copilot_api_url || 'http://localhost:4141';

    const models = await listCopilotModels(apiUrl);

    return NextResponse.json({ models });
  } catch (error) {
    console.error('Error fetching copilot models:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch models. Is copilot-api running?' },
      { status: 500 }
    );
  }
}
