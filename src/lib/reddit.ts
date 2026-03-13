import Snoowrap from 'snoowrap';
import { getSettings } from './db';

let redditClient: Snoowrap | null = null;
let lastClientId: string | null = null;

export function getRedditClient(): Snoowrap {
  const settings = getSettings();
  
  // Use settings from DB, fall back to env vars
  const clientId = settings.reddit_client_id || process.env.REDDIT_CLIENT_ID || '';
  const clientSecret = settings.reddit_client_secret || process.env.REDDIT_CLIENT_SECRET || '';
  const username = settings.reddit_username || process.env.REDDIT_USERNAME || '';
  const password = settings.reddit_password || process.env.REDDIT_PASSWORD || '';
  
  // Check if credentials are configured
  if (!clientId || !clientSecret) {
    throw new Error('Reddit API credentials not configured. Please add them in Settings.');
  }
  
  // Recreate client if credentials changed
  if (!redditClient || lastClientId !== clientId) {
    redditClient = new Snoowrap({
      userAgent: process.env.REDDIT_USER_AGENT || 'RedditToShorts/1.0.0',
      clientId,
      clientSecret,
      username,
      password,
    });
    
    // Configure to not throw on errors
    redditClient.config({
      requestDelay: 1000,
      continueAfterRatelimitError: true,
      retryErrorCodes: [502, 503, 504, 522],
      maxRetryAttempts: 3,
    });
    
    lastClientId = clientId;
  }
  
  return redditClient;
}

export interface RedditThread {
  id: string;
  title: string;
  author: string;
  selftext: string;
  score: number;
  num_comments: number;
  url: string;
  permalink: string;
  created_utc: number;
  subreddit: string;
}

export interface RedditComment {
  id: string;
  author: string;
  body: string;
  score: number;
  created_utc: number;
  replies?: RedditComment[];
}

export interface ThreadWithComments {
  thread: RedditThread;
  comments: RedditComment[];
}

export async function getTopThreads(
  subreddit: string,
  timeframe: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all' = 'day',
  limit: number = 25
): Promise<RedditThread[]> {
  const reddit = getRedditClient();
  
  const submissions = await reddit.getSubreddit(subreddit).getTop({
    time: timeframe,
    limit,
  });
  
  return submissions.map((submission) => ({
    id: submission.id,
    title: submission.title,
    author: submission.author?.name || '[deleted]',
    selftext: submission.selftext || '',
    score: submission.score,
    num_comments: submission.num_comments,
    url: submission.url,
    permalink: `https://reddit.com${submission.permalink}`,
    created_utc: submission.created_utc,
    subreddit: submission.subreddit.display_name,
  }));
}

export async function getHotThreads(
  subreddit: string,
  limit: number = 25
): Promise<RedditThread[]> {
  const reddit = getRedditClient();
  
  const submissions = await reddit.getSubreddit(subreddit).getHot({ limit });
  
  return submissions.map((submission) => ({
    id: submission.id,
    title: submission.title,
    author: submission.author?.name || '[deleted]',
    selftext: submission.selftext || '',
    score: submission.score,
    num_comments: submission.num_comments,
    url: submission.url,
    permalink: `https://reddit.com${submission.permalink}`,
    created_utc: submission.created_utc,
    subreddit: submission.subreddit.display_name,
  }));
}

function parseComments(comments: any[], depth: number = 0, maxDepth: number = 3): RedditComment[] {
  if (depth >= maxDepth) return [];
  
  return comments
    .filter((comment) => comment.body && comment.author)
    .map((comment) => ({
      id: comment.id,
      author: comment.author?.name || '[deleted]',
      body: comment.body,
      score: comment.score || 0,
      created_utc: comment.created_utc,
      replies: comment.replies?.length
        ? parseComments(comment.replies, depth + 1, maxDepth)
        : [],
    }))
    .sort((a, b) => b.score - a.score);
}

export async function getThreadWithComments(
  threadId: string,
  commentLimit: number = 50
): Promise<ThreadWithComments> {
  const reddit = getRedditClient();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submission: any = await (reddit.getSubmission(threadId).fetch() as Promise<any>);
  const comments = await submission.comments.fetchMore({ amount: commentLimit });
  
  const thread: RedditThread = {
    id: submission.id,
    title: submission.title,
    author: submission.author?.name || '[deleted]',
    selftext: submission.selftext || '',
    score: submission.score,
    num_comments: submission.num_comments,
    url: submission.url,
    permalink: `https://reddit.com${submission.permalink}`,
    created_utc: submission.created_utc,
    subreddit: submission.subreddit.display_name,
  };
  
  return {
    thread,
    comments: parseComments(comments, 0, 3).slice(0, commentLimit),
  };
}

export async function searchSubreddits(query: string, limit: number = 10): Promise<string[]> {
  const reddit = getRedditClient();
  
  const results = await reddit.searchSubreddits({ query, limit });
  
  return results.map((sub) => sub.display_name);
}
