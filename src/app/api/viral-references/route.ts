import { NextResponse } from 'next/server';
import { getViralReferences, addViralReference, deleteViralReference, getGeneratedIdeaById } from '@/lib/db';

export async function GET() {
  try {
    const refs = getViralReferences();
    return NextResponse.json({ references: refs });
  } catch (error) {
    console.error('Error fetching viral references:', error);
    return NextResponse.json({ error: 'Failed to fetch viral references' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, transcript, idea_id } = body;

    if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
      return NextResponse.json({ error: 'Transcript is required' }, { status: 400 });
    }

    let refTitle = title || '';
    let source: 'marked' | 'manual' = 'manual';

    // If marking an existing idea as viral
    if (idea_id) {
      const idea = getGeneratedIdeaById(idea_id);
      if (!idea) {
        return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
      }
      refTitle = refTitle || idea.title;
      source = 'marked';
    }

    const ref = addViralReference({
      title: refTitle.trim(),
      transcript: transcript.trim(),
      source,
      idea_id: idea_id || undefined,
    });

    return NextResponse.json(ref);
  } catch (error) {
    console.error('Error adding viral reference:', error);
    return NextResponse.json({ error: 'Failed to add viral reference' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '', 10);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const deleted = deleteViralReference(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Reference not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting viral reference:', error);
    return NextResponse.json({ error: 'Failed to delete viral reference' }, { status: 500 });
  }
}
