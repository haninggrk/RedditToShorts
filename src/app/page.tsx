'use client';

import { useState, useEffect, useCallback } from 'react';

interface RedditThread {
  id: string;
  title: string;
  author: string;
  selftext: string;
  score: number;
  num_comments: number;
  permalink: string;
  subreddit: string;
  created_utc: number;
}

interface GeneratedContent {
  id: number;
  title: string;
  description: string;
  transcript: string;
  scenes: { transcript: string; scene: string; image_prompt?: string; notes?: string }[];
  voice_style?: string;
  music_style?: string;
  pinned_comment?: string;
  thumbnail_prompts?: string[];
  thread: RedditThread;
  youtube_link?: string;
  views?: string;
}

interface Settings {
  preferred_duration: number;
  target_audience: string;
  tone: string;
  additional_preferences: string;
  ai_provider: 'gemini' | 'copilot';
  gemini_api_key: string;
  gemini_model: string;
  copilot_api_url: string;
  copilot_model: string;
  reddit_client_id: string;
  reddit_client_secret: string;
}

interface GenerationOptions {
  duration: number;
  target_audience: string;
  tone: string;
  additional_notes: string;
  video_format: 'short' | 'long';
}

const STORAGE_KEY = 'rty_browse_state';

function loadPersistedState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

export default function Home() {
  const saved = typeof window !== 'undefined' ? loadPersistedState() : null;

  const [subreddit, setSubreddit] = useState(saved?.subreddit ?? '');
  const [searchQuery, setSearchQuery] = useState(saved?.searchQuery ?? '');
  const [subredditSuggestions, setSubredditSuggestions] = useState<string[]>([]);
  const [threads, setThreads] = useState<RedditThread[]>(saved?.threads ?? []);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(saved?.generatedContent ?? null);
  const [sortBy, setSortBy] = useState<'hot' | 'top'>(saved?.sortBy ?? 'hot');
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month' | 'year' | 'all'>(saved?.timeframe ?? 'day');
  const [error, setError] = useState<string | null>(null);
  
  // Generation options modal state
  const [settings, setSettings] = useState<Settings | null>(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [selectedThreadForGeneration, setSelectedThreadForGeneration] = useState<RedditThread | null>(null);
  const [generationOptions, setGenerationOptions] = useState<GenerationOptions>(saved?.generationOptions ?? {
    duration: 60,
    target_audience: '',
    tone: '',
    additional_notes: '',
    video_format: 'short',
  });
  
  // Editing state for generated content
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState<GeneratedContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');
  const [markingViral, setMarkingViral] = useState(false);

  // Viral reference picker state
  const [availableViralRefs, setAvailableViralRefs] = useState<{ id: number; title: string; transcript: string }[]>([]);
  const [selectedViralRefIds, setSelectedViralRefIds] = useState<Set<number>>(new Set());
  const [maxViralRefs, setMaxViralRefs] = useState(10);
  const [loadingViralRefs, setLoadingViralRefs] = useState(false);
  const [viralRefsError, setViralRefsError] = useState<string | null>(null);

  // Persist key state to sessionStorage
  const persistState = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        subreddit,
        searchQuery,
        threads,
        generatedContent,
        sortBy,
        timeframe,
        generationOptions,
      }));
    } catch { /* quota exceeded — ignore */ }
  }, [subreddit, searchQuery, threads, generatedContent, sortBy, timeframe, generationOptions]);

  useEffect(() => { persistState(); }, [persistState]);

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        setSettings(data);
        // Only initialize generation options with settings defaults when no persisted state
        if (!saved) {
          setGenerationOptions({
            duration: data.preferred_duration,
            target_audience: data.target_audience,
            tone: data.tone,
            additional_notes: '',
            video_format: 'short',
          });
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      }
    };
    fetchSettings();
  }, []);

  // Search subreddits
  useEffect(() => {
    const searchSubreddits = async () => {
      if (searchQuery.length < 2) {
        setSubredditSuggestions([]);
        return;
      }
      
      try {
        const res = await fetch(`/api/reddit/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        if (data.error) {
          setError(data.error);
          return;
        }
        setSubredditSuggestions(data.subreddits || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to search subreddits');
      }
    };
    
    const debounce = setTimeout(searchSubreddits, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  // Fetch threads
  const fetchThreads = async () => {
    if (!subreddit) return;
    
    setLoading(true);
    setError(null);
    setThreads([]);
    
    try {
      const params = new URLSearchParams({
        subreddit,
        sort: sortBy,
        timeframe,
        limit: '25',
      });
      
      const res = await fetch(`/api/reddit/threads?${params}`);
      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setThreads(data.threads || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch threads');
    } finally {
      setLoading(false);
    }
  };

  // Fetch viral references for the picker
  const fetchViralRefs = async () => {
    setLoadingViralRefs(true);
    setViralRefsError(null);
    try {
      const [refsRes, settingsRes] = await Promise.all([
        fetch('/api/viral-references'),
        fetch('/api/settings'),
      ]);
      const refsData = await refsRes.json();
      const settingsData = await settingsRes.json();
      if (refsData.error) throw new Error(refsData.error);
      setAvailableViralRefs(refsData.references || []);
      setMaxViralRefs(settingsData.max_viral_references ?? 10);
    } catch (err) {
      setViralRefsError(err instanceof Error ? err.message : 'Failed to load viral references');
    }
    setLoadingViralRefs(false);
  };

  // Open generation options modal
  const openGenerationModal = (thread: RedditThread) => {
    setSelectedThreadForGeneration(thread);
    setSelectedViralRefIds(new Set());
    fetchViralRefs();
    // Reset options to defaults from settings
    if (settings) {
      setGenerationOptions({
        duration: settings.preferred_duration,
        target_audience: settings.target_audience,
        tone: settings.tone,
        additional_notes: '',
        video_format: 'short',
      });
    }
    setShowOptionsModal(true);
  };

  const toggleViralRef = (id: number) => {
    setSelectedViralRefIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < maxViralRefs) {
        next.add(id);
      }
      return next;
    });
  };

  // Generate content for a thread with options
  const generateContent = async () => {
    if (!selectedThreadForGeneration) return;
    
    setShowOptionsModal(false);
    setGenerating(selectedThreadForGeneration.id);
    setError(null);
    
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: selectedThreadForGeneration.id,
          duration: generationOptions.duration,
          target_audience: generationOptions.target_audience,
          tone: generationOptions.tone,
          additional_notes: generationOptions.additional_notes,
          video_format: generationOptions.video_format,
          viral_reference_ids: selectedViralRefIds.size > 0 ? [...selectedViralRefIds] : undefined,
        }),
      });
      
      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setGeneratedContent(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate content');
    } finally {
      setGenerating(null);
      setSelectedThreadForGeneration(null);
    }
  };

  // Open revision modal for regeneration
  const openRevisionModal = () => {
    setRevisionNote('');
    setShowRevisionModal(true);
  };

  // Regenerate content for the current thread
  const regenerateContent = async () => {
    if (!generatedContent) return;
    
    setShowRevisionModal(false);
    setGenerating('regenerating');
    setError(null);
    
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: generatedContent.thread.id,
          duration: generationOptions.duration,
          target_audience: generationOptions.target_audience,
          tone: generationOptions.tone,
          additional_notes: generationOptions.additional_notes,
          video_format: generationOptions.video_format,
          revision_note: revisionNote || undefined,
        }),
      });
      
      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setGeneratedContent(data);
      setEditedContent(null);
      setIsEditing(false);
      setRevisionNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate content');
    } finally {
      setGenerating(null);
    }
  };

  // Save edited content
  const saveEditedContent = async () => {
    if (!editedContent || !generatedContent?.id) return;
    
    setSaving(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/ideas/${generatedContent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editedContent.title,
          description: editedContent.description,
          transcript: editedContent.transcript,
          scenes: editedContent.scenes,
          youtube_link: editedContent.youtube_link,
          views: editedContent.views,
        }),
      });
      
      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setGeneratedContent({ ...generatedContent, ...editedContent });
      setIsEditing(false);
      setEditedContent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Start editing
  const startEditing = () => {
    if (generatedContent) {
      setEditedContent({ ...generatedContent });
      setIsEditing(true);
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditedContent(null);
    setIsEditing(false);
  };

  // Mark as viral
  const markAsViral = async () => {
    if (!generatedContent) return;
    setMarkingViral(true);
    try {
      const res = await fetch('/api/viral-references', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: generatedContent.title,
          transcript: generatedContent.transcript,
          idea_id: generatedContent.id,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      alert('Marked as viral! This transcript will be used as a reference for future generations.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as viral');
    } finally {
      setMarkingViral(false);
    }
  };

  const selectSubreddit = (sub: string) => {
    setSubreddit(sub);
    setSearchQuery(sub);
    setSubredditSuggestions([]);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const formatScore = (score: number) => {
    if (score >= 1000) {
      return `${(score / 1000).toFixed(1)}k`;
    }
    return score.toString();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Browse Reddit Threads</h1>
        <p className="text-gray-400">Search for a subreddit and select threads to generate YouTube video ideas</p>
      </div>
      
      {/* API Configuration Warning */}
      {settings && (!settings.reddit_client_id || !settings.reddit_client_secret) && (
        <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 text-yellow-200">
          <p className="font-medium">⚠️ Reddit API not configured</p>
          <p className="text-sm mt-1">
            Please add your Reddit API credentials in <a href="/settings" className="underline hover:text-yellow-100">Settings</a> to browse subreddits.
          </p>
        </div>
      )}
      
      {/* Search Section */}
      <div className="bg-gray-800 rounded-lg p-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Subreddit Search */}
          <div className="flex-1 relative">
            <label className="block text-sm font-medium text-gray-300 mb-1">Subreddit</label>
            <div className="flex">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-600 bg-gray-700 text-gray-400 text-sm">
                r/
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="search subreddits..."
                className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md bg-gray-700 border border-gray-600 text-white focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            
            {/* Suggestions dropdown */}
            {subredditSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                {subredditSuggestions.map((sub) => (
                  <button
                    key={sub}
                    onClick={() => selectSubreddit(sub)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-600 text-gray-200"
                  >
                    r/{sub}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Sort Options */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'hot' | 'top')}
              className="block w-full px-3 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="hot">Hot</option>
              <option value="top">Top</option>
            </select>
          </div>
          
          {/* Timeframe (only for top) */}
          {sortBy === 'top' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Timeframe</label>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as 'day' | 'week' | 'month' | 'year' | 'all')}
                className="block w-full px-3 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="day">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
                <option value="all">All Time</option>
              </select>
            </div>
          )}
          
          {/* Fetch Button */}
          <div className="flex items-end">
            <button
              onClick={fetchThreads}
              disabled={!subreddit || loading}
              className="px-6 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md font-medium transition-colors"
            >
              {loading ? 'Loading...' : 'Fetch Threads'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-200">
          {error}
        </div>
      )}
      
      {/* Threads List */}
      {threads.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">
            Threads from r/{subreddit}
            <span className="text-gray-400 text-sm font-normal ml-2">({threads.length} threads)</span>
          </h2>
          
          <div className="space-y-3">
            {threads.map((thread) => (
              <div
                key={thread.id}
                className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <a
                      href={thread.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-lg font-medium text-blue-400 hover:text-blue-300 line-clamp-2"
                    >
                      {thread.title}
                    </a>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <span className="text-orange-500">▲</span> {formatScore(thread.score)}
                      </span>
                      <span>{thread.num_comments} comments</span>
                      <span>by u/{thread.author}</span>
                      <span>{formatDate(thread.created_utc)}</span>
                    </div>
                    {thread.selftext && (
                      <p className="mt-2 text-gray-400 text-sm line-clamp-2">
                        {thread.selftext}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => openGenerationModal(thread)}
                    disabled={generating === thread.id}
                    className="flex-shrink-0 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    {generating === thread.id ? (
                      <span className="flex items-center gap-2">
                        <div className="spinner w-4 h-4"></div>
                        Generating...
                      </span>
                    ) : (
                      'Generate Ideas'
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Generation Options Modal */}
      {showOptionsModal && selectedThreadForGeneration && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Generation Options</h2>
              <button
                onClick={() => {
                  setShowOptionsModal(false);
                  setSelectedThreadForGeneration(null);
                }}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              {/* Selected Thread Info */}
              <div className="bg-gray-700/50 rounded-lg p-3">
                <p className="text-sm text-gray-400">Generating ideas for:</p>
                <p className="text-white font-medium line-clamp-2">{selectedThreadForGeneration.title}</p>
              </div>
              
              {/* Video Format */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Video Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setGenerationOptions({ ...generationOptions, video_format: 'short' })}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      generationOptions.video_format === 'short'
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                    }`}
                  >
                    <div className="font-medium text-white text-sm">📱 Short (9:16)</div>
                    <p className="text-xs text-gray-400 mt-1">YouTube Shorts, TikTok, Reels</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenerationOptions({ ...generationOptions, video_format: 'long' })}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      generationOptions.video_format === 'long'
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                    }`}
                  >
                    <div className="font-medium text-white text-sm">🖥️ Long (16:9)</div>
                    <p className="text-xs text-gray-400 mt-1">Standard YouTube video</p>
                  </button>
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Duration (seconds)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="30"
                    max="180"
                    step="15"
                    value={generationOptions.duration}
                    onChange={(e) => setGenerationOptions({ ...generationOptions, duration: parseInt(e.target.value) })}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                  <span className="text-lg font-medium text-orange-400 w-16 text-right">
                    {generationOptions.duration}s
                  </span>
                </div>
              </div>
              
              {/* Target Audience */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Target Audience
                </label>
                <textarea
                  value={generationOptions.target_audience}
                  onChange={(e) => setGenerationOptions({ ...generationOptions, target_audience: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-orange-500 focus:border-orange-500 resize-none"
                  placeholder="Who is this content for?"
                />
              </div>
              
              {/* Tone */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Content Tone
                </label>
                <input
                  type="text"
                  value={generationOptions.tone}
                  onChange={(e) => setGenerationOptions({ ...generationOptions, tone: e.target.value })}
                  className="w-full px-3 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-orange-500 focus:border-orange-500"
                  placeholder="e.g., Dramatic, funny, informative..."
                />
              </div>
              
              {/* Additional Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Additional Notes <span className="text-gray-500">(specific to this video)</span>
                </label>
                <textarea
                  value={generationOptions.additional_notes}
                  onChange={(e) => setGenerationOptions({ ...generationOptions, additional_notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-orange-500 focus:border-orange-500 resize-none"
                  placeholder="Any specific instructions for this particular video..."
                />
              </div>
              
              {/* Viral Reference Picker */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  🔥 Viral References <span className="text-gray-500">(optional{availableViralRefs.length > 0 ? `, max ${maxViralRefs}` : ''})</span>
                </label>
                {loadingViralRefs ? (
                  <p className="text-sm text-gray-500">Loading viral references...</p>
                ) : viralRefsError ? (
                  <p className="text-sm text-red-400">⚠️ {viralRefsError}</p>
                ) : availableViralRefs.length === 0 ? (
                  <p className="text-sm text-gray-500">No viral references saved yet. Add them from the <a href="/viral-references" className="text-pink-400 underline">🔥 Viral</a> page.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1 bg-gray-700/30 rounded-lg p-2">
                    {availableViralRefs.map((ref) => (
                      <label
                        key={ref.id}
                        className={`flex items-start gap-2 p-2 rounded cursor-pointer transition-colors ${
                          selectedViralRefIds.has(ref.id)
                            ? 'bg-pink-900/30 border border-pink-600/40'
                            : 'hover:bg-gray-700/50 border border-transparent'
                        } ${!selectedViralRefIds.has(ref.id) && selectedViralRefIds.size >= maxViralRefs ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedViralRefIds.has(ref.id)}
                          onChange={() => toggleViralRef(ref.id)}
                          disabled={!selectedViralRefIds.has(ref.id) && selectedViralRefIds.size >= maxViralRefs}
                          className="mt-0.5 accent-pink-500"
                        />
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{ref.title}</p>
                          <p className="text-xs text-gray-400 line-clamp-1">{ref.transcript.slice(0, 100)}...</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                {selectedViralRefIds.size > 0 && (
                  <p className="text-xs text-pink-400 mt-1">{selectedViralRefIds.size}/{maxViralRefs} selected</p>
                )}
              </div>

              {/* API Key Warning */}
              {settings && (settings.ai_provider || 'gemini') === 'gemini' && !settings.gemini_api_key && (
                <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-3 text-yellow-200 text-sm">
                  ⚠️ No API key configured. Please add your Gemini API key in <a href="/settings" className="underline">Settings</a>.
                </div>
              )}
              {settings && settings.ai_provider === 'copilot' && (
                <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-3 text-blue-200 text-sm">
                  Using GitHub Copilot ({settings.copilot_model || 'gpt-4.1'}) via copilot-api proxy. Make sure the proxy is running.
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowOptionsModal(false);
                    setSelectedThreadForGeneration(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={generateContent}
                  disabled={
                    (settings?.ai_provider || 'gemini') === 'gemini' 
                      ? (!settings?.gemini_api_key && !process.env.NEXT_PUBLIC_GEMINI_API_KEY)
                      : false
                  }
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md font-medium transition-colors"
                >
                  Generate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Generated Content Modal */}
      {generatedContent && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Generated Content</h2>
              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <>
                    <button
                      onClick={openRevisionModal}
                      disabled={generating === 'regenerating'}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-md text-sm font-medium transition-colors flex items-center gap-1"
                    >
                      {generating === 'regenerating' ? (
                        <>
                          <span className="animate-spin">⟳</span> Regenerating...
                        </>
                      ) : (
                        <>🔄 Regenerate</>
                      )}
                    </button>
                    <button
                      onClick={markAsViral}
                      disabled={markingViral}
                      className="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 rounded-md text-sm font-medium transition-colors"
                    >
                      {markingViral ? '...' : '🔥 Viral'}
                    </button>
                    <button
                      onClick={startEditing}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium transition-colors"
                    >
                      ✏️ Edit
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={cancelEditing}
                      className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 rounded-md text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEditedContent}
                      disabled={saving}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-md text-sm font-medium transition-colors"
                    >
                      {saving ? 'Saving...' : '💾 Save'}
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    setGeneratedContent(null);
                    setIsEditing(false);
                    setEditedContent(null);
                  }}
                  className="text-gray-400 hover:text-white text-2xl ml-2"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
                {isEditing && editedContent ? (
                  <input
                    type="text"
                    value={editedContent.title}
                    onChange={(e) => setEditedContent({ ...editedContent, title: e.target.value })}
                    maxLength={100}
                    className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-orange-400 font-medium focus:ring-orange-500 focus:border-orange-500"
                  />
                ) : (
                  <div className="bg-gray-700 rounded-lg p-3 text-orange-400 font-medium">
                    {generatedContent.title}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {(isEditing && editedContent ? editedContent.title : generatedContent.title).length}/100 characters
                </p>
              </div>
              
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                {isEditing && editedContent ? (
                  <textarea
                    value={editedContent.description}
                    onChange={(e) => setEditedContent({ ...editedContent, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 focus:ring-orange-500 focus:border-orange-500 resize-none"
                  />
                ) : (
                  <div className="bg-gray-700 rounded-lg p-3 text-gray-200 whitespace-pre-wrap">
                    {generatedContent.description}
                  </div>
                )}
              </div>
              
              {/* Transcript */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Transcript (for ElevenLabs)</label>
                {isEditing && editedContent ? (
                  <textarea
                    value={editedContent.transcript}
                    onChange={(e) => setEditedContent({ ...editedContent, transcript: e.target.value })}
                    rows={8}
                    className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 font-mono text-sm focus:ring-orange-500 focus:border-orange-500 resize-none"
                  />
                ) : (
                  <div className="bg-gray-700 rounded-lg p-4 text-gray-200 whitespace-pre-wrap font-mono text-sm">
                    {generatedContent.transcript}
                  </div>
                )}
                <button
                  onClick={() => navigator.clipboard.writeText(isEditing && editedContent ? editedContent.transcript : generatedContent.transcript)}
                  className="mt-2 text-sm text-blue-400 hover:text-blue-300"
                >
                  Copy transcript
                </button>
              </div>

              {/* Voice Style & Music Style */}
              {(generatedContent.voice_style || generatedContent.music_style) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {generatedContent.voice_style && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium text-gray-300">🎙️ Voice Style (ElevenLabs)</label>
                        <button
                          onClick={() => navigator.clipboard.writeText(generatedContent.voice_style || '')}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          Copy
                        </button>
                      </div>
                      <div className="bg-gray-700 rounded-lg p-3 text-purple-300 text-sm">
                        {generatedContent.voice_style}
                      </div>
                    </div>
                  )}
                  {generatedContent.music_style && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium text-gray-300">🎵 Background Music</label>
                        <button
                          onClick={() => navigator.clipboard.writeText(generatedContent.music_style || '')}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          Copy
                        </button>
                      </div>
                      <div className="bg-gray-700 rounded-lg p-3 text-cyan-300 text-sm">
                        {generatedContent.music_style}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Pinned Comment */}
              {generatedContent.pinned_comment && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-300">📌 Pinned Comment (for SEO)</label>
                    <button
                      onClick={() => navigator.clipboard.writeText(generatedContent.pinned_comment || '')}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-3 text-yellow-300 text-sm whitespace-pre-wrap">
                    {generatedContent.pinned_comment}
                  </div>
                </div>
              )}

              {/* Thumbnail Prompts */}
              {generatedContent.thumbnail_prompts && generatedContent.thumbnail_prompts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">🖼️ Thumbnail Prompts (Gemini Image Generation)</label>
                  <div className="space-y-3">
                    {generatedContent.thumbnail_prompts.map((prompt, index) => (
                      <div key={index} className="bg-gray-700 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-pink-400">Option {index + 1}</span>
                          <button
                            onClick={() => navigator.clipboard.writeText(prompt)}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            Copy
                          </button>
                        </div>
                        <p className="text-pink-200 text-sm">{prompt}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Scenes Table */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Scene Breakdown</label>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-700">
                        <th className="text-left p-3 font-medium text-gray-300 w-10">#</th>
                        <th className="text-left p-3 font-medium text-gray-300">Transcript</th>
                        <th className="text-left p-3 font-medium text-gray-300">Scene</th>
                        <th className="text-left p-3 font-medium text-gray-300">Image Prompt</th>
                        <th className="text-left p-3 font-medium text-gray-300 w-48">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(isEditing && editedContent ? editedContent.scenes : generatedContent.scenes).map((scene, index) => (
                        <tr key={index} className="border-t border-gray-700">
                          <td className="p-3 text-gray-400">{index + 1}</td>
                          <td className="p-3 text-gray-200">
                            {isEditing && editedContent ? (
                              <input
                                type="text"
                                value={scene.transcript}
                                onChange={(e) => {
                                  const newScenes = [...editedContent.scenes];
                                  newScenes[index] = { ...newScenes[index], transcript: e.target.value };
                                  setEditedContent({ ...editedContent, scenes: newScenes });
                                }}
                                className="w-full px-2 py-1 rounded bg-gray-600 border border-gray-500 text-gray-200 text-sm"
                              />
                            ) : (
                              scene.transcript
                            )}
                          </td>
                          <td className="p-3 text-green-400">
                            {isEditing && editedContent ? (
                              <input
                                type="text"
                                value={scene.scene}
                                onChange={(e) => {
                                  const newScenes = [...editedContent.scenes];
                                  newScenes[index] = { ...newScenes[index], scene: e.target.value };
                                  setEditedContent({ ...editedContent, scenes: newScenes });
                                }}
                                className="w-full px-2 py-1 rounded bg-gray-600 border border-gray-500 text-green-400 text-sm"
                              />
                            ) : (
                              scene.scene
                            )}
                          </td>
                          <td className="p-3 text-pink-300">
                            {isEditing && editedContent ? (
                              <input
                                type="text"
                                value={scene.image_prompt || ''}
                                onChange={(e) => {
                                  const newScenes = [...editedContent.scenes];
                                  newScenes[index] = { ...newScenes[index], image_prompt: e.target.value || undefined };
                                  setEditedContent({ ...editedContent, scenes: newScenes });
                                }}
                                placeholder="AI image prompt (optional)"
                                className="w-full px-2 py-1 rounded bg-gray-600 border border-gray-500 text-pink-300 text-sm placeholder-gray-500"
                              />
                            ) : (
                              <span className="text-sm">{scene.image_prompt || <span className="text-gray-500">Real footage</span>}</span>
                            )}
                          </td>
                          <td className="p-3">
                            {isEditing && editedContent ? (
                              <input
                                type="text"
                                value={scene.notes || ''}
                                onChange={(e) => {
                                  const newScenes = [...editedContent.scenes];
                                  newScenes[index] = { ...newScenes[index], notes: e.target.value };
                                  setEditedContent({ ...editedContent, scenes: newScenes });
                                }}
                                placeholder="Video link, notes..."
                                className="w-full px-2 py-1 rounded bg-gray-600 border border-gray-500 text-gray-300 text-sm placeholder-gray-500"
                              />
                            ) : (
                              <span className="text-gray-400 text-sm">{scene.notes || '-'}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* YouTube Tracking (only show for saved ideas) */}
              {generatedContent.id && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">YouTube Link</label>
                    {isEditing && editedContent ? (
                      <input
                        type="url"
                        value={editedContent.youtube_link || ''}
                        onChange={(e) => setEditedContent({ ...editedContent, youtube_link: e.target.value })}
                        placeholder="https://youtube.com/shorts/..."
                        className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 focus:ring-orange-500 focus:border-orange-500"
                      />
                    ) : (
                      <div className="bg-gray-700 rounded-lg p-3 text-gray-200">
                        {generatedContent.youtube_link ? (
                          <a href={generatedContent.youtube_link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                            {generatedContent.youtube_link}
                          </a>
                        ) : (
                          <span className="text-gray-500">Not published yet</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Views</label>
                    {isEditing && editedContent ? (
                      <input
                        type="number"
                        value={editedContent.views || '0'}
                        onChange={(e) => setEditedContent({ ...editedContent, views: e.target.value })}
                        min={0}
                        className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 focus:ring-orange-500 focus:border-orange-500"
                      />
                    ) : (
                      <div className="bg-gray-700 rounded-lg p-3 text-gray-200">
                        {generatedContent.views?.toLocaleString() || 0}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Source Thread */}
              <div className="border-t border-gray-700 pt-4">
                <p className="text-sm text-gray-400">
                  Source: <a href={generatedContent.thread.permalink} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">{generatedContent.thread.title}</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revision Modal */}
      {showRevisionModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold">Regenerate Content</h3>
            <p className="text-sm text-gray-400">
              Optionally provide revision notes to guide the AI on what to change or improve.
            </p>
            <textarea
              value={revisionNote}
              onChange={(e) => setRevisionNote(e.target.value)}
              placeholder="e.g., Make it funnier, focus more on the top comment, make the hook more dramatic..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 focus:ring-orange-500 focus:border-orange-500 resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowRevisionModal(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={regenerateContent}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-md font-medium transition-colors"
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
