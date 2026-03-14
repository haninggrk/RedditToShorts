import { NextResponse } from 'next/server';
import { searchSubreddits } from '@/lib/reddit';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }
    
    const subreddits = await searchSubreddits(query, 10);
    return NextResponse.json({ subreddits });
  } catch (error) {
    console.error('Error searching subreddits:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search subreddits' },
      { status: 500 }
    );
  }
}
