'use client';

import { useState, useEffect } from 'react';

interface Settings {
  id: number;
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
  reddit_username: string;
  reddit_password: string;
  max_viral_references: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [availableModels, setAvailableModels] = useState<{ id: string; name: string; description: string }[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [copilotModels, setCopilotModels] = useState<{ id: string; name: string }[]>([]);
  const [loadingCopilotModels, setLoadingCopilotModels] = useState(false);

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings(data);
      // Auto-fetch models based on active provider
      if (data.ai_provider === 'copilot') {
        fetchCopilotModels();
      } else if (data.gemini_api_key) {
        fetchModels();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const fetchModels = async () => {
    setLoadingModels(true);
    try {
      const res = await fetch('/api/models');
      const data = await res.json();
      if (data.models) {
        setAvailableModels(data.models);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to fetch models' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to fetch available models' });
    } finally {
      setLoadingModels(false);
    }
  };

  const fetchCopilotModels = async () => {
    setLoadingCopilotModels(true);
    try {
      const res = await fetch('/api/copilot-models');
      const data = await res.json();
      if (data.models) {
        setCopilotModels(data.models);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to fetch Copilot models. Is copilot-api running?' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to fetch Copilot models. Is copilot-api running?' });
    } finally {
      setLoadingCopilotModels(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        throw new Error('Failed to save settings');
      }

      const data = await res.json();
      setSettings(data);
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center text-red-400">
        Failed to load settings. Please refresh the page.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Master Settings</h1>
        <p className="text-gray-400">
          Configure your preferences for AI-generated content. These settings will be used when generating YouTube Shorts ideas.
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-900/50 border border-green-500 text-green-200'
              : 'bg-red-900/50 border border-red-500 text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="bg-gray-800 rounded-lg p-6 space-y-6">
        {/* API Keys Section */}
        <div className="border-b border-gray-700 pb-6">
          <h3 className="text-lg font-medium text-white mb-4">AI Provider</h3>
          
          {/* Provider Toggle */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Select AI Provider
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => updateSetting('ai_provider', 'gemini')}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  (settings.ai_provider || 'gemini') === 'gemini'
                    ? 'border-orange-500 bg-orange-500/10'
                    : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                }`}
              >
                <div className="font-medium text-white">Google Gemini</div>
                <p className="text-xs text-gray-400 mt-1">Uses Google&apos;s Gemini API with your API key</p>
              </button>
              <button
                type="button"
                onClick={() => updateSetting('ai_provider', 'copilot')}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  settings.ai_provider === 'copilot'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                }`}
              >
                <div className="font-medium text-white">GitHub Copilot</div>
                <p className="text-xs text-gray-400 mt-1">Uses copilot-api proxy (OpenAI-compatible)</p>
              </button>
            </div>
          </div>

          {/* Gemini Config (shown when gemini selected) */}
          {(settings.ai_provider || 'gemini') === 'gemini' && (
            <div className="space-y-4 p-4 bg-gray-700/30 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Gemini API Key
                </label>
                <input
                  type="password"
                  value={settings.gemini_api_key}
                  onChange={(e) => updateSetting('gemini_api_key', e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Enter your Gemini API key..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Get your API key from <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Google AI Studio</a>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Gemini Model
                </label>
                <div className="flex gap-2">
                  <select
                    value={settings.gemini_model || 'gemini-2.5-flash'}
                    onChange={(e) => updateSetting('gemini_model', e.target.value)}
                    className="flex-1 px-3 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-orange-500 focus:border-orange-500"
                  >
                    {availableModels.length === 0 ? (
                      <option value={settings.gemini_model || 'gemini-2.5-flash'}>
                        {settings.gemini_model || 'gemini-2.5-flash'}
                      </option>
                    ) : (
                      availableModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.id})
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={fetchModels}
                    disabled={loadingModels || !settings.gemini_api_key}
                    className="px-3 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-md text-sm transition-colors whitespace-nowrap"
                  >
                    {loadingModels ? 'Loading...' : 'Refresh Models'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Select the Gemini model to use for content generation.
                </p>
              </div>
            </div>
          )}

          {/* Copilot Config (shown when copilot selected) */}
          {settings.ai_provider === 'copilot' && (
            <div className="space-y-4 p-4 bg-gray-700/30 rounded-lg">
              <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-3 text-blue-200 text-sm">
                <p className="font-medium mb-1">Setup Required</p>
                <p>Run <code className="bg-blue-900/50 px-1 rounded">npx copilot-api@latest start</code> in a terminal first. This starts a local proxy server that exposes your GitHub Copilot subscription as an OpenAI-compatible API.</p>
                <p className="mt-1 text-xs text-blue-300">Requires a GitHub account with Copilot subscription.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Copilot API URL
                </label>
                <input
                  type="text"
                  value={settings.copilot_api_url || 'http://localhost:4141'}
                  onChange={(e) => updateSetting('copilot_api_url', e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-orange-500 focus:border-orange-500"
                  placeholder="http://localhost:4141"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The URL where copilot-api proxy is running (default: http://localhost:4141)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Copilot Model
                </label>
                <div className="flex gap-2">
                  <select
                    value={settings.copilot_model || 'gpt-4.1'}
                    onChange={(e) => updateSetting('copilot_model', e.target.value)}
                    className="flex-1 px-3 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-orange-500 focus:border-orange-500"
                  >
                    {copilotModels.length === 0 ? (
                      <option value={settings.copilot_model || 'gpt-4.1'}>
                        {settings.copilot_model || 'gpt-4.1'}
                      </option>
                    ) : (
                      copilotModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={fetchCopilotModels}
                    disabled={loadingCopilotModels}
                    className="px-3 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-md text-sm transition-colors whitespace-nowrap"
                  >
                    {loadingCopilotModels ? 'Loading...' : 'Refresh Models'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Models available through GitHub Copilot. Click &quot;Refresh Models&quot; to fetch from the proxy.
                </p>
              </div>
            </div>
          )}
          
          {/* Reddit API Section */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Reddit API Credentials
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Create a Reddit app at <a href="https://www.reddit.com/prefs/apps" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">reddit.com/prefs/apps</a> (select "script" type)
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Client ID</label>
                <input
                  type="text"
                  value={settings.reddit_client_id || ''}
                  onChange={(e) => updateSetting('reddit_client_id', e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-orange-500 focus:border-orange-500 text-sm"
                  placeholder="Client ID"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Client Secret</label>
                <input
                  type="password"
                  value={settings.reddit_client_secret || ''}
                  onChange={(e) => updateSetting('reddit_client_secret', e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-orange-500 focus:border-orange-500 text-sm"
                  placeholder="Client Secret"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Reddit Username</label>
                <input
                  type="text"
                  value={settings.reddit_username || ''}
                  onChange={(e) => updateSetting('reddit_username', e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-orange-500 focus:border-orange-500 text-sm"
                  placeholder="Your Reddit username"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Reddit Password</label>
                <input
                  type="password"
                  value={settings.reddit_password || ''}
                  onChange={(e) => updateSetting('reddit_password', e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-orange-500 focus:border-orange-500 text-sm"
                  placeholder="Your Reddit password"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Preferred Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Preferred Duration (seconds)
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="30"
              max="180"
              step="15"
              value={settings.preferred_duration}
              onChange={(e) => updateSetting('preferred_duration', parseInt(e.target.value))}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
            <span className="text-lg font-medium text-orange-400 w-20 text-right">
              {settings.preferred_duration}s
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            This determines the approximate length of the generated transcript. YouTube Shorts can be up to 60 seconds, but you can generate longer scripts for other platforms.
          </p>
        </div>

        {/* Target Audience */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Target Audience
          </label>
          <textarea
            value={settings.target_audience}
            onChange={(e) => updateSetting('target_audience', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-orange-500 focus:border-orange-500 resize-none"
            placeholder="Describe your target audience..."
          />
          <p className="text-xs text-gray-500 mt-1">
            Who are you creating content for? Be specific about demographics, interests, and preferences.
          </p>
        </div>

        {/* Tone */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Content Tone
          </label>
          <input
            type="text"
            value={settings.tone}
            onChange={(e) => updateSetting('tone', e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-orange-500 focus:border-orange-500"
            placeholder="e.g., Engaging, conversational, dramatic..."
          />
          <p className="text-xs text-gray-500 mt-1">
            What mood or style should the narration have?
          </p>
        </div>

        {/* Additional Preferences */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Additional Preferences
          </label>
          <textarea
            value={settings.additional_preferences}
            onChange={(e) => updateSetting('additional_preferences', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-orange-500 focus:border-orange-500 resize-none"
            placeholder="Any other instructions or preferences for the AI..."
          />
          <p className="text-xs text-gray-500 mt-1">
            Additional context or rules for content generation (e.g., "avoid profanity", "include a call-to-action", "focus on drama").
          </p>
        </div>

        {/* Max Viral References */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            🔥 Max Viral References in Prompt
          </label>
          <div className="flex items-center gap-4">
            <input
              type="number"
              min={0}
              max={50}
              value={settings.max_viral_references ?? 10}
              onChange={(e) => updateSetting('max_viral_references', parseInt(e.target.value) || 0)}
              className="w-24 px-3 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-orange-500 focus:border-orange-500"
            />
            <span className="text-sm text-gray-400">references</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Number of viral reference transcripts to include when generating new shorts. Set to 0 to disable. Most recent references are used first.
          </p>
        </div>

        {/* Quick Presets */}
        <div className="border-t border-gray-700 pt-4">
          <label className="block text-sm font-medium text-gray-300 mb-3">Quick Presets</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setSettings({
                  ...settings,
                  preferred_duration: 60,
                  target_audience: 'Young adults (18-35) who enjoy entertaining Reddit stories and viral content',
                  tone: 'Engaging, dramatic, with cliffhangers and emotional hooks',
                  additional_preferences: 'Include a strong hook in the first 3 seconds. End with a question or call to follow.',
                });
              }}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md text-sm"
            >
              🎭 Drama/Stories
            </button>
            <button
              type="button"
              onClick={() => {
                setSettings({
                  ...settings,
                  preferred_duration: 45,
                  target_audience: 'People who enjoy comedy and light-hearted content',
                  tone: 'Funny, witty, sarcastic but friendly',
                  additional_preferences: 'Focus on the funniest comments. Add comedic timing with pauses.',
                });
              }}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md text-sm"
            >
              😂 Comedy
            </button>
            <button
              type="button"
              onClick={() => {
                setSettings({
                  ...settings,
                  preferred_duration: 90,
                  target_audience: 'Curious minds interested in learning new things',
                  tone: 'Informative, enthusiastic, clear explanations',
                  additional_preferences: 'Present information in a structured way. Include surprising facts.',
                });
              }}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md text-sm"
            >
              📚 Educational
            </button>
            <button
              type="button"
              onClick={() => {
                setSettings({
                  ...settings,
                  preferred_duration: 60,
                  target_audience: 'People interested in debates and controversial topics',
                  tone: 'Balanced, thought-provoking, presenting multiple perspectives',
                  additional_preferences: 'Present both sides fairly. End with a question to encourage engagement.',
                });
              }}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md text-sm"
            >
              🤔 Hot Takes
            </button>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t border-gray-700">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 rounded-md font-medium transition-colors"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
