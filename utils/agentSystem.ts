
import { UnifiedEvent, EventCategory, EventStatus, RawIntercept, LiveRitual, RitualType } from "../types";
import { aiClient } from "./aiClient";

export class AgentOrchestrator {
  // Prompts, models and schemas now live server-side in
  // server/routes/gemini.js; this class only orchestrates the calls.

  /**
   * THE "MIDDLE-MAN AGENT" (AI Normalization)
   * Takes raw noise, outputs Unified Event Protocol
   */
  async ingestAndNormalize(): Promise<UnifiedEvent> {
    // PER USER REQUEST: Strictly limit to Cultural Rituals. 
    // Removed: COSMIC, ATMOSPHERIC, MIGRATION, FLORA.
    const category = EventCategory.RITUAL;

    try {
      const { event: data, sourceUrl } = await aiClient.pulseIngest();

      const timestamp = Date.now();
      
      // Fallback coords if Gemini fails to provide them or provides [0,0]
      let coords: [number, number] = data.coordinates || [0, 0];
      if (!coords || (coords[0] === 0 && coords[1] === 0)) {
          coords = [20, 0]; // Default to equator if unknown, better than null island
      }

      return {
        uuid: crypto.randomUUID(),
        sourceUrl: sourceUrl,
        severity: data.severity || 3,
        category: category,
        title: data.title || "Cultural Activity Detected",
        description: data.description || "Live sensor data indicates ritual activity.",
        coordinates: coords,
        startTime: timestamp,
        endTime: timestamp + ((data.ttlHours || 12) * 60 * 60 * 1000),
        status: EventStatus.ACTIVE,
        detectedAt: timestamp
      };
    } catch (e) {
      console.error("Agent Ingestion Error", e);
      // Fallback to a generic cultural placeholder if API fails
      return {
        uuid: crypto.randomUUID(),
        sourceUrl: "https://unesco.org",
        severity: 2,
        category: EventCategory.RITUAL,
        title: "Daily Evening Rites",
        description: "Standard daily ceremonial observances at major cultural sites.",
        coordinates: [25.3176, 83.0062], // Varanasi
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        status: EventStatus.ACTIVE,
        detectedAt: Date.now()
      };
    }
  }

  // --- NEW AGENTIC WORKFLOW METHODS FOR SIGNAL INTELLIGENCE ---

  async runScout(location?: string): Promise<RawIntercept> {
    if (!location) {
      // Simulating finding a signal
      await new Promise(r => setTimeout(r, 1000));
      
      const intercepts: RawIntercept[] = [
        { source: "Twitter @LocalNewsKyoto", language: "Japanese", rawText: "Gion Matsuri procession starting now near Karasuma!", timestamp: Date.now() },
        { source: "Reddit r/India", language: "English", rawText: "Huge crowds at Dashashwamedh Ghat for Ganga Aarti tonight.", timestamp: Date.now() },
        { source: "Telegram Channel: AndeanEvents", language: "Spanish", rawText: "Qoyllur Rit'i pilgrims arriving at Sinakara valley.", timestamp: Date.now() },
        { source: "Local Feed: Salvador", language: "Portuguese", rawText: "Bloco Olodum initializing drumming sequence in Pelourinho.", timestamp: Date.now() }
      ];
      return intercepts[Math.floor(Math.random() * intercepts.length)];
    }

    try {
      const data = await aiClient.scout(location);
      return {
        source: data.source || `Web Search: ${location}`,
        language: data.language || "English",
        rawText: data.rawText || `Cultural activity detected in ${location}.`,
        timestamp: Date.now()
      };
    } catch (e) {
      console.error("Scout Error", e);
      return {
        source: "System Fallback",
        language: "English",
        rawText: `Unable to scan ${location} at this time.`,
        timestamp: Date.now()
      };
    }
  }

  async runPolyglot(intercept: RawIntercept): Promise<any> {
    return aiClient.polyglot(intercept.rawText, intercept.language);
  }

  async runFactChecker(data: any): Promise<any> {
    return aiClient.factCheck(data.eventName, data.location);
  }

  async runArchitect(data: any, verification: any): Promise<LiveRitual> {
     // We need coordinates.
     const coords = await aiClient.geocode(data.location);

     // Generate a dynamic unsplash URL based on the location or event category
     const searchQuery = encodeURIComponent(`${data.location} ${data.category}`);
     
     return {
       id: `live-${Date.now()}`,
       type: data.category,
       title: data.eventName,
       coordinates: [coords.lat, coords.lng],
       status: 'live',
       startTime: Date.now(),
       expiresAt: Date.now() + 3600000 * 4,
       etiquette: "Observe respectfully. Photography usually permitted unless stated otherwise.",
       imageUrl: `https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=600&auto=format&fit=crop`, // Keep generic for now to avoid broken links, but could be dynamic
       confidence: verification.confidence
     };
  }
}
