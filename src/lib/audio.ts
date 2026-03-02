export const SOUND_TYPES = [
  'brown', 'pink', 'white', 'rain',
  'binaural_delta', 'binaural_theta', 'binaural_alpha', 'binaural_beta', 'binaural_gamma',
  'custom_synth'
] as const;

export type SoundType = typeof SOUND_TYPES[number];

export interface SynthParams {
  baseFreq: number;
  detune: number;
  filterFreq: number;
  filterType: BiquadFilterType;
  waveType: OscillatorType;
  lfoFreq: number;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  public analyzer: AnalyserNode | null = null;
  private isPlaying = false;

  private sources: Record<SoundType, { nodes: AudioNode[], gain: GainNode | null }> = {} as any;
  private volumes: Record<SoundType, number> = {} as any;
  private customSynthParams: SynthParams | null = null;

  constructor() {
    SOUND_TYPES.forEach(type => {
      this.sources[type] = { nodes: [], gain: null };
      this.volumes[type] = 0;
    });
  }

  private initContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.analyzer = this.ctx.createAnalyser();
      this.analyzer.fftSize = 512; // Increased for better visualizer resolution
      
      this.masterGain.connect(this.analyzer);
      this.analyzer.connect(this.ctx.destination);
      this.masterGain.gain.value = 1;

      SOUND_TYPES.forEach((type) => {
        const gainNode = this.ctx!.createGain();
        gainNode.gain.value = this.volumes[type];
        gainNode.connect(this.masterGain!);
        this.sources[type].gain = gainNode;
      });
    }
  }

  private createNoiseBuffer(type: 'white' | 'pink' | 'brown'): AudioBuffer {
    if (!this.ctx) throw new Error('AudioContext not initialized');
    const bufferSize = 2 * this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);

    if (type === 'white') {
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
    } else if (type === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.11;
        b6 = white * 0.115926;
      }
    } else if (type === 'brown') {
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5;
      }
    }

    return buffer;
  }

  private startSource(type: SoundType) {
    if (!this.ctx || !this.sources[type].gain) return;

    if (type === 'white' || type === 'pink' || type === 'brown') {
      const source = this.ctx.createBufferSource();
      source.buffer = this.createNoiseBuffer(type);
      source.loop = true;
      source.connect(this.sources[type].gain!);
      source.start();
      this.sources[type].nodes.push(source);
    } else if (type === 'rain') {
      const source = this.ctx.createBufferSource();
      source.buffer = this.createNoiseBuffer('pink');
      source.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      source.connect(filter);
      filter.connect(this.sources[type].gain!);
      source.start();
      this.sources[type].nodes.push(source, filter);
    } else if (type.startsWith('binaural_')) {
      const leftOsc = this.ctx.createOscillator();
      const rightOsc = this.ctx.createOscillator();
      
      let baseFreq = 200;
      let diff = 10;
      
      switch(type) {
        case 'binaural_delta': baseFreq = 100; diff = 2; break;
        case 'binaural_theta': baseFreq = 150; diff = 6; break;
        case 'binaural_alpha': baseFreq = 200; diff = 10; break;
        case 'binaural_beta': baseFreq = 250; diff = 20; break;
        case 'binaural_gamma': baseFreq = 300; diff = 40; break;
      }
      
      leftOsc.frequency.value = baseFreq;
      rightOsc.frequency.value = baseFreq + diff;
      
      const merger = this.ctx.createChannelMerger(2);
      leftOsc.connect(merger, 0, 0);
      rightOsc.connect(merger, 0, 1);
      merger.connect(this.sources[type].gain!);
      
      leftOsc.start();
      rightOsc.start();
      this.sources[type].nodes.push(leftOsc, rightOsc, merger);
    } else if (type === 'custom_synth' && this.customSynthParams) {
      const p = this.customSynthParams;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      osc1.type = p.waveType;
      osc2.type = p.waveType;
      osc1.frequency.value = p.baseFreq;
      osc2.frequency.value = p.baseFreq + p.detune;

      const filter = this.ctx.createBiquadFilter();
      filter.type = p.filterType;
      filter.frequency.value = p.filterFreq;

      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = p.lfoFreq;
      
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = p.filterFreq * 0.5;
      
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(this.sources[type].gain!);

      osc1.start();
      osc2.start();
      lfo.start();

      this.sources[type].nodes.push(osc1, osc2, lfo, lfoGain, filter);
    }
  }

  public setCustomSynthParams(params: SynthParams | null) {
    this.customSynthParams = params;
    if (this.isPlaying && params) {
      this.sources['custom_synth'].nodes.forEach(node => {
        try { (node as AudioScheduledSourceNode).stop(); } catch (e) {}
      });
      this.sources['custom_synth'].nodes = [];
      this.startSource('custom_synth');
    }
  }

  public getCustomSynthParams() {
    return this.customSynthParams;
  }
  
  public getAnalyzerData(dataArray: Uint8Array) {
    if (this.analyzer) {
      this.analyzer.getByteFrequencyData(dataArray);
    }
  }

  public setMasterVolume(volume: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.1);
    }
  }

  public async play() {
    this.initContext();
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
    
    if (!this.isPlaying) {
      SOUND_TYPES.forEach((type) => {
        this.startSource(type);
      });
      this.isPlaying = true;
    }
  }

  public stop() {
    if (this.isPlaying) {
      SOUND_TYPES.forEach((type) => {
        this.sources[type].nodes.forEach(node => {
          try { (node as AudioScheduledSourceNode).stop(); } catch (e) {}
        });
        this.sources[type].nodes = [];
      });
      this.isPlaying = false;
    }
  }

  public setVolume(type: SoundType, volume: number) {
    this.volumes[type] = volume;
    if (this.sources[type].gain && this.ctx) {
      this.sources[type].gain!.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.1);
    }
  }

  public getVolumes() {
    return { ...this.volumes };
  }

  public async recordLoop(durationMs: number = 10000): Promise<Blob> {
    if (!this.ctx || !this.masterGain) throw new Error('Audio engine not initialized');
    
    const dest = this.ctx.createMediaStreamDestination();
    this.masterGain.connect(dest);
    
    // Fallback to webm or default
    const options = MediaRecorder.isTypeSupported('audio/webm') 
      ? { mimeType: 'audio/webm' } 
      : undefined;
      
    const recorder = new MediaRecorder(dest.stream, options);
    const chunks: BlobPart[] = [];
    
    recorder.ondataavailable = e => chunks.push(e.data);
    
    return new Promise((resolve) => {
      recorder.onstop = () => {
        this.masterGain!.disconnect(dest);
        resolve(new Blob(chunks, { type: options?.mimeType || 'audio/mp4' }));
      };
      
      recorder.start();
      setTimeout(() => {
        recorder.stop();
      }, durationMs);
    });
  }
}

export const engine = new AudioEngine();
