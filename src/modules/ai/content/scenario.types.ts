/**
 * Content scenario — structured output from Luna (not from image/video models).
 * Luna plans → generators execute visual brief.
 */

export type ContentScenario = {
  /** Short internal title */
  title: string;
  postType: "PHOTO" | "REEL" | "STORY" | "CAROUSEL" | "VIDEO";
  /** Instagram caption (final or near-final) */
  caption: string;
  /** Hashtags without # optional */
  hashtags?: string[];
  /** Hook / first line strategy */
  hook?: string;
  /** Detailed prompt for ImageGenerator or VideoGenerator */
  visualBrief: {
    prompt: string;
    negativePrompt?: string;
    aspectRatio?: "1:1" | "4:5" | "9:16" | "16:9";
    /** Which reference types to emphasize */
    emphasizeReferences?: Array<
      "FACE" | "FULL_BODY" | "STYLE" | "OUTFIT" | "LOCATION" | "LIGHTING"
    >;
    mood?: string;
    camera?: string;
  };
  /** For carousel — multiple frames */
  slides?: Array<{
    visualBrief: ContentScenario["visualBrief"];
    captionPart?: string;
  }>;
  /** For reels — optional shot list */
  shots?: Array<{
    durationSec: number;
    visualBrief: ContentScenario["visualBrief"];
  }>;
  scheduledHint?: string;
  reasoning?: string;
};

export type AnalyticsInsight = {
  insights: Array<{
    topic: string;
    metric: string;
    change: number;
    note?: string;
  }>;
  recommendations: Array<{
    type: string;
    value: string;
    rationale?: string;
  }>;
};
