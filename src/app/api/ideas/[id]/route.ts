import { NextResponse } from 'next/server';
import { getGeneratedIdeaById, deleteGeneratedIdea, updateGeneratedIdea } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ideaId = parseInt(id, 10);
    
    if (isNaN(ideaId)) {
      return NextResponse.json(
        { error: 'Invalid idea ID' },
        { status: 400 }
      );
    }
    
    const idea = getGeneratedIdeaById(ideaId);
    
    if (!idea) {
      return NextResponse.json(
        { error: 'Idea not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      ...idea,
      scenes: JSON.parse(idea.scenes),
      thumbnail_prompts: idea.thumbnail_prompts ? JSON.parse(idea.thumbnail_prompts) : [],
    });
  } catch (error) {
    console.error('Error fetching idea:', error);
    return NextResponse.json(
      { error: 'Failed to fetch idea' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ideaId = parseInt(id, 10);
    
    if (isNaN(ideaId)) {
      return NextResponse.json(
        { error: 'Invalid idea ID' },
        { status: 400 }
      );
    }
    
    const deleted = deleteGeneratedIdea(ideaId);
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'Idea not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting idea:', error);
    return NextResponse.json(
      { error: 'Failed to delete idea' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ideaId = parseInt(id, 10);
    
    if (isNaN(ideaId)) {
      return NextResponse.json(
        { error: 'Invalid idea ID' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    
    // If scenes is an array, stringify it
    if (body.scenes && Array.isArray(body.scenes)) {
      body.scenes = JSON.stringify(body.scenes);
    }
    
    // If thumbnail_prompts is an array, stringify it
    if (body.thumbnail_prompts && Array.isArray(body.thumbnail_prompts)) {
      body.thumbnail_prompts = JSON.stringify(body.thumbnail_prompts);
    }
    
    const updated = updateGeneratedIdea(ideaId, body);
    
    if (!updated) {
      return NextResponse.json(
        { error: 'Idea not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      ...updated,
      scenes: JSON.parse(updated.scenes),
      thumbnail_prompts: updated.thumbnail_prompts ? JSON.parse(updated.thumbnail_prompts) : [],
    });
  } catch (error) {
    console.error('Error updating idea:', error);
    return NextResponse.json(
      { error: 'Failed to update idea' },
      { status: 500 }
    );
  }
}
