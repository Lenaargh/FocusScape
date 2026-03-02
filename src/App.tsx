import React, { useState, useEffect, useRef } from 'react';
import { engine, SoundType, SynthParams, SOUND_TYPES } from './lib/audio';
import { getAudioMixSuggestion, generateCustomSynth } from './lib/gemini';
import Visualizer, { VisualizerStyle } from './components/Visualizer';
import { Play, Pause, Sparkles, Brain, Droplets, Waves, Wind, Loader2, Volume2, VolumeX, ChevronDown, Menu, X, Save, Trash2, Music, Download, RefreshCw, Edit3, XCircle, PlusCircle } from 'lucide-react';

const STANDARD_SOUNDS = [
  { id: 'brown', label: 'Brown Noise', icon: Waves, description: 'Deep rumble' },
  { id: 'pink', label: 'Pink Noise', icon: Wind, description: 'Balanced waterfall' },
  { id: 'white', label: 'White Noise', icon: Sparkles, description: 'Static mask' },
  { id: 'rain', label: 'Gentle Rain', icon: Droplets, description: 'Muffled rain' },
] as const;

const BINAURAL_SOUNDS = [
  { id: 'binaural_delta', label: 'Delta (1-4Hz)', icon: Brain, description: 'Deep sleep & healing' },
  { id: 'binaural_theta', label: 'Theta (4-8Hz)', icon: Brain, description: 'Meditation & creativity' },
  { id: 'binaural_alpha', label: 'Alpha (8-14Hz)', icon: Brain, description: 'Relaxed focus & learning' },
  { id: 'binaural_beta', label: 'Beta (14-30Hz)', icon: Brain, description: 'Active attention' },
  { id: 'binaural_gamma', label: 'Gamma (30-50Hz)', icon: Brain, description: 'High-level processing' },
] as const;

interface SavedMix {
  id: string;
  name: string;
  volumes: Record<SoundType, number>;
  synthParams: SynthParams | null;
  createdAt: number;
}

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [masterVolume, setMasterVolume] = useState(1);
  const [volumes, setVolumes] = useState<Record<SoundType, number>>(() => {
    const init: any = {};
    SOUND_TYPES.forEach(t => init[t] = 0);
    return init;
  });
  
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiMessage, setAiMessage] = useState('How are you feeling? I can suggest a mix or generate a custom synth.');
  const [aiMode, setAiMode] = useState<'mix' | 'synth'>('mix');
  const [aiSynthName, setAiSynthName] = useState<string | null>(null);
  
  const [visualizerStyle, setVisualizerStyle] = useState<VisualizerStyle>('3d-terrain');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [savedMixes, setSavedMixes] = useState<SavedMix[]>(() => {
    const saved = localStorage.getItem('focusscape_mixes');
    return saved ? JSON.parse(saved) : [];
  });
  const [mixSort, setMixSort] = useState<'recent' | 'name'>('recent');
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        const newVol = Math.min(1, masterVolume + 0.05);
        setMasterVolume(newVol);
        engine.setMasterVolume(newVol);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        const newVol = Math.max(0, masterVolume - 0.05);
        setMasterVolume(newVol);
        engine.setMasterVolume(newVol);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, masterVolume]);

  const togglePlay = async () => {
    if (isPlaying) {
      engine.stop();
      setIsPlaying(false);
    } else {
      await engine.play();
      setIsPlaying(true);
    }
  };

  const handleMasterVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setMasterVolume(val);
    engine.setMasterVolume(val);
  };

  const handleVolumeChange = (type: SoundType, value: number) => {
    const newVolumes = { ...volumes, [type]: value };
    setVolumes(newVolumes);
    engine.setVolume(type, value);
    
    if (!isPlaying && value > 0) {
      engine.play();
      setIsPlaying(true);
    }
  };

  const applyMix = (settings: Partial<Record<SoundType, number>>, synthParams?: SynthParams | null) => {
    const newVolumes = { ...volumes };
    SOUND_TYPES.forEach(t => newVolumes[t] = settings[t] || 0);
    setVolumes(newVolumes);
    
    SOUND_TYPES.forEach(type => {
      engine.setVolume(type, newVolumes[type]);
    });

    if (synthParams !== undefined) {
      engine.setCustomSynthParams(synthParams);
      if (!synthParams) setAiSynthName(null);
    }

    if (!isPlaying) {
      engine.play();
      setIsPlaying(true);
    }
  };

  const handleAiAction = async (isRetry = false, isRemix = false) => {
    if (!aiPrompt.trim() && !isRetry && !isRemix) return;
    setIsGenerating(true);
    try {
      if (aiMode === 'mix') {
        const result = await getAudioMixSuggestion(aiPrompt);
        setAiMessage(result.message);
        applyMix(result.settings);
        setSaveName("AI Mix: " + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
      } else {
        const prevParams = isRemix ? engine.getCustomSynthParams() || undefined : undefined;
        const result = await generateCustomSynth(aiPrompt, prevParams);
        setAiMessage(result.message);
        setAiSynthName(result.name);
        applyMix({ custom_synth: 0.8 }, result.params);
        setSaveName(result.name);
      }
      if (!isRetry && !isRemix) setAiPrompt('');
    } catch (error) {
      console.error(error);
      setAiMessage("I'm sorry, I couldn't generate that right now. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveMix = () => {
    if (!saveName.trim()) return;
    const newMix: SavedMix = {
      id: Date.now().toString(),
      name: saveName,
      volumes: { ...volumes },
      synthParams: engine.getCustomSynthParams(),
      createdAt: Date.now()
    };
    const updated = [...savedMixes, newMix];
    setSavedMixes(updated);
    localStorage.setItem('focusscape_mixes', JSON.stringify(updated));
    setIsSaving(false);
    setIsSidebarOpen(true); // Show it immediately
  };

  const deleteMix = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedMixes.filter(m => m.id !== id);
    setSavedMixes(updated);
    localStorage.setItem('focusscape_mixes', JSON.stringify(updated));
  };

  const handleDownload = async () => {
    if (!isPlaying) {
      await togglePlay();
    }
    setIsDownloading(true);
    try {
      const blob = await engine.recordLoop(10000); // Record 10 seconds
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${saveName || 'focusscape-mix'}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed", err);
      alert("Failed to download audio. Your browser might not support this feature.");
    } finally {
      setIsDownloading(false);
    }
  };

  const sortedMixes = [...savedMixes].sort((a, b) => {
    if (mixSort === 'recent') return b.createdAt - a.createdAt;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="min-h-screen bg-[#1a1b1e] text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed top-0 left-0 h-full w-80 bg-[#25262b] border-r border-white/5 z-50 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">My Mixes</h2>
          <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>
        
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <span className="text-sm text-slate-400">Sort by:</span>
          <select 
            value={mixSort} 
            onChange={(e) => setMixSort(e.target.value as any)}
            className="bg-[#1a1b1e] border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:outline-none"
          >
            <option value="recent">Recent</option>
            <option value="name">Name</option>
          </select>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {sortedMixes.length === 0 ? (
            <p className="text-slate-500 text-sm">No saved mixes yet. Create one and click Save!</p>
          ) : (
            sortedMixes.map(mix => (
              <div 
                key={mix.id}
                onClick={() => {
                  applyMix(mix.volumes, mix.synthParams);
                  setSaveName(mix.name);
                  if (mix.synthParams) setAiSynthName(mix.name);
                  setIsSidebarOpen(false);
                }}
                className="group flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-colors border border-transparent hover:border-white/10"
              >
                <span className="font-medium text-slate-200 truncate pr-2">{mix.name}</span>
                <button 
                  onClick={(e) => deleteMix(mix.id, e)}
                  className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                  title="Delete mix"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-8 sm:mb-12">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
          >
            <Menu size={28} />
          </button>
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-1 sm:mb-2">FocusScape</h1>
            <p className="text-slate-400 text-sm sm:text-base">Custom soundscapes for neurodivergent minds.</p>
          </div>
          <button 
            onClick={() => {
              if (!saveName) setSaveName("My Custom Mix");
              setIsSaving(true);
            }}
            className="p-2 -mr-2 text-slate-400 hover:text-indigo-400 transition-colors"
            title="Save current mix"
          >
            <Save size={24} />
          </button>
        </header>

        {/* Save Modal */}
        {isSaving && (
          <div className="mb-8 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
            <input 
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Name your mix..."
              className="flex-1 bg-[#1a1b1e] border border-indigo-500/30 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSaveMix()}
            />
            <button onClick={handleSaveMix} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-medium transition-colors">
              Save
            </button>
            <button onClick={() => setIsSaving(false)} className="p-2 text-slate-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
        )}

        {/* Visualizer Controls & Display */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-3 px-1">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Visualizer</h2>
            <select 
              value={visualizerStyle}
              onChange={(e) => setVisualizerStyle(e.target.value as VisualizerStyle)}
              className="bg-[#25262b] border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none"
            >
              <option value="3d-terrain">3D Terrain</option>
              <option value="3d-bars">3D Bars</option>
              <option value="off">Off</option>
            </select>
          </div>
          <Visualizer style={visualizerStyle} />
        </div>

        {/* Main Play & Master Volume */}
        <div className="flex flex-col items-center gap-6 mb-12">
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlay}
              className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
                isPlaying 
                  ? 'bg-indigo-500/20 text-indigo-400 border-2 border-indigo-500/50 hover:bg-indigo-500/30' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-105'
              }`}
              aria-label={isPlaying ? "Pause sounds" : "Play sounds"}
            >
              {isPlaying ? <Pause size={32} className="fill-current sm:w-9 sm:h-9" /> : <Play size={32} className="fill-current ml-2 sm:w-9 sm:h-9" />}
            </button>
            
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="w-12 h-12 rounded-full bg-[#25262b] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Download 10s Loop"
            >
              {isDownloading ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
            </button>
          </div>

          <div className="flex items-center gap-3 w-full max-w-xs bg-[#25262b] px-4 py-3 rounded-full border border-white/5">
            <VolumeX size={18} className="text-slate-500" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={masterVolume}
              onChange={handleMasterVolume}
              className="flex-1 h-1.5 bg-[#1a1b1e] rounded-lg appearance-none cursor-pointer accent-indigo-500"
              aria-label="Master volume"
            />
            <Volume2 size={18} className="text-slate-400" />
          </div>
        </div>

        {/* AI Assistant Section */}
        <div className="bg-[#25262b] rounded-2xl p-5 sm:p-6 mb-8 border border-white/5 shadow-sm">
          <div className="flex gap-4 mb-4 border-b border-white/10 pb-3">
            <button 
              onClick={() => setAiMode('mix')} 
              className={`text-sm font-medium transition-colors ${aiMode === 'mix' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Mix Suggestion
            </button>
            <button 
              onClick={() => setAiMode('synth')} 
              className={`text-sm font-medium transition-colors ${aiMode === 'synth' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              AI Synth Generator
            </button>
          </div>

          <div className="flex items-start gap-3 sm:gap-4 mb-4">
            <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400 shrink-0 mt-1">
              <Sparkles size={18} />
            </div>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">{aiMessage}</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAiAction()}
              placeholder={aiMode === 'mix' ? "e.g., I'm overwhelmed by chemistry..." : "e.g., A deep, pulsing ambient drone..."}
              className="flex-1 bg-[#1a1b1e] border border-white/10 rounded-xl px-4 py-3 text-sm sm:text-base text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              disabled={isGenerating}
            />
            <button
              onClick={() => handleAiAction()}
              disabled={isGenerating || !aiPrompt.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center justify-center min-w-[100px] w-full sm:w-auto"
            >
              {isGenerating ? <Loader2 size={20} className="animate-spin" /> : 'Generate'}
            </button>
          </div>
        </div>

        {/* Custom Synth Volume & Options (if active) */}
        {engine.getCustomSynthParams() && (
          <div className={`mb-8 p-5 rounded-2xl border transition-all duration-300 ${volumes['custom_synth'] > 0 ? 'bg-indigo-500/10 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'bg-[#25262b] border-white/5'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400">
                  <Music size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-indigo-100">{aiSynthName || 'AI Custom Synth'}</h3>
                  <p className="text-xs text-indigo-300/70">Generative ambient patch</p>
                </div>
              </div>
              <span className="text-xs font-mono text-indigo-300 w-8 text-right">
                {Math.round(volumes['custom_synth'] * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volumes['custom_synth']}
              onChange={(e) => handleVolumeChange('custom_synth', parseFloat(e.target.value))}
              className="w-full h-2 bg-[#1a1b1e] rounded-lg appearance-none cursor-pointer accent-indigo-500 mb-4"
            />
            
            {/* Synth Actions */}
            <div className="flex flex-wrap gap-2 pt-3 border-t border-indigo-500/10">
              <button onClick={() => handleAiAction(true, false)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium text-slate-300 transition-colors">
                <RefreshCw size={14} /> Try Again
              </button>
              <button onClick={() => {
                const prompt = window.prompt("How should I change this sound?", "Make it deeper and slower");
                if (prompt) {
                  setAiPrompt(prompt);
                  handleAiAction(true, true);
                }
              }} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium text-slate-300 transition-colors">
                <Edit3 size={14} /> Remix
              </button>
              <button onClick={() => {
                setSaveName(aiSynthName || "My Synth");
                setIsSaving(true);
              }} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium text-slate-300 transition-colors">
                <PlusCircle size={14} /> Save to Mixes
              </button>
              <button onClick={() => {
                engine.setCustomSynthParams(null);
                setAiSynthName(null);
                handleVolumeChange('custom_synth', 0);
              }} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-xs font-medium text-slate-300 transition-colors ml-auto">
                <XCircle size={14} /> Discard
              </button>
            </div>
          </div>
        )}

        {/* Binaural Beats (Expandable) */}
        <details className="group mb-8 bg-[#25262b] rounded-2xl border border-white/5" open>
          <summary className="flex items-center justify-between p-5 cursor-pointer list-none">
            <div>
              <h2 className="font-semibold text-white">Binaural Beats</h2>
              <p className="text-xs text-slate-400 mt-1">Brainwave entrainment frequencies</p>
            </div>
            <div className="bg-white/5 p-2 rounded-full text-slate-400 group-open:rotate-180 transition-transform">
              <ChevronDown size={20} />
            </div>
          </summary>
          <div className="p-5 pt-0 border-t border-white/5 mt-2 space-y-4">
            {BINAURAL_SOUNDS.map(({ id, label, icon: Icon, description }) => (
              <div key={id} className={`pt-4 transition-all duration-300 rounded-xl p-3 -mx-3 ${volumes[id] > 0 ? 'bg-indigo-500/5 shadow-[inset_0_0_10px_rgba(99,102,241,0.05)]' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={volumes[id] > 0 ? "text-indigo-400" : "text-slate-400"}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <h3 className={`font-medium text-sm ${volumes[id] > 0 ? "text-indigo-200" : "text-slate-200"}`}>{label}</h3>
                      <p className="text-xs text-slate-500">{description}</p>
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
                  className="w-full h-1.5 bg-[#1a1b1e] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            ))}
          </div>
        </details>

        {/* Standard Noises (Expandable) */}
        <details className="group bg-[#25262b] rounded-2xl border border-white/5">
          <summary className="flex items-center justify-between p-5 cursor-pointer list-none">
            <div>
              <h2 className="font-semibold text-white">Background Noises</h2>
              <p className="text-xs text-slate-400 mt-1">Brown, Pink, White, Rain</p>
            </div>
            <div className="bg-white/5 p-2 rounded-full text-slate-400 group-open:rotate-180 transition-transform">
              <ChevronDown size={20} />
            </div>
          </summary>
          <div className="p-5 pt-0 border-t border-white/5 mt-2 space-y-4">
            {STANDARD_SOUNDS.map(({ id, label, icon: Icon, description }) => (
              <div key={id} className={`pt-4 transition-all duration-300 rounded-xl p-3 -mx-3 ${volumes[id] > 0 ? 'bg-slate-700/30 shadow-[inset_0_0_10px_rgba(255,255,255,0.02)]' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={volumes[id] > 0 ? "text-slate-200" : "text-slate-400"}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <h3 className={`font-medium text-sm ${volumes[id] > 0 ? "text-white" : "text-slate-200"}`}>{label}</h3>
                      <p className="text-xs text-slate-500">{description}</p>
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
                  className="w-full h-1.5 bg-[#1a1b1e] rounded-lg appearance-none cursor-pointer accent-slate-400"
                />
              </div>
            ))}
          </div>
        </details>

      </div>
    </div>
  );
}
