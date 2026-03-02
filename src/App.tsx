import React, { useState, useEffect } from 'react';
import { engine, SoundType } from './lib/audio';
import { getAudioMixSuggestion } from './lib/gemini';
import { Play, Pause, Sparkles, Brain, Droplets, Waves, Wind, Loader2 } from 'lucide-react';

const SOUNDS: { id: SoundType; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'brown', label: 'Brown Noise', icon: Waves, description: 'Deep rumble, great for ADHD focus' },
  { id: 'pink', label: 'Pink Noise', icon: Wind, description: 'Balanced, like a waterfall' },
  { id: 'white', label: 'White Noise', icon: Sparkles, description: 'Static, masks sharp sounds' },
  { id: 'rain', label: 'Gentle Rain', icon: Droplets, description: 'Muffled, relaxing rain' },
  { id: 'binaural', label: 'Binaural Beats', icon: Brain, description: '40Hz Gamma for deep concentration' },
];

const PRESETS = [
  { label: 'Deep Focus', settings: { brown: 0.8, pink: 0, white: 0, rain: 0, binaural: 0.5 } },
  { label: 'Cozy Study', settings: { brown: 0.2, pink: 0.3, white: 0, rain: 0.7, binaural: 0 } },
  { label: 'Block Out World', settings: { brown: 0.9, pink: 0.4, white: 0.1, rain: 0, binaural: 0.2 } },
];

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volumes, setVolumes] = useState<Record<SoundType, number>>({
    brown: 0, pink: 0, white: 0, binaural: 0, rain: 0
  });
  
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiMessage, setAiMessage] = useState('How are you feeling? I can suggest a custom mix for your current task.');

  const togglePlay = async () => {
    if (isPlaying) {
      engine.stop();
      setIsPlaying(false);
    } else {
      await engine.play();
      setIsPlaying(true);
    }
  };

  const handleVolumeChange = (type: SoundType, value: number) => {
    const newVolumes = { ...volumes, [type]: value };
    setVolumes(newVolumes);
    engine.setVolume(type, value);
    
    // Auto-play if they start adjusting sliders while paused
    if (!isPlaying && value > 0) {
      engine.play();
      setIsPlaying(true);
    }
  };

  const applyPreset = (settings: Record<SoundType, number>) => {
    setVolumes(settings);
    (Object.keys(settings) as SoundType[]).forEach(type => {
      engine.setVolume(type, settings[type]);
    });
    if (!isPlaying) {
      engine.play();
      setIsPlaying(true);
    }
  };

  const handleAiSuggest = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const result = await getAudioMixSuggestion(aiPrompt);
      setAiMessage(result.message);
      applyPreset(result.settings);
      setAiPrompt('');
    } catch (error) {
      console.error(error);
      setAiMessage("I'm sorry, I couldn't generate a mix right now. Please try adjusting the sliders manually.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1b1e] text-slate-200 font-sans selection:bg-indigo-500/30">
      <div className="max-w-2xl mx-auto px-6 py-12">
        
        {/* Header */}
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-white mb-3">FocusScape</h1>
          <p className="text-slate-400 text-lg">Custom soundscapes for neurodivergent minds.</p>
        </header>

        {/* Main Play Control */}
        <div className="flex justify-center mb-12">
          <button
            onClick={togglePlay}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
              isPlaying 
                ? 'bg-indigo-500/20 text-indigo-400 border-2 border-indigo-500/50 hover:bg-indigo-500/30' 
                : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-105'
            }`}
            aria-label={isPlaying ? "Pause sounds" : "Play sounds"}
          >
            {isPlaying ? <Pause size={36} className="fill-current" /> : <Play size={36} className="fill-current ml-2" />}
          </button>
        </div>

        {/* AI Assistant Section */}
        <div className="bg-[#25262b] rounded-2xl p-6 mb-8 border border-white/5 shadow-sm">
          <div className="flex items-start gap-4 mb-4">
            <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400 shrink-0 mt-1">
              <Sparkles size={20} />
            </div>
            <p className="text-slate-300 leading-relaxed">{aiMessage}</p>
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAiSuggest()}
              placeholder="e.g., I'm overwhelmed by my chemistry assignment..."
              className="flex-1 bg-[#1a1b1e] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              disabled={isGenerating}
            />
            <button
              onClick={handleAiSuggest}
              disabled={isGenerating || !aiPrompt.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center justify-center min-w-[100px]"
            >
              {isGenerating ? <Loader2 size={20} className="animate-spin" /> : 'Suggest'}
            </button>
          </div>
        </div>

        {/* Presets */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Quick Presets</h2>
          <div className="flex flex-wrap gap-3">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => applyPreset(preset.settings)}
                className="px-4 py-2 rounded-full bg-[#25262b] border border-white/5 hover:bg-white/10 transition-colors text-sm font-medium"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mixer */}
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-6">Custom Mixer</h2>
          <div className="space-y-6">
            {SOUNDS.map(({ id, label, icon: Icon, description }) => (
              <div key={id} className="bg-[#25262b] p-5 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/5 p-2 rounded-lg text-slate-300">
                      <Icon size={20} />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{label}</h3>
                      <p className="text-xs text-slate-400">{description}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-slate-500 w-8 text-right">
                    {Math.round(volumes[id] * 100)}%
                  </span>
                </div>
                
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volumes[id]}
                  onChange={(e) => handleVolumeChange(id, parseFloat(e.target.value))}
                  className="w-full h-2 bg-[#1a1b1e] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  aria-label={`${label} volume`}
                />
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
