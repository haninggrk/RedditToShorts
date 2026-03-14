import { NextResponse } from 'next/server';
import { getThreadWithComments } from '@/lib/reddit';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Thread ID is required' },
        { status: 400 }
      );
    }
    
    const threadData = await getThreadWithComments(id, 50);
    return NextResponse.json(threadData);
  } catch (error) {
    console.error('Error fetching thread:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch thread details' },
      { status: 500 }
    );
  }
}
