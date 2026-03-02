import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getAudioMixSuggestion(prompt: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `The user is using a focus soundscape app. They need a new mix of sounds to help them concentrate.
User's situation: "${prompt}"

Suggest a mix of these 5 sounds (values from 0.0 to 1.0):
- brown: Deep, rumbling noise. Great for ADHD, blocking out distractions, and deep focus.
- pink: Balanced noise, like a waterfall. Good for general focus and soothing.
- white: Harsher, static noise. Good for masking sharp background noises.
- binaural: 40Hz Gamma waves. Good for locking into a task, cognitive enhancement.
- rain: Muffled rain sounds. Good for relaxation and gentle focus.

Return a comforting, encouraging message (1-2 sentences) and the suggested volume levels.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          message: {
            type: Type.STRING,
            description: 'A short, encouraging message explaining why this mix will help.',
          },
          settings: {
            type: Type.OBJECT,
            properties: {
              brown: { type: Type.NUMBER },
              pink: { type: Type.NUMBER },
              white: { type: Type.NUMBER },
              binaural: { type: Type.NUMBER },
              rain: { type: Type.NUMBER },
            },
            required: ['brown', 'pink', 'white', 'binaural', 'rain'],
          },
        },
        required: ['message', 'settings'],
      },
    },
  });

  if (!response.text) {
    throw new Error('No response from Gemini');
  }

  return JSON.parse(response.text);
}
