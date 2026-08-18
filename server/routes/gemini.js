import express from 'express';
import { getClient, sanitizeError } from '../services/gemini.js';

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

// User-supplied strings are interpolated into prompts, so they are capped and
// stripped. The fixed instruction plus a response schema bounds what a
// hostile string can achieve; length limits keep it from crowding out the
// instruction entirely.
const MAX_FIELD_LENGTH = 600;

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

  // Four more operations lived here: a generated event image, a ritual-photo
  // verifier, a four-stage news-scouting agent and a fact-checker. Each had a
  // matching client method, and not one was reachable in the app — two
  // components were imported and never rendered, one sat behind a tab with no
  // way to select it, and the image generator was a function nobody called.
  //
  // An endpoint nothing calls is quota a stranger can spend, so they are gone
  // rather than left running. Git has them if they are ever wanted.
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

export default router;
