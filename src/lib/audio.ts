export type SoundType = 'brown' | 'pink' | 'white' | 'binaural' | 'rain';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying = false;

  private sources: Record<SoundType, { nodes: (AudioBufferSourceNode | OscillatorNode)[], gain: GainNode | null }> = {
    brown: { nodes: [], gain: null },
    pink: { nodes: [], gain: null },
    white: { nodes: [], gain: null },
    binaural: { nodes: [], gain: null },
    rain: { nodes: [], gain: null },
  };

  private volumes: Record<SoundType, number> = {
    brown: 0,
    pink: 0,
    white: 0,
    binaural: 0,
    rain: 0,
  };

  private initContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = 1;

      (Object.keys(this.sources) as SoundType[]).forEach((type) => {
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
      filter.frequency.value = 800; // Muffled rain sound
      
      source.connect(filter);
      filter.connect(this.sources[type].gain!);
      source.start();
      this.sources[type].nodes.push(source);
    } else if (type === 'binaural') {
      const leftOsc = this.ctx.createOscillator();
      const rightOsc = this.ctx.createOscillator();
      
      leftOsc.frequency.value = 200;
      rightOsc.frequency.value = 240; // 40Hz difference
      
      const merger = this.ctx.createChannelMerger(2);
      leftOsc.connect(merger, 0, 0);
      rightOsc.connect(merger, 0, 1);
      
      merger.connect(this.sources[type].gain!);
      
      leftOsc.start();
      rightOsc.start();
      
      this.sources[type].nodes.push(leftOsc, rightOsc);
    }
  }

  public async play() {
    this.initContext();
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
    
    if (!this.isPlaying) {
      (Object.keys(this.sources) as SoundType[]).forEach((type) => {
        this.startSource(type);
      });
      this.isPlaying = true;
    }
  }

  public stop() {
    if (this.isPlaying) {
      (Object.keys(this.sources) as SoundType[]).forEach((type) => {
        this.sources[type].nodes.forEach(node => {
          try { node.stop(); } catch (e) {}
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
}

export const engine = new AudioEngine();
