import { NextResponse } from 'next/server';
import { getThreadWithComments } from '@/lib/reddit';
import { generateWithGemini } from '@/lib/gemini';
import { generateWithCopilot } from '@/lib/copilot';
import { getSettings, saveGeneratedIdea } from '@/lib/db';
import { GeneratedContent } from '@/lib/prompt';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { threadId, duration, target_audience, tone, additional_notes, revision_note } = body;
    
    if (!threadId) {
      return NextResponse.json(
        { error: 'Thread ID is required' },
        { status: 400 }
      );
    }
    
    // Get settings for defaults and API key
    const settings = getSettings();
    
    // Base generation options
    const baseOptions = {
      duration: duration ?? settings.preferred_duration,
      target_audience: target_audience || settings.target_audience,
      tone: tone || settings.tone,
      additional_notes: additional_notes || '',
      revision_note: revision_note || '',
    };
    
    // Fetch thread with comments
    const threadData = await getThreadWithComments(threadId, 50);
    
    // Generate content using the selected provider
    let generatedContent: GeneratedContent;
    
    if (settings.ai_provider === 'copilot') {
      generatedContent = await generateWithCopilot(threadData, {
        ...baseOptions,
        api_url: settings.copilot_api_url || 'http://localhost:4141',
        model: settings.copilot_model || 'gpt-4.1',
      });
    } else {
      generatedContent = await generateWithGemini(threadData, {
        ...baseOptions,
        api_key: settings.gemini_api_key || process.env.GEMINI_API_KEY || '',
        model: settings.gemini_model || 'gemini-2.5-flash',
      });
    }
    
    // Save to database
    const savedIdea = saveGeneratedIdea({
      subreddit: threadData.thread.subreddit,
      thread_id: threadData.thread.id,
      thread_title: threadData.thread.title,
      title: generatedContent.title,
      description: generatedContent.description,
      transcript: generatedContent.transcript,
      scenes: JSON.stringify(generatedContent.scenes),
      voice_style: generatedContent.voice_style,
      music_style: generatedContent.music_style,
      pinned_comment: generatedContent.pinned_comment,
      thumbnail_prompts: JSON.stringify(generatedContent.thumbnail_prompts),
    });
    
    return NextResponse.json({
      id: savedIdea.id,
      ...generatedContent,
      thread: threadData.thread,
    });
  } catch (error) {
    console.error('Error generating content:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate content' },
      { status: 500 }
    );
  }
}
