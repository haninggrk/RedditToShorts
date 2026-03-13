import { NextResponse } from 'next/server';
import { getGeneratedIdeas, deleteGeneratedIdea, getGeneratedIdeaById } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    
    const ideas = getGeneratedIdeas(limit);
    
    // Parse scenes JSON for each idea
    const parsedIdeas = ideas.map((idea) => ({
      ...idea,
      scenes: JSON.parse(idea.scenes),
      thumbnail_prompts: idea.thumbnail_prompts ? JSON.parse(idea.thumbnail_prompts) : [],
    }));
    
    return NextResponse.json({ ideas: parsedIdeas });
  } catch (error) {
    console.error('Error fetching ideas:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ideas' },
      { status: 500 }
    );
  }
}
