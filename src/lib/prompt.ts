import { ThreadWithComments } from './reddit';

export interface GenerationOptions {
  duration: number;
  target_audience: string;
  tone: string;
  additional_notes: string;
  revision_note: string;
  video_format: 'short' | 'long';
}

export interface Scene {
  transcript: string;
  scene: string;
  image_prompt?: string;
}

export interface GeneratedContent {
  title: string;
  description: string;
  transcript: string;
  scenes: Scene[];
  voice_style: string;
  music_style: string;
  pinned_comment: string;
  thumbnail_prompts: string[];
}

export function formatThreadForPrompt(threadData: ThreadWithComments): string {
  const { thread, comments } = threadData;
  
  // Sort comments by score (highest first) to prioritize most upvoted content
  const sortedComments = [...comments].sort((a, b) => b.score - a.score);
  
  let content = `
## Reddit Thread
**Title:** ${thread.title}
**Author:** u/${thread.author}
**Score:** ${thread.score} upvotes
**Comments:** ${thread.num_comments}

### Original Post:
${thread.selftext || '(No text content - title only post)'}

### Top Comments (sorted by upvotes - higher upvotes = more credible/valuable content):
`;

  sortedComments.slice(0, 20).forEach((comment, index) => {
    content += `
**Comment ${index + 1}** (${comment.score} upvotes) by u/${comment.author}:
${comment.body}
`;
    
    // Include top replies, also sorted by score
    if (comment.replies && comment.replies.length > 0) {
      const sortedReplies = [...comment.replies].sort((a, b) => b.score - a.score);
      sortedReplies.slice(0, 3).forEach((reply) => {
        content += `  > Reply (${reply.score} upvotes) by u/${reply.author}: ${reply.body}\n`;
      });
    }
  });

  return content;
}

export function buildPrompt(threadContent: string, options: GenerationOptions, viralReferences?: { title: string; transcript: string }[]): string {
  const viralSection = viralReferences && viralReferences.length > 0 ? `

## VIRAL REFERENCE TRANSCRIPTS
The following transcripts have been marked as high-performing/viral content. Study their pacing, hooks, tone, structure, and storytelling style. Use them as a STYLE REFERENCE — do NOT copy their content, but emulate what makes them engaging:
${viralReferences.map((ref, i) => `
### Viral Reference ${i + 1}${ref.title ? ` — "${ref.title}"` : ''}
${ref.transcript}`).join('\n')}

**Key instruction:** Analyze how these viral transcripts hook the viewer, build tension, and deliver payoffs. Apply the same techniques to the new script.` : '';

  const isShort = options.video_format === 'short';
  const formatLabel = isShort ? 'YouTube Short (vertical 9:16)' : 'YouTube Long-form Video (horizontal 16:9)';
  const thumbnailResolution = isShort ? 'vertical 9:16 format (1080x1920)' : 'horizontal 16:9 format (1920x1080)';
  const sceneCount = isShort ? '5-10' : '10-25';

  return `You are a creative content writer specializing in YouTube video scripts. Your task is to transform a Reddit thread into an engaging ${formatLabel} video script.

## Context & Settings
- **Target Duration:** ${options.duration} seconds (approximately ${Math.round(options.duration * 2.5)} words)
- **Target Audience:** ${options.target_audience}
- **Desired Tone:** ${options.tone}
${options.additional_notes ? `- **Additional Notes for this video:** ${options.additional_notes}` : ''}
${options.revision_note ? `

## REVISION REQUESTED
**Please incorporate these changes/improvements:**
${options.revision_note}
` : ''}
${viralSection}

## Reddit Thread Content
${threadContent}

## Your Task
Create a ${formatLabel} script based on this Reddit thread. The script should:
1. Hook viewers in the first 3 seconds
2. Tell the story in a clear, engaging way according to the specified tone and target audience
3. **CRITICAL — DEFINITIVE VOICE, NOT A FORUM RECAP:** Do NOT present this as a collection of opinions or forum comments. NEVER use phrases like "one user wrote", "commenters say", "the internet is exploding", "many argue", "some wonder", etc. Instead, SYNTHESIZE the highest-upvoted comments into confident, authoritative statements. Present the information as if YOU are the expert narrator who knows the facts. The viewer should have NO IDEA this came from a discussion forum.
4. **Prioritize highly-upvoted comments as your primary source material** — treat top-voted insights as established facts or strong analytical takes, and weave them into a cohesive narrative. Higher upvotes = more credible content to build your script around.
5. NEVER mention Reddit, users, comments, threads, forums, or any social media source. Tell the story as a standalone, original piece of content — like a news briefing or documentary narration.
## Required Output Format (respond ONLY with valid JSON, no markdown code blocks):
{
  "title": "Catchy title with hashtags (max 100 characters total including hashtags like #reddit #story)",
  "description": "YouTube description with relevant hashtags and keywords (2-3 sentences)",
  "transcript": "The complete narration script ready for text-to-speech (ElevenLabs). Use natural pauses with '...' and emphasis with CAPS for dramatic effect. This should be ${options.duration} seconds when read aloud.",
  "scenes": [
    {
      "transcript": "First segment of the narration",
      "scene": "Description of what visual should appear (e.g., 'Reaction face', 'Text overlay with quote')",
      "image_prompt": "A detailed Gemini image generation prompt for this scene. Only include this field for ~30% of scenes where AI-generated imagery fits well — prefer abstract, illustrative, or dramatic visuals that Gemini can generate well. Omit this field entirely for scenes that work better with real footage."
    },
    {
      "transcript": "Next segment of the narration",
      "scene": "Visual description for this segment (real footage — no image_prompt needed)"
    }
  ],
  "voice_style": "Comma-separated keywords describing the ideal ElevenLabs voice for this content (e.g., 'Deep, Authoritative, Serious' or 'Energetic, Young, Enthusiastic'). Also suggest 1-2 specific ElevenLabs voice agent names the user can search for (e.g., 'Adam', 'Josh', 'Rachel').",
  "music_style": "Comma-separated keywords describing the ideal background music mood/genre (e.g., 'Tense, Cinematic, Dark' or 'Upbeat, Electronic, Energetic'). Also suggest 1-2 specific searchable track names or artists the user can look up.",
  "pinned_comment": "A strategic comment to pin on the uploaded YouTube video for SEO and engagement. Should include relevant keywords, spark discussion, or ask a compelling question related to the content.",
  "thumbnail_prompts": [
    "A detailed image generation prompt for a thumbnail option 1 in ${thumbnailResolution}. Describe the composition, colors, subjects, text overlays, and mood. Should be eye-catching and clickable.",
    "A different thumbnail concept as option 2. Vary the style, angle, or focus from option 1 to give creative alternatives."
  ]
}

Remember:
- The title must be under 100 characters INCLUDING hashtags
- Break the transcript into ${sceneCount} scenes for visual variety
- Make scenes practical and achievable (text overlays, stock footage suggestions)
- For about 30% of scenes, include an "image_prompt" field with a detailed prompt for Gemini image generation in ${thumbnailResolution} — use this for scenes that benefit from AI-generated visuals (abstract concepts, dramatic illustrations, mood imagery). For every scene with an image_prompt, ALSO describe the scene with real footage alternatives in the "scene" field so the user can choose. The other ~70% should rely on real footage/screenshots and should NOT have an image_prompt field.
- The image_prompt should describe the image in detail: subject, composition, colors, style, mood. Keep prompts suitable for Gemini's image generation capabilities.
- The transcript should flow naturally for voice-over narration
- Include dramatic pauses and emphasis for engagement
- Generate exactly 2 thumbnail_prompts as alternative thumbnail concepts for the video in ${thumbnailResolution}`;
}

export function parseGeneratedResponse(text: string): GeneratedContent {
  // Remove markdown code blocks if present
  let jsonText = text;
  if (jsonText.includes('```json')) {
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  } else if (jsonText.includes('```')) {
    jsonText = jsonText.replace(/```\n?/g, '');
  }
  
  const parsed = JSON.parse(jsonText.trim());
  
  // Validate and ensure title is under 100 chars
  if (parsed.title && parsed.title.length > 100) {
    parsed.title = parsed.title.substring(0, 97) + '...';
  }
  
  return {
    title: parsed.title || 'Untitled',
    description: parsed.description || '',
    transcript: parsed.transcript || '',
    scenes: Array.isArray(parsed.scenes) ? parsed.scenes : [],
    voice_style: parsed.voice_style || '',
    music_style: parsed.music_style || '',
    pinned_comment: parsed.pinned_comment || '',
    thumbnail_prompts: Array.isArray(parsed.thumbnail_prompts) ? parsed.thumbnail_prompts : [],
  };
}
