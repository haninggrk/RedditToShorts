'use client';

import { useState, useEffect } from 'react';

interface Scene {
  transcript: string;
  scene: string;
  image_prompt?: string;
  notes?: string;
}

interface SavedIdea {
  id: number;
  subreddit: string;
  thread_id: string;
  thread_title: string;
  title: string;
  description: string;
  transcript: string;
  scenes: Scene[];
  voice_style?: string;
  music_style?: string;
  pinned_comment?: string;
  thumbnail_prompts?: string[];
  youtube_link?: string;
  views?: number;
  created_at: string;
}

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<SavedIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdea, setSelectedIdea] = useState<SavedIdea | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedIdea, setEditedIdea] = useState<SavedIdea | null>(null);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');

  useEffect(() => {
    fetchIdeas();
  }, []);

  const fetchIdeas = async () => {
    try {
      const res = await fetch('/api/ideas');
      const data = await res.json();
      setIdeas(data.ideas || []);
    } catch (err) {
      setError('Failed to load saved ideas');
    } finally {
      setLoading(false);
    }
  };

  const deleteIdea = async (id: number) => {
    if (!confirm('Are you sure you want to delete this idea?')) return;
    
    setDeleting(id);
    try {
      const res = await fetch(`/api/ideas/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setIdeas(ideas.filter(idea => idea.id !== id));
        if (selectedIdea?.id === id) {
          setSelectedIdea(null);
        }
      }
    } catch (err) {
      setError('Failed to delete idea');
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    alert(`${label} copied to clipboard!`);
  };

  const startEditing = () => {
    if (selectedIdea) {
      setEditedIdea({ ...selectedIdea });
      setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    setEditedIdea(null);
    setIsEditing(false);
  };

  const saveEdits = async () => {
    if (!editedIdea) return;
    
    setSaving(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/ideas/${editedIdea.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editedIdea.title,
          description: editedIdea.description,
          transcript: editedIdea.transcript,
          scenes: editedIdea.scenes,
          youtube_link: editedIdea.youtube_link,
          views: editedIdea.views,
        }),
      });
      
      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Update local state
      setIdeas(ideas.map(idea => idea.id === editedIdea.id ? editedIdea : idea));
      setSelectedIdea(editedIdea);
      setIsEditing(false);
      setEditedIdea(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const openRevisionModal = () => {
    setRevisionNote('');
    setShowRevisionModal(true);
  };

  const regenerateIdea = async () => {
    if (!selectedIdea) return;
    
    setShowRevisionModal(false);
    setRegenerating(true);
    setError(null);
    
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: selectedIdea.thread_id,
          revision_note: revisionNote || undefined,
        }),
      });
      
      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Update the idea with regenerated content
      const updatedIdea = {
        ...selectedIdea,
        title: data.title,
        description: data.description,
        transcript: data.transcript,
        scenes: data.scenes,
        voice_style: data.voice_style,
        music_style: data.music_style,
        pinned_comment: data.pinned_comment,
        thumbnail_prompts: data.thumbnail_prompts,
      };
      
      // Save to database
      await fetch(`/api/ideas/${selectedIdea.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          transcript: data.transcript,
          scenes: data.scenes,
          voice_style: data.voice_style,
          music_style: data.music_style,
          pinned_comment: data.pinned_comment,          thumbnail_prompts: data.thumbnail_prompts,        }),
      });
      
      setIdeas(ideas.map(idea => idea.id === selectedIdea.id ? updatedIdea : idea));
      setSelectedIdea(updatedIdea);
      setRevisionNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate content');
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Saved Ideas</h1>
        <p className="text-gray-400">
          View and manage your generated YouTube Shorts ideas
        </p>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-200">
          {error}
        </div>
      )}

      {ideas.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">📝</div>
          <h2 className="text-xl font-semibold mb-2">No saved ideas yet</h2>
          <p className="text-gray-400 mb-4">
            Go to the Browse page to find Reddit threads and generate content ideas.
          </p>
          <a
            href="/"
            className="inline-block px-6 py-2 bg-orange-600 hover:bg-orange-700 rounded-md font-medium transition-colors"
          >
            Browse Threads
          </a>
        </div>
      ) : (
        <div className="grid gap-4">
          {ideas.map((idea) => (
            <div
              key={idea.id}
              className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="px-2 py-0.5 bg-orange-600/30 text-orange-400 text-xs rounded">
                      r/{idea.subreddit}
                    </span>
                    {idea.youtube_link ? (
                      <span className="px-2 py-0.5 bg-green-600/30 text-green-400 text-xs rounded flex items-center gap-1">
                        ✓ Published
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-600/30 text-gray-400 text-xs rounded">
                        Draft
                      </span>
                    )}
                    {idea.views !== undefined && idea.views > 0 && (
                      <span className="px-2 py-0.5 bg-blue-600/30 text-blue-400 text-xs rounded">
                        👁 {idea.views.toLocaleString()} views
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      {formatDate(idea.created_at)}
                    </span>
                  </div>
                  <h3 className="text-lg font-medium text-orange-400 mb-1 line-clamp-2">
                    {idea.title}
                  </h3>
                  <p className="text-sm text-gray-400 mb-2 line-clamp-1">
                    From: {idea.thread_title}
                  </p>
                  <p className="text-sm text-gray-500 line-clamp-2">
                    {idea.description}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setSelectedIdea(idea)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium transition-colors"
                  >
                    View
                  </button>
                  <button
                    onClick={() => deleteIdea(idea.id)}
                    disabled={deleting === idea.id}
                    className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-md text-sm font-medium transition-colors"
                  >
                    {deleting === idea.id ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedIdea && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
              <div>
                <span className="px-2 py-0.5 bg-orange-600/30 text-orange-400 text-xs rounded">
                  r/{selectedIdea.subreddit}
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  {formatDate(selectedIdea.created_at)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <>
                    <button
                      onClick={openRevisionModal}
                      disabled={regenerating}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-md text-sm font-medium transition-colors flex items-center gap-1"
                    >
                      {regenerating ? (
                        <>
                          <span className="animate-spin">⟳</span> Regenerating...
                        </>
                      ) : (
                        <>🔄 Regenerate</>
                      )}
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
                      onClick={saveEdits}
                      disabled={saving}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-md text-sm font-medium transition-colors"
                    >
                      {saving ? 'Saving...' : '💾 Save'}
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    setSelectedIdea(null);
                    setIsEditing(false);
                    setEditedIdea(null);
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-300">Title (with hashtags)</label>
                  <button
                    onClick={() => copyToClipboard(isEditing && editedIdea ? editedIdea.title : selectedIdea.title, 'Title')}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Copy
                  </button>
                </div>
                {isEditing && editedIdea ? (
                  <input
                    type="text"
                    value={editedIdea.title}
                    onChange={(e) => setEditedIdea({ ...editedIdea, title: e.target.value })}
                    maxLength={100}
                    className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-orange-400 font-medium focus:ring-orange-500 focus:border-orange-500"
                  />
                ) : (
                  <div className="bg-gray-700 rounded-lg p-3 text-orange-400 font-medium">
                    {selectedIdea.title}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {(isEditing && editedIdea ? editedIdea.title : selectedIdea.title).length}/100 characters
                </p>
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-300">Description</label>
                  <button
                    onClick={() => copyToClipboard(isEditing && editedIdea ? editedIdea.description : selectedIdea.description, 'Description')}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Copy
                  </button>
                </div>
                {isEditing && editedIdea ? (
                  <textarea
                    value={editedIdea.description}
                    onChange={(e) => setEditedIdea({ ...editedIdea, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 focus:ring-orange-500 focus:border-orange-500 resize-none"
                  />
                ) : (
                  <div className="bg-gray-700 rounded-lg p-3 text-gray-200 whitespace-pre-wrap">
                    {selectedIdea.description}
                  </div>
                )}
              </div>

              {/* Transcript */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-300">Transcript (for ElevenLabs)</label>
                  <button
                    onClick={() => copyToClipboard(isEditing && editedIdea ? editedIdea.transcript : selectedIdea.transcript, 'Transcript')}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Copy
                  </button>
                </div>
                {isEditing && editedIdea ? (
                  <textarea
                    value={editedIdea.transcript}
                    onChange={(e) => setEditedIdea({ ...editedIdea, transcript: e.target.value })}
                    rows={8}
                    className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 font-mono text-sm focus:ring-orange-500 focus:border-orange-500 resize-none"
                  />
                ) : (
                  <div className="bg-gray-700 rounded-lg p-4 text-gray-200 whitespace-pre-wrap font-mono text-sm">
                    {selectedIdea.transcript}
                  </div>
                )}
              </div>

              {/* Voice Style & Music Style */}
              {(selectedIdea.voice_style || selectedIdea.music_style) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedIdea.voice_style && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium text-gray-300">🎙️ Voice Style (ElevenLabs)</label>
                        <button
                          onClick={() => copyToClipboard(selectedIdea.voice_style || '', 'Voice style')}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          Copy
                        </button>
                      </div>
                      <div className="bg-gray-700 rounded-lg p-3 text-purple-300 text-sm">
                        {selectedIdea.voice_style}
                      </div>
                    </div>
                  )}
                  {selectedIdea.music_style && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium text-gray-300">🎵 Background Music</label>
                        <button
                          onClick={() => copyToClipboard(selectedIdea.music_style || '', 'Music style')}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          Copy
                        </button>
                      </div>
                      <div className="bg-gray-700 rounded-lg p-3 text-cyan-300 text-sm">
                        {selectedIdea.music_style}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Pinned Comment */}
              {selectedIdea.pinned_comment && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-300">📌 Pinned Comment (for SEO)</label>
                    <button
                      onClick={() => copyToClipboard(selectedIdea.pinned_comment || '', 'Pinned comment')}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-3 text-yellow-300 text-sm whitespace-pre-wrap">
                    {selectedIdea.pinned_comment}
                  </div>
                </div>
              )}

              {/* Thumbnail Prompts */}
              {selectedIdea.thumbnail_prompts && selectedIdea.thumbnail_prompts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">🖼️ Thumbnail Prompts (Gemini Image Generation)</label>
                  <div className="space-y-3">
                    {selectedIdea.thumbnail_prompts.map((prompt, index) => (
                      <div key={index} className="bg-gray-700 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-pink-400">Option {index + 1}</span>
                          <button
                            onClick={() => copyToClipboard(prompt, `Thumbnail prompt ${index + 1}`)}
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
                      {(isEditing && editedIdea ? editedIdea.scenes : selectedIdea.scenes).map((scene, index) => (
                        <tr key={index} className="border-t border-gray-700">
                          <td className="p-3 text-gray-400">{index + 1}</td>
                          <td className="p-3 text-gray-200">
                            {isEditing && editedIdea ? (
                              <input
                                type="text"
                                value={scene.transcript}
                                onChange={(e) => {
                                  const newScenes = [...editedIdea.scenes];
                                  newScenes[index] = { ...newScenes[index], transcript: e.target.value };
                                  setEditedIdea({ ...editedIdea, scenes: newScenes });
                                }}
                                className="w-full px-2 py-1 rounded bg-gray-600 border border-gray-500 text-gray-200 text-sm"
                              />
                            ) : (
                              scene.transcript
                            )}
                          </td>
                          <td className="p-3 text-green-400">
                            {isEditing && editedIdea ? (
                              <input
                                type="text"
                                value={scene.scene}
                                onChange={(e) => {
                                  const newScenes = [...editedIdea.scenes];
                                  newScenes[index] = { ...newScenes[index], scene: e.target.value };
                                  setEditedIdea({ ...editedIdea, scenes: newScenes });
                                }}
                                className="w-full px-2 py-1 rounded bg-gray-600 border border-gray-500 text-green-400 text-sm"
                              />
                            ) : (
                              scene.scene
                            )}
                          </td>
                          <td className="p-3 text-pink-300">
                            {isEditing && editedIdea ? (
                              <input
                                type="text"
                                value={scene.image_prompt || ''}
                                onChange={(e) => {
                                  const newScenes = [...editedIdea.scenes];
                                  newScenes[index] = { ...newScenes[index], image_prompt: e.target.value || undefined };
                                  setEditedIdea({ ...editedIdea, scenes: newScenes });
                                }}
                                placeholder="AI image prompt (optional)"
                                className="w-full px-2 py-1 rounded bg-gray-600 border border-gray-500 text-pink-300 text-sm placeholder-gray-500"
                              />
                            ) : (
                              <span className="text-sm">{scene.image_prompt || <span className="text-gray-500">Real footage</span>}</span>
                            )}
                          </td>
                          <td className="p-3">
                            {isEditing && editedIdea ? (
                              <input
                                type="text"
                                value={scene.notes || ''}
                                onChange={(e) => {
                                  const newScenes = [...editedIdea.scenes];
                                  newScenes[index] = { ...newScenes[index], notes: e.target.value };
                                  setEditedIdea({ ...editedIdea, scenes: newScenes });
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

              {/* YouTube Tracking */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">YouTube Link</label>
                  {isEditing && editedIdea ? (
                    <input
                      type="url"
                      value={editedIdea.youtube_link || ''}
                      onChange={(e) => setEditedIdea({ ...editedIdea, youtube_link: e.target.value })}
                      placeholder="https://youtube.com/shorts/..."
                      className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 focus:ring-orange-500 focus:border-orange-500"
                    />
                  ) : (
                    <div className="bg-gray-700 rounded-lg p-3 text-gray-200">
                      {selectedIdea.youtube_link ? (
                        <a href={selectedIdea.youtube_link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                          {selectedIdea.youtube_link}
                        </a>
                      ) : (
                        <span className="text-gray-500">Not published yet</span>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Views</label>
                  {isEditing && editedIdea ? (
                    <input
                      type="number"
                      value={editedIdea.views || 0}
                      onChange={(e) => setEditedIdea({ ...editedIdea, views: parseInt(e.target.value) || 0 })}
                      min={0}
                      className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 focus:ring-orange-500 focus:border-orange-500"
                    />
                  ) : (
                    <div className="bg-gray-700 rounded-lg p-3 text-gray-200">
                      {selectedIdea.views?.toLocaleString() || 0}
                    </div>
                  )}
                </div>
              </div>

              {/* Source Thread */}
              <div className="border-t border-gray-700 pt-4">
                <p className="text-sm text-gray-400">
                  Source thread: <span className="text-gray-300">{selectedIdea.thread_title}</span>
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
                onClick={regenerateIdea}
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
