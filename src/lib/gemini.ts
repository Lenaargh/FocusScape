import { GoogleGenAI, Type } from '@google/genai';
import { SynthParams } from './audio';

const BUILD_TIME_KEY = process.env.GEMINI_API_KEY || '';

let cachedClient: GoogleGenAI | null = null;
let cachedKey: string = '';

function getClient(apiKey?: string): GoogleGenAI {
  const key = apiKey || BUILD_TIME_KEY;
  if (!key) throw new Error('No API key configured');
  if (cachedClient && cachedKey === key) return cachedClient;
  cachedClient = new GoogleGenAI({ apiKey: key });
  cachedKey = key;
  return cachedClient;
}

export function hasBuiltInKey(): boolean {
  return BUILD_TIME_KEY.length > 0;
}

export async function getAudioMixSuggestion(prompt: string, hasCustomSynth: boolean, options: { includeBackground: boolean, currentVolumes?: Record<string, number> }, apiKey?: string) {
  const ai = getClient(apiKey);
  const userSituation = prompt.trim() ? `User's situation: "${prompt}"` : "The user wants a surprise mix. Be creative and design a unique, effective soundscape.";
  const customSynthInstruction = hasCustomSynth ? "\nThe user currently has an AI-generated custom synth active. You can choose to include it in the mix by setting 'custom_synth' volume between 0.0 and 1.0." : "";

  const backgroundInstruction = options.includeBackground
    ? "- brown, pink, white, rain"
    : "- brown, pink, white, rain (SET THESE TO 0.0 as the user requested no background noises)";

  const currentMixInstruction = options.currentVolumes
    ? `\nThe user's CURRENT mix volumes are: ${JSON.stringify(options.currentVolumes)}. Please use this as a starting point and adjust it to fit the new request.`
    : "";

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `The user is using a focus soundscape app. They need a new mix of sounds to help them concentrate.
${userSituation}${customSynthInstruction}${currentMixInstruction}

Suggest a mix of these sounds (values from 0.0 to 1.0):
${backgroundInstruction}
- binaural_delta (1-4Hz, deep sleep/healing)
- binaural_theta (4-8Hz, meditation/creativity)
- binaural_alpha (8-14Hz, relaxed focus/learning)
- binaural_beta (14-30Hz, active attention/problem solving)
- binaural_gamma (30-50Hz, high-level processing)
${hasCustomSynth ? "- custom_synth (The user's currently active AI synth)" : ""}

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
              custom_synth: { type: Type.NUMBER },
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

export async function generateCustomSynth(prompt: string, previousParams?: SynthParams, apiKey?: string): Promise<{ name: string, message: string, params: SynthParams }> {
  const ai = getClient(apiKey);
  const previousContext = previousParams
    ? `\nPrevious parameters were: ${JSON.stringify(previousParams)}. Please adjust them based on the new request.`
    : '';

  const userRequest = prompt.trim() ? `User's request: "${prompt}"` : "The user wants a surprise synth patch. Be highly creative, maybe something ethereal, deep, or rhythmic.";

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Design a continuous, generative ambient synth patch for a user who needs focus/relaxation.
Users can specify mood (e.g., 'calm', 'energetic') or timbre (e.g., 'metallic', 'woody').
${userRequest}${previousContext}

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

export async function generateMixDescription(mixName: string, volumes: Record<string, number>, synthParams: SynthParams | null, apiKey?: string): Promise<string> {
  const ai = getClient(apiKey);
  const activeSounds = Object.entries(volumes)
    .filter(([_, vol]) => vol > 0)
    .map(([name, vol]) => `${name}: ${Math.round(vol * 100)}%`)
    .join(', ');

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Write a short, poetic, and descriptive 2-sentence summary of this audio mix.
Mix Name: "${mixName}"
Active Sounds: ${activeSounds}
${synthParams ? `Includes a custom synth (Wave: ${synthParams.waveType}, Freq: ${synthParams.baseFreq}Hz).` : ''}

Focus on the mood and what it might be good for (e.g., deep focus, relaxing, blocking out noise).`,
  });

  if (!response.text) throw new Error('No response from Gemini');
  return response.text.trim();
}
