import React, { useState, useEffect, useRef } from 'react';
import { engine, SoundType, SynthParams, SOUND_TYPES } from './lib/audio';
import { getAudioMixSuggestion, generateCustomSynth, generateMixDescription } from './lib/gemini';
import Visualizer, { VisualizerStyle } from './components/Visualizer';
import { Play, Pause, Sparkles, Brain, Droplets, Waves, Wind, Loader2, Volume2, VolumeX, ChevronDown, Menu, X, Save, Trash2, Music, Download, RefreshCw, Edit3, XCircle, PlusCircle, Star, Info, RotateCcw, Undo2, Redo2, EyeOff, Eye } from 'lucide-react';

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
  isFavorite?: boolean;
  isHidden?: boolean;
  description?: string;
}

interface HistoryState {
  volumes: Record<SoundType, number>;
  synthParams: SynthParams | null;
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
  const [showInfo, setShowInfo] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [generatingDescId, setGeneratingDescId] = useState<string | null>(null);
  const [includeBackground, setIncludeBackground] = useState(true);
  const [buildOnCurrent, setBuildOnCurrent] = useState(false);
  const [showRemixModal, setShowRemixModal] = useState<'mix' | 'synth' | null>(null);
  const [remixInput, setRemixInput] = useState('');
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [muted, setMuted] = useState<Record<SoundType, boolean>>(() => {
    const init: any = {};
    SOUND_TYPES.forEach(t => init[t] = false);
    return init;
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && (e.target.type === 'text' || e.target.type === 'textarea')) return;
      if (e.target instanceof HTMLTextAreaElement) return;
      
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

  const saveToHistory = (vols: Record<SoundType, number>, params: SynthParams | null) => {
    const newState = { volumes: { ...vols }, synthParams: params ? { ...params } : null };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      applyMix(prevState.volumes, prevState.synthParams, false);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      applyMix(nextState.volumes, nextState.synthParams, false);
      setHistoryIndex(historyIndex + 1);
    }
  };

  const handleVolumeChange = (type: SoundType, value: number) => {
    const newVolumes = { ...volumes, [type]: value };
    setVolumes(newVolumes);
    if (!muted[type]) {
      engine.setVolume(type, value);
    }
    
    if (!isPlaying && value > 0 && !muted[type]) {
      engine.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = (type: SoundType) => {
    const newMuted = { ...muted, [type]: !muted[type] };
    setMuted(newMuted);
    if (newMuted[type]) {
      engine.setVolume(type, 0);
    } else {
      engine.setVolume(type, volumes[type]);
    }
  };

  const applyMix = (settings: Partial<Record<SoundType, number>>, synthParams?: SynthParams | null, pushHistory = true) => {
    const newVolumes = { ...volumes };
    SOUND_TYPES.forEach(t => newVolumes[t] = settings[t] || 0);
    setVolumes(newVolumes);
    
    SOUND_TYPES.forEach(type => {
      if (!muted[type]) engine.setVolume(type, newVolumes[type]);
    });

    if (synthParams !== undefined) {
      engine.setCustomSynthParams(synthParams);
      if (!synthParams) setAiSynthName(null);
    }

    if (pushHistory) {
      saveToHistory(newVolumes, synthParams !== undefined ? synthParams : engine.getCustomSynthParams());
    }

    if (!isPlaying) {
      engine.play();
      setIsPlaying(true);
    }
  };

  const handleAiAction = async (isRetry = false, isRemix = false, customPrompt?: string, forceMode?: 'mix' | 'synth') => {
    const promptToUse = customPrompt !== undefined ? customPrompt : aiPrompt;
    const activeMode = forceMode || aiMode;
    if (!promptToUse.trim() && !isRetry && !isRemix && aiPrompt.trim() !== '') return;
    
    setIsGenerating(true);
    try {
      if (activeMode === 'mix') {
        const hasSynth = !!engine.getCustomSynthParams();
        const options = {
          includeBackground,
          currentVolumes: (buildOnCurrent || isRemix) ? volumes : undefined
        };
        const result = await getAudioMixSuggestion(promptToUse, hasSynth, options);
        setAiMessage(result.message);
        applyMix(result.settings);
        setSaveName("AI Mix: " + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
      } else {
        const prevParams = isRemix ? engine.getCustomSynthParams() || undefined : undefined;
        const result = await generateCustomSynth(promptToUse, prevParams);
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
      createdAt: Date.now(),
      isFavorite: false,
      isHidden: false
    };
    const updated = [...savedMixes, newMix];
    setSavedMixes(updated);
    localStorage.setItem('focusscape_mixes', JSON.stringify(updated));
    setIsSaving(false);
    setIsSidebarOpen(true);
  };

  const updateMix = (id: string, updates: Partial<SavedMix>) => {
    const updated = savedMixes.map(m => m.id === id ? { ...m, ...updates } : m);
    setSavedMixes(updated);
    localStorage.setItem('focusscape_mixes', JSON.stringify(updated));
  };

  const deleteMix = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedMixes.filter(m => m.id !== id);
    setSavedMixes(updated);
    localStorage.setItem('focusscape_mixes', JSON.stringify(updated));
  };

  const generateDescription = async (mix: SavedMix, e: React.MouseEvent) => {
    e.stopPropagation();
    setGeneratingDescId(mix.id);
    try {
      const desc = await generateMixDescription(mix.name, mix.volumes, mix.synthParams);
      updateMix(mix.id, { description: desc });
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingDescId(null);
    }
  };

  const handleReset = () => {
    const resetVols: any = {};
    SOUND_TYPES.forEach(t => resetVols[t] = 0);
    applyMix(resetVols, null);
    setAiMessage('All sounds reset. Ready for a new mix.');
  };

  const moveFavorite = (index: number, direction: 1 | -1, e: React.MouseEvent) => {
    e.stopPropagation();
    const favs = savedMixes.filter(m => m.isFavorite);
    if (index + direction < 0 || index + direction >= favs.length) return;
    
    const newMixes = [...savedMixes];
    const idxA = newMixes.findIndex(m => m.id === favs[index].id);
    const idxB = newMixes.findIndex(m => m.id === favs[index + direction].id);
    
    const temp = newMixes[idxA];
    newMixes[idxA] = newMixes[idxB];
    newMixes[idxB] = temp;
    
    setSavedMixes(newMixes);
    localStorage.setItem('focusscape_mixes', JSON.stringify(newMixes));
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

  const visibleMixes = savedMixes.filter(m => !m.isHidden && !m.isFavorite);
  const hiddenMixes = savedMixes.filter(m => m.isHidden);
  const favoriteMixes = savedMixes.filter(m => m.isFavorite);

  const sortedVisibleMixes = [...visibleMixes].sort((a, b) => {
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
          <div className="flex items-center gap-2">
            <button onClick={() => setIsEditMode(!isEditMode)} className={`text-sm px-3 py-1 rounded-full ${isEditMode ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-300'}`}>
              {isEditMode ? 'Done' : 'Edit'}
            </button>
            <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white">
              <X size={24} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Favorites Section */}
          {favoriteMixes.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2 flex items-center gap-2">
                <Star size={14} className="text-yellow-500 fill-yellow-500" /> Favorites
              </h3>
              <div className="space-y-2">
                {favoriteMixes.slice(0, isEditMode ? undefined : 3).map((mix, idx) => (
                  <details key={mix.id} className="group bg-white/5 rounded-xl border border-transparent hover:border-white/10">
                    <summary className="flex items-center justify-between p-3 cursor-pointer list-none">
                      <div className="flex items-center gap-2 overflow-hidden">
                        {isEditMode && (
                          <div className="flex flex-col gap-1 mr-1">
                            <button onClick={(e) => moveFavorite(idx, -1, e)} className="text-slate-500 hover:text-white"><ChevronDown size={12} className="rotate-180" /></button>
                            <button onClick={(e) => moveFavorite(idx, 1, e)} className="text-slate-500 hover:text-white"><ChevronDown size={12} /></button>
                          </div>
                        )}
                        <span className="font-medium text-slate-200 truncate">{mix.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isEditMode && (
                          <button onClick={(e) => { e.stopPropagation(); applyMix(mix.volumes, mix.synthParams); setSaveName(mix.name); if (mix.synthParams) setAiSynthName(mix.name); }} className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/40 transition-colors">
                            <Play size={14} className="fill-current" />
                          </button>
                        )}
                        {isEditMode && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); updateMix(mix.id, { isFavorite: false }); }} className="text-yellow-500 p-1"><Star size={16} className="fill-current" /></button>
                            <button onClick={(e) => deleteMix(mix.id, e)} className="text-slate-500 hover:text-red-400 p-1"><Trash2 size={16} /></button>
                          </>
                        )}
                      </div>
                    </summary>
                    <div className="p-3 pt-0 text-xs text-slate-400">
                      {generatingDescId === mix.id ? (
                        <span className="text-indigo-400 mb-2 flex items-center gap-1"><Loader2 size={12} className="animate-spin"/> Generating...</span>
                      ) : mix.description ? (
                        <p className="mb-2 italic">"{mix.description}"</p>
                      ) : (
                        <button onClick={(e) => generateDescription(mix, e)} className="text-indigo-400 hover:text-indigo-300 mb-2 flex items-center gap-1"><Sparkles size={12}/> Auto-generate description</button>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(mix.volumes).filter(([_, v]) => v > 0).map(([k, v]) => (
                          <span key={k} className="bg-black/30 px-2 py-0.5 rounded-md">{k.replace('binaural_', '')}: {Math.round(v*100)}%</span>
                        ))}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}

          {/* Standard Mixes */}
          <div>
            <div className="flex items-center justify-between mb-3 px-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">All Mixes</h3>
              <select 
                value={mixSort} 
                onChange={(e) => setMixSort(e.target.value as any)}
                className="bg-transparent text-xs text-slate-400 focus:outline-none cursor-pointer"
              >
                <option value="recent">Recent</option>
                <option value="name">Name</option>
              </select>
            </div>
            
            <div className="space-y-2">
              {sortedVisibleMixes.length === 0 && favoriteMixes.length === 0 ? (
                <p className="text-slate-500 text-sm px-2">No saved mixes yet.</p>
              ) : (
                sortedVisibleMixes.map(mix => (
                  <details key={mix.id} className="group bg-white/5 rounded-xl border border-transparent hover:border-white/10">
                    <summary className="flex items-center justify-between p-3 cursor-pointer list-none">
                      <div className="flex items-center gap-2 overflow-hidden">
                        {isEditMode ? (
                          <input 
                            type="text" 
                            value={mix.name} 
                            onChange={(e) => updateMix(mix.id, { name: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-black/20 border border-white/10 rounded px-2 py-1 text-sm text-white w-full focus:outline-none"
                          />
                        ) : (
                          <span className="font-medium text-slate-200 truncate">{mix.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!isEditMode && (
                          <button onClick={(e) => { e.stopPropagation(); applyMix(mix.volumes, mix.synthParams); setSaveName(mix.name); if (mix.synthParams) setAiSynthName(mix.name); }} className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/40 transition-colors">
                            <Play size={14} className="fill-current" />
                          </button>
                        )}
                        {isEditMode && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); updateMix(mix.id, { isFavorite: true }); }} className="text-slate-500 hover:text-yellow-500 p-1"><Star size={16} /></button>
                            <button onClick={(e) => { e.stopPropagation(); updateMix(mix.id, { isHidden: true }); }} className="text-slate-500 hover:text-white p-1"><EyeOff size={16} /></button>
                            <button onClick={(e) => deleteMix(mix.id, e)} className="text-slate-500 hover:text-red-400 p-1"><Trash2 size={16} /></button>
                          </>
                        )}
                      </div>
                    </summary>
                    <div className="p-3 pt-0 text-xs text-slate-400">
                      {isEditMode ? (
                        <textarea 
                          value={mix.description || ''}
                          onChange={(e) => updateMix(mix.id, { description: e.target.value })}
                          placeholder="Add a note..."
                          maxLength={150}
                          className="w-full bg-black/20 border border-white/10 rounded p-2 text-white mb-2 resize-none"
                          rows={2}
                        />
                      ) : generatingDescId === mix.id ? (
                        <span className="text-indigo-400 mb-2 flex items-center gap-1"><Loader2 size={12} className="animate-spin"/> Generating...</span>
                      ) : mix.description ? (
                        <p className="mb-2 italic">"{mix.description}"</p>
                      ) : (
                        <button onClick={(e) => generateDescription(mix, e)} className="text-indigo-400 hover:text-indigo-300 mb-2 flex items-center gap-1"><Sparkles size={12}/> Auto-generate description</button>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(mix.volumes).filter(([_, v]) => v > 0).map(([k, v]) => (
                          <span key={k} className="bg-black/30 px-2 py-0.5 rounded-md">{k.replace('binaural_', '')}: {Math.round(v*100)}%</span>
                        ))}
                      </div>
                    </div>
                  </details>
                ))
              )}
            </div>
          </div>

          {/* Hidden Mixes */}
          {hiddenMixes.length > 0 && (
            <details className="mt-6">
              <summary className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2 cursor-pointer flex items-center gap-2">
                <EyeOff size={14} /> Hidden Mixes ({hiddenMixes.length})
              </summary>
              <div className="space-y-2 pl-2 border-l-2 border-white/5">
                {hiddenMixes.map(mix => (
                  <div key={mix.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                    <span className="text-sm text-slate-400 truncate">{mix.name}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateMix(mix.id, { isHidden: false })} className="text-slate-500 hover:text-white p-1" title="Unhide"><Eye size={14} /></button>
                      <button onClick={(e) => deleteMix(mix.id, e)} className="text-slate-500 hover:text-red-400 p-1"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}

        </div>
      </div>

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowInfo(false)}>
          <div className="bg-[#25262b] border border-white/10 rounded-2xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2"><Info size={20} className="text-indigo-400"/> Sound Guide</h2>
              <button onClick={() => setShowInfo(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
            </div>
            <div className="space-y-6 text-sm text-slate-300">
              <section>
                <h3 className="text-white font-medium mb-2 text-base">Background Noises</h3>
                <ul className="space-y-2">
                  <li><strong className="text-indigo-300">Brown Noise:</strong> Deeper than pink/white noise. Excellent for ADHD as it provides a constant, soothing rumble that blocks out distracting thoughts without being harsh.</li>
                  <li><strong className="text-indigo-300">Pink Noise:</strong> Balanced frequencies, sounds like a waterfall. Great for general focus and masking background chatter.</li>
                  <li><strong className="text-indigo-300">White Noise:</strong> Contains all frequencies equally. Sounds like static. Best for masking sharp, sudden noises (like doors slamming).</li>
                </ul>
              </section>
              <section>
                <h3 className="text-white font-medium mb-2 text-base">Binaural Beats</h3>
                <p className="mb-2 text-slate-400 italic">Requires headphones. Plays slightly different frequencies in each ear to encourage your brain to sync to specific states.</p>
                <ul className="space-y-2">
                  <li><strong className="text-indigo-300">Delta (1-4Hz):</strong> Deep sleep & physical healing. Promotes profound relaxation. Not recommended for active studying.</li>
                  <li><strong className="text-indigo-300">Theta (4-8Hz):</strong> REM sleep, deep meditation, and creativity. Good for brainstorming or artistic tasks.</li>
                  <li><strong className="text-indigo-300">Alpha (8-14Hz):</strong> Relaxed focus, stress reduction, and accelerated learning. Ideal for reading and absorbing information.</li>
                  <li><strong className="text-indigo-300">Beta (14-30Hz):</strong> Focused attention, analytical thinking, and problem-solving. Perfect for complex tasks like chemistry assignments.</li>
                  <li><strong className="text-indigo-300">Gamma (30-50Hz):</strong> High-level information processing and cognitive enhancement. For when you need to be completely locked in.</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Remix Modal */}
      {showRemixModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowRemixModal(null)}>
          <div className="bg-[#25262b] border border-white/10 rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-2">
              Remix {showRemixModal === 'synth' ? 'Synth' : 'Mix'}
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              How would you like to change the current {showRemixModal === 'synth' ? 'sound' : 'mix'}?
            </p>
            <input
              type="text"
              value={remixInput}
              onChange={e => setRemixInput(e.target.value)}
              placeholder={showRemixModal === 'synth' ? "e.g., Make it deeper and slower" : "e.g., Add more energy and rain"}
              className="w-full bg-[#1a1b1e] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 mb-4"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && remixInput.trim()) {
                  handleAiAction(true, true, remixInput, showRemixModal);
                  setShowRemixModal(null);
                  setRemixInput('');
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRemixModal(null)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button 
                onClick={() => {
                  if (remixInput.trim()) {
                    handleAiAction(true, true, remixInput, showRemixModal);
                    setShowRemixModal(null);
                    setRemixInput('');
                  }
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors"
              >
                Remix
              </button>
            </div>
          </div>
        </div>
      )}

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
          <div className="flex items-center gap-1">
            <button onClick={() => setShowInfo(true)} className="p-2 text-slate-400 hover:text-white transition-colors" title="Sound Info">
              <Info size={22} />
            </button>
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
          </div>
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
        <div className="flex flex-col items-center gap-6 mb-12 relative">
          <div className="absolute right-0 top-0 flex gap-2">
            <button onClick={handleReset} className="p-2 text-slate-500 hover:text-red-400 transition-colors bg-[#25262b] rounded-full border border-white/5" title="Reset all sounds">
              <RotateCcw size={18} />
            </button>
          </div>

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
          <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-3">
            <div className="flex gap-4">
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
            <div className="flex gap-2">
              <button onClick={handleUndo} disabled={historyIndex <= 0} className="text-slate-500 hover:text-white disabled:opacity-30"><Undo2 size={16}/></button>
              <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="text-slate-500 hover:text-white disabled:opacity-30"><Redo2 size={16}/></button>
            </div>
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
              placeholder={aiMode === 'mix' ? "Leave empty for a surprise, or type..." : "e.g., A calm, woody drone..."}
              className="flex-1 bg-[#1a1b1e] border border-white/10 rounded-xl px-4 py-3 text-sm sm:text-base text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              disabled={isGenerating}
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleAiAction(false, false, "")}
                disabled={isGenerating}
                className="bg-white/5 hover:bg-white/10 text-slate-300 px-4 py-3 rounded-xl font-medium transition-colors flex items-center justify-center"
                title="Surprise Me"
              >
                <Sparkles size={18} />
              </button>
              <button
                onClick={() => {
                  setRemixInput('');
                  setShowRemixModal(aiMode);
                }}
                disabled={isGenerating || (aiMode === 'synth' && !engine.getCustomSynthParams())}
                className="bg-white/5 hover:bg-white/10 text-slate-300 px-4 py-3 rounded-xl font-medium transition-colors flex items-center justify-center"
                title="Remix Current"
              >
                <Edit3 size={18} />
              </button>
              <button
                onClick={() => handleAiAction()}
                disabled={isGenerating || (!aiPrompt.trim() && aiMode === 'synth')}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center justify-center min-w-[100px] flex-1 sm:flex-none"
              >
                {isGenerating ? <Loader2 size={20} className="animate-spin" /> : 'Generate'}
              </button>
            </div>
          </div>

          {aiMode === 'mix' && (
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-400">
              <label className="flex items-center gap-2 cursor-pointer hover:text-slate-300 transition-colors">
                <input 
                  type="checkbox" 
                  checked={includeBackground} 
                  onChange={e => setIncludeBackground(e.target.checked)} 
                  className="w-4 h-4 rounded border-white/10 bg-black/20 text-indigo-500 focus:ring-indigo-500/50 accent-indigo-500" 
                />
                Include background noises
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-slate-300 transition-colors">
                <input 
                  type="checkbox" 
                  checked={buildOnCurrent} 
                  onChange={e => setBuildOnCurrent(e.target.checked)} 
                  className="w-4 h-4 rounded border-white/10 bg-black/20 text-indigo-500 focus:ring-indigo-500/50 accent-indigo-500" 
                />
                Build upon current mix
              </label>
            </div>
          )}
        </div>

        {/* Custom Synth Volume & Options (if active) */}
        {engine.getCustomSynthParams() && (
          <div className={`mb-8 p-5 rounded-2xl border transition-all duration-300 ${volumes['custom_synth'] > 0 && !muted['custom_synth'] ? 'bg-indigo-500/10 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'bg-[#25262b] border-white/5'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => toggleMute('custom_synth')}
                  className={`p-2 rounded-lg transition-colors ${muted['custom_synth'] ? 'bg-red-500/20 text-red-400' : 'bg-indigo-500/20 text-indigo-400'}`}
                >
                  {muted['custom_synth'] ? <VolumeX size={20} /> : <Music size={20} />}
                </button>
                <div>
                  <h3 className={`font-medium ${muted['custom_synth'] ? 'text-slate-500' : 'text-indigo-100'}`}>{aiSynthName || 'AI Custom Synth'}</h3>
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
              <button onClick={() => handleAiAction(true, false, undefined, 'synth')} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium text-slate-300 transition-colors">
                <RefreshCw size={14} /> Try Again
              </button>
              <button onClick={() => {
                setRemixInput('');
                setShowRemixModal('synth');
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
              <div key={id} className={`pt-4 transition-all duration-300 rounded-xl p-3 -mx-3 ${volumes[id] > 0 && !muted[id] ? 'bg-indigo-500/5 shadow-[inset_0_0_10px_rgba(99,102,241,0.05)]' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => toggleMute(id)}
                      className={`p-1.5 rounded-lg transition-colors ${muted[id] ? 'bg-red-500/20 text-red-400' : volumes[id] > 0 ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-slate-400'}`}
                    >
                      {muted[id] ? <VolumeX size={16} /> : <Icon size={16} />}
                    </button>
                    <div>
                      <h3 className={`font-medium text-sm ${muted[id] ? 'text-slate-500' : volumes[id] > 0 ? "text-indigo-200" : "text-slate-200"}`}>{label}</h3>
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
              <div key={id} className={`pt-4 transition-all duration-300 rounded-xl p-3 -mx-3 ${volumes[id] > 0 && !muted[id] ? 'bg-slate-700/30 shadow-[inset_0_0_10px_rgba(255,255,255,0.02)]' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => toggleMute(id)}
                      className={`p-1.5 rounded-lg transition-colors ${muted[id] ? 'bg-red-500/20 text-red-400' : volumes[id] > 0 ? 'bg-white/10 text-white' : 'bg-white/5 text-slate-400'}`}
                    >
                      {muted[id] ? <VolumeX size={16} /> : <Icon size={16} />}
                    </button>
                    <div>
                      <h3 className={`font-medium text-sm ${muted[id] ? 'text-slate-500' : volumes[id] > 0 ? "text-white" : "text-slate-200"}`}>{label}</h3>
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
