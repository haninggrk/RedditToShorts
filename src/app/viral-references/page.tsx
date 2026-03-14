'use client';

import { useState, useEffect } from 'react';

interface ViralReference {
  id: number;
  title: string;
  transcript: string;
  source: 'marked' | 'manual';
  idea_id?: number;
  created_at: string;
}

export default function ViralReferencesPage() {
  const [references, setReferences] = useState<ViralReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTranscript, setNewTranscript] = useState('');
  const [adding, setAdding] = useState(false);

  // Expanded view
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetchReferences();
  }, []);

  const fetchReferences = async () => {
    try {
      const res = await fetch('/api/viral-references');
      const data = await res.json();
      setReferences(data.references || []);
    } catch {
      setError('Failed to load viral references');
    } finally {
      setLoading(false);
    }
  };

  const addReference = async () => {
    if (!newTranscript.trim()) return;

    setAdding(true);
    setError(null);

    try {
      const res = await fetch('/api/viral-references', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          transcript: newTranscript.trim(),
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setReferences([data, ...references]);
      setNewTitle('');
      setNewTranscript('');
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add reference');
    } finally {
      setAdding(false);
    }
  };

  const deleteReference = async (id: number) => {
    if (!confirm('Remove this viral reference?')) return;

    setDeleting(id);
    try {
      const res = await fetch(`/api/viral-references?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setReferences(references.filter((r) => r.id !== id));
      }
    } catch {
      setError('Failed to delete reference');
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Viral References</h1>
          <p className="text-gray-400">
            Transcripts marked as viral will be used as style references for future generations.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-pink-600 hover:bg-pink-700 rounded-md font-medium transition-colors"
        >
          {showAddForm ? 'Cancel' : '+ Add Transcript'}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-200">
          {error}
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-gray-800 rounded-lg p-6 space-y-4 border border-pink-600/30">
          <h2 className="text-lg font-semibold">Add Viral Transcript</h2>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Title <span className="text-gray-500">(optional)</span>
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g., My best performing short"
              className="w-full px-3 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-pink-500 focus:border-pink-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Transcript <span className="text-red-400">*</span>
            </label>
            <textarea
              value={newTranscript}
              onChange={(e) => setNewTranscript(e.target.value)}
              rows={8}
              placeholder="Paste the full transcript of a viral short here..."
              className="w-full px-3 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-pink-500 focus:border-pink-500 resize-none font-mono text-sm"
            />
          </div>
          <button
            onClick={addReference}
            disabled={adding || !newTranscript.trim()}
            className="px-6 py-2 bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md font-medium transition-colors"
          >
            {adding ? 'Adding...' : 'Add Reference'}
          </button>
        </div>
      )}

      {/* References List */}
      {references.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">🔥</div>
          <h2 className="text-xl font-semibold mb-2">No viral references yet</h2>
          <p className="text-gray-400 mb-4">
            Mark generated shorts as viral or paste transcripts of your best performing content.
            These will be used as style references for future AI generations.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {references.map((ref) => (
            <div
              key={ref.id}
              className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 text-xs rounded ${
                        ref.source === 'marked'
                          ? 'bg-orange-600/30 text-orange-400'
                          : 'bg-pink-600/30 text-pink-400'
                      }`}
                    >
                      {ref.source === 'marked' ? '⭐ From Saved Idea' : '📝 Manual'}
                    </span>
                    <span className="text-xs text-gray-500">{formatDate(ref.created_at)}</span>
                  </div>
                  {ref.title && (
                    <h3 className="text-lg font-medium text-orange-400 mb-1">{ref.title}</h3>
                  )}
                  <p
                    className="text-sm text-gray-300 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === ref.id ? null : ref.id)}
                  >
                    {expandedId === ref.id ? (
                      <span className="whitespace-pre-wrap font-mono">{ref.transcript}</span>
                    ) : (
                      <span className="line-clamp-2">{ref.transcript}</span>
                    )}
                  </p>
                  {expandedId !== ref.id && (
                    <button
                      onClick={() => setExpandedId(ref.id)}
                      className="text-xs text-blue-400 hover:text-blue-300 mt-1"
                    >
                      Show full transcript
                    </button>
                  )}
                </div>
                <button
                  onClick={() => deleteReference(ref.id)}
                  disabled={deleting === ref.id}
                  className="flex-shrink-0 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-md text-sm font-medium transition-colors"
                >
                  {deleting === ref.id ? '...' : 'Remove'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
