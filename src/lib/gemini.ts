import { GoogleGenAI, Type } from '@google/genai';
import { SynthParams } from './audio';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getAudioMixSuggestion(prompt: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `The user is using a focus soundscape app. They need a new mix of sounds to help them concentrate.
User's situation: "${prompt}"

Suggest a mix of these sounds (values from 0.0 to 1.0):
- brown, pink, white, rain
- binaural_delta (1-4Hz, deep sleep/healing)
- binaural_theta (4-8Hz, meditation/creativity)
- binaural_alpha (8-14Hz, relaxed focus/learning)
- binaural_beta (14-30Hz, active attention/problem solving)
- binaural_gamma (30-50Hz, high-level processing)

Return a comforting, encouraging message (1-2 sentences) and the suggested volume levels.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          message: { type: Type.STRING },
          settings: {
            type: Type.OBJECT,
            properties: {
              brown: { type: Type.NUMBER },
              pink: { type: Type.NUMBER },
              white: { type: Type.NUMBER },
              rain: { type: Type.NUMBER },
              binaural_delta: { type: Type.NUMBER },
              binaural_theta: { type: Type.NUMBER },
              binaural_alpha: { type: Type.NUMBER },
              binaural_beta: { type: Type.NUMBER },
              binaural_gamma: { type: Type.NUMBER },
            },
            required: ['brown', 'pink', 'white', 'rain', 'binaural_delta', 'binaural_theta', 'binaural_alpha', 'binaural_beta', 'binaural_gamma'],
          },
        },
        required: ['message', 'settings'],
      },
    },
  });

  if (!response.text) throw new Error('No response from Gemini');
  return JSON.parse(response.text);
}

export async function generateCustomSynth(prompt: string, previousParams?: SynthParams): Promise<{ name: string, message: string, params: SynthParams }> {
  const previousContext = previousParams 
    ? `\nPrevious parameters were: ${JSON.stringify(previousParams)}. Please adjust them based on the new request.` 
    : '';

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Design a continuous, generative ambient synth patch for a user who needs focus/relaxation.
User's request: "${prompt}"${previousContext}

Return a short, evocative name for this synth (e.g., "Deep Ocean Drone", "Crystal Focus"), an encouraging message, and the synthesizer parameters:
- baseFreq: 50 to 800 (Hz)
- detune: 0.1 to 10 (Hz)
- filterFreq: 100 to 2000 (Hz)
- filterType: "lowpass", "highpass", "bandpass", "notch"
- waveType: "sine", "square", "sawtooth", "triangle"
- lfoFreq: 0.05 to 5 (Hz) - controls filter modulation speed`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          message: { type: Type.STRING },
          params: {
            type: Type.OBJECT,
            properties: {
              baseFreq: { type: Type.NUMBER },
              detune: { type: Type.NUMBER },
              filterFreq: { type: Type.NUMBER },
              filterType: { type: Type.STRING },
              waveType: { type: Type.STRING },
              lfoFreq: { type: Type.NUMBER },
            },
            required: ['baseFreq', 'detune', 'filterFreq', 'filterType', 'waveType', 'lfoFreq'],
          },
        },
        required: ['name', 'message', 'params'],
      },
    },
  });

  if (!response.text) throw new Error('No response from Gemini');
  return JSON.parse(response.text);
}
