import { NextResponse } from 'next/server';
import { getTopThreads, getHotThreads } from '@/lib/reddit';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subreddit = searchParams.get('subreddit');
    const sort = searchParams.get('sort') || 'hot';
    const timeframe = searchParams.get('timeframe') || 'day';
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    
    if (!subreddit) {
      return NextResponse.json(
        { error: 'Subreddit parameter is required' },
        { status: 400 }
      );
    }
    
    let threads;
    if (sort === 'top') {
      threads = await getTopThreads(
        subreddit,
        timeframe as 'hour' | 'day' | 'week' | 'month' | 'year' | 'all',
        limit
      );
    } else {
      threads = await getHotThreads(subreddit, limit);
    }
    
    return NextResponse.json({ threads });
  } catch (error) {
    console.error('Error fetching threads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch threads from subreddit' },
      { status: 500 }
    );
  }
}
