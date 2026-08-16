import express from 'express';
import { Type } from '@google/genai';
import {
  getClient,
  firstGroundingUrl,
  parseJsonResponse,
  sanitizeError
} from '../services/gemini.js';

/**
 * A named-operation allowlist, not a passthrough proxy.
 *
 * The client picks an operation and supplies data; every prompt, model and
 * response schema is defined here on the server. A passthrough would still
 * keep the key off the client, but it would hand anyone who found the
 * endpoint a free general-purpose Gemini account billed to this project.
 */

const router = express.Router();

const TEXT_MODEL = 'gemini-3-flash-preview';
const IMAGE_MODEL = 'gemini-2.5-flash-image';
const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

// User-supplied strings are interpolated into prompts, so they are capped and
// stripped. The fixed instruction plus a response schema bounds what a
// hostile string can achieve; length limits keep it from crowding out the
// instruction entirely.
const MAX_FIELD_LENGTH = 600;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

function clean(value, max = MAX_FIELD_LENGTH) {
  if (typeof value !== 'string') return '';
  // Collapse control characters (including the newlines used to fake prompt
  // turns) into spaces, then squeeze runs of whitespace.
  let stripped = '';
  for (const char of value) {
    const code = char.codePointAt(0);
    stripped += code < 0x20 || code === 0x7f ? ' ' : char;
  }
  return stripped.replace(/\s+/g, ' ').trim().slice(0, max);
}

function required(value, field) {
  const cleaned = clean(value);
  if (!cleaned) {
    const error = new Error(`missing field: ${field}`);
    error.status = 400;
    error.public = `Missing required field: ${field}`;
    throw error;
  }
  return cleaned;
}

const OPERATIONS = {
  /** DetailPanel: resolve an event to "City, Country". */
  'precise-location': {
    async run(ai, params) {
      const title = required(params.title, 'title');
      const description = clean(params.description);
      const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: {
          parts: [{
            text: `Extract the specific City/Town and Country for the cultural event "${title}" based on this description: "${description}".
Return strictly in the format: "City, Country" (e.g. "Puno, Peru").
If the city is not mentioned, infer it from the event name or return just the "Country".
Do not add any other text.`
          }]
        }
      });
      return { location: response.text?.trim() ?? '' };
    }
  },

  /** DetailPanel: generate a header image for an event. */
  'event-image': {
    async run(ai, params) {
      const title = required(params.title, 'title');
      const region = clean(params.region);
      const description = clean(params.description);
      const response = await ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: {
          parts: [{
            text: `Create a highly detailed, photorealistic, National Geographic style photograph of the ${title} festival/ritual in ${region}.
Context: ${description}.
Visual details: Cinematic lighting, authentic cultural attire, deep depth of field, 8k resolution, documentary photography style.`
          }]
        }
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          return { dataUrl: `data:${mimeType};base64,${part.inlineData.data}` };
        }
      }
      return { dataUrl: null };
    }
  },

  /** ReportRitualModal: is this photo actually a ritual? */
  'verify-ritual-image': {
    async run(ai, params) {
      const raw = typeof params.image === 'string' ? params.image : '';
      const base64 = raw.includes(',') ? raw.split(',')[1] : raw;
      if (!base64) {
        const error = new Error('missing image');
        error.status = 400;
        error.public = 'No image supplied.';
        throw error;
      }
      if (base64.length > MAX_IMAGE_BYTES) {
        const error = new Error('image too large');
        error.status = 413;
        error.public = 'Image is too large (6MB maximum).';
        throw error;
      }

      const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64 } },
            { text: 'Analyze this image. Is this a cultural ceremony, religious event, festival, or traditional procession?' }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isRitual: { type: Type.BOOLEAN },
              confidence: { type: Type.NUMBER },
              type: {
                type: Type.STRING,
                enum: ['Festival', 'Ceremony', 'Spiritual', 'Pilgrimage', 'Performance', 'Phenomenon']
              },
              title: { type: Type.STRING },
              etiquette: { type: Type.STRING },
              reasoning: { type: Type.STRING }
            },
            required: ['isRitual', 'confidence', 'type', 'title', 'etiquette', 'reasoning']
          }
        }
      });
      return parseJsonResponse(response.text, {});
    }
  },

  /** AgentOrchestrator.ingestAndNormalize */
  'pulse-ingest': {
    async run(ai) {
      const now = new Date();
      const dateString = now.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
      });

      const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: {
          parts: [{
            text: `You are the "Live Cultural Pulse" monitor.
TASK: Find a REAL, VERIFIABLE HUMAN CULTURAL EVENT happening RIGHT NOW or TODAY (${dateString}).

Strictly prioritize:
1. Royal or Religious Processions (e.g., funeral processions, coronation parades).
2. Sacred Rituals at major temples/shrines (e.g., Ganga Aarti, daily liturgy at Vatican if special).
3. Indigenous Ceremonies (e.g., Powwows, initiations).
4. Major Cultural Festivals (Opening/Closing ceremonies, main parades).

ABSOLUTELY NO:
- Astronomical events (Eclipses, Meteor showers).
- Weather events.
- Political rallies or protests (unless strictly ritualistic/traditional).
- Online-only events.

Use Google Search to find "live updates", "happening now", "today's schedule", or news from the last 24 hours.

Return JSON:
{
  "title": "Specific Event Name",
  "description": "Precise, journalistic description of what is happening at this moment.",
  "location": "City, Country",
  "coordinates": [latitude, longitude],
  "severity": 1-5,
  "ttlHours": 12
}`
          }]
        },
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: 'application/json'
        }
      });

      return {
        event: parseJsonResponse(response.text, {}),
        sourceUrl: firstGroundingUrl(response, 'https://news.google.com')
      };
    }
  },

  /** AgentOrchestrator.runScout */
  scout: {
    async run(ai, params) {
      const location = required(params.location, 'location');
      const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: {
          parts: [{
            text: `Search the web for a cultural event, festival, ritual, or local celebration happening right now or in the next few days in or near "${location}".
Return a JSON object representing a raw social media post, news headline, or local update about this event.
Keys required:
- source: The platform or news site
- language: The language of the text
- rawText: A short, realistic text snippet describing the event starting or happening (max 2 sentences).`
          }]
        },
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              source: { type: Type.STRING },
              language: { type: Type.STRING },
              rawText: { type: Type.STRING }
            }
          }
        }
      });
      return parseJsonResponse(response.text, {});
    }
  },

  /** AgentOrchestrator.runPolyglot */
  polyglot: {
    async run(ai, params) {
      const rawText = required(params.rawText, 'rawText');
      const language = clean(params.language) || 'unknown';
      const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: {
          parts: [{
            text: `Extract event details from this text: "${rawText}".
Language: ${language}.
Return JSON with keys: eventName, location, category (Festival, Ceremony, Spiritual).`
          }]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              eventName: { type: Type.STRING },
              location: { type: Type.STRING },
              category: { type: Type.STRING }
            }
          }
        }
      });
      return parseJsonResponse(response.text, {});
    }
  },

  /** AgentOrchestrator.runFactChecker */
  'fact-check': {
    async run(ai, params) {
      const eventName = required(params.eventName, 'eventName');
      const location = clean(params.location);
      const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: {
          parts: [{
            text: `Verify if "${eventName}" in "${location}" is a plausible real-world cultural event.
Return JSON with keys: verified (boolean), confidence (number 0-1), sourceUrls (array of strings).`
          }]
        },
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              verified: { type: Type.BOOLEAN },
              confidence: { type: Type.NUMBER },
              sourceUrls: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        }
      });
      return parseJsonResponse(response.text, {});
    }
  },

  /** AgentOrchestrator.runArchitect needs coordinates. */
  geocode: {
    async run(ai, params) {
      const location = required(params.location, 'location');
      const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: { parts: [{ text: `Get GPS coordinates for "${location}". Return JSON with keys: lat, lng.` }] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: { lat: { type: Type.NUMBER }, lng: { type: Type.NUMBER } }
          }
        }
      });
      return parseJsonResponse(response.text, { lat: 0, lng: 0 });
    }
  }
};

router.get('/operations', (_req, res) => {
  res.json({ operations: Object.keys(OPERATIONS) });
});

router.post('/:operation', async (req, res) => {
  const operation = OPERATIONS[req.params.operation];
  if (!operation) {
    return res.status(404).json({ error: `Unknown operation: ${req.params.operation}` });
  }

  try {
    const ai = getClient();
    const result = await operation.run(ai, req.body ?? {});
    res.json(result);
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ error: message });
  }
});

/**
 * WhisperOverlay streams bidirectional audio over the Live API's WebSocket,
 * which no REST proxy can sit in front of. An ephemeral token is the
 * supported answer: minted here with the real key, single-use, short-lived,
 * and locked to the Live model so it cannot be spent on anything else.
 */
export async function createLiveToken(req, res) {
  try {
    const ai = getClient();
    const body = req.body ?? {};

    // The narration persona is built here, from the event data the client
    // sends, so a caller cannot repurpose the session with its own system
    // instruction. The whole config is locked into the token and echoed back
    // for the client to connect with verbatim.
    const title = clean(body.title) || 'an unnamed gathering';
    const type = clean(body.type) || 'ritual';
    const etiquette = clean(body.etiquette) || 'Observe quietly and respectfully.';

    const liveConfig = {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      systemInstruction: `You are 'The Whisperer', a mysterious, immersive narrator describing a live ritual happening right now.

Context:
Event: ${title}
Type: ${type}
Etiquette Guide: ${etiquette}

Your goal is to provide a "thick description" of the atmosphere, sounds, smells, and sights.
Speak in a hushed, reverent, and slightly fast-paced tone as if you are reporting live from the shadows.
Do not be an AI assistant. Be a window into this event.
Start immediately by describing the scene based on the event title and type.`
    };

    const now = Date.now();
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
        liveConnectConstraints: { model: LIVE_MODEL, config: liveConfig }
      }
    });

    if (!token?.name) throw new Error('token creation returned no name');
    res.json({ token: token.name, model: LIVE_MODEL, config: liveConfig });
  } catch (error) {
    const { status, message } = sanitizeError(error, 'Could not start a live session.');
    res.status(status).json({ error: message });
  }
}

export default router;
