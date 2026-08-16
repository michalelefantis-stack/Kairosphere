import { RitualType } from "../types";
import { aiClient } from "./aiClient";

export interface VerificationResult {
  isRitual: boolean;
  confidence: number;
  type: RitualType;
  title: string;
  etiquette: string;
  reasoning: string;
}

/**
 * Ask the backend whether a photo shows a ritual.
 *
 * The prompt and response schema live on the server; this only forwards the
 * image and coerces the answer back into our enum.
 */
export async function verifyRitualImage(base64Image: string): Promise<VerificationResult> {
  try {
    const result = await aiClient.verifyRitualImage(base64Image);

    return {
      isRitual: Boolean(result.isRitual),
      confidence: Number(result.confidence) || 0,
      type: (Object.values(RitualType) as string[]).includes(result.type)
        ? (result.type as RitualType)
        : RitualType.PHENOMENON,
      title: result.title ?? "Unknown Event",
      etiquette: result.etiquette ?? "",
      reasoning: result.reasoning ?? ""
    };
  } catch (error) {
    console.error("AI Verification Failed:", error);
    // Fail-safe return
    return {
      isRitual: false,
      confidence: 0,
      type: RitualType.PHENOMENON,
      title: "Unknown Event",
      etiquette: "",
      reasoning: "Verification service unavailable."
    };
  }
}
