export type VideoCompositionScene = {
  url: string;
  durationSec?: number;
};

export type VideoCompositionRequest = {
  scenes: VideoCompositionScene[];
  width: number;
  height: number;
  fps?: number;
  outputFormat?: "mp4";
};

export type VideoComposer = {
  readonly name: string;
  compose(request: VideoCompositionRequest): Promise<{
    contentBase64: string;
    mimeType: "video/mp4";
    durationMs: number;
    width: number;
    height: number;
  }>;
};
