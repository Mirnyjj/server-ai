import { env } from "../../../config/env";
import { createInstagramClient } from "../client/instagram.client";
import type {
  CreateImageContainerInput,
  CreateReelInput,
  CreateStoryInput,
  CreateVideoContainerInput,
  InstagramContainerStatus,
} from "./content.types";

export function createInstagramContainerService(accessToken: string) {
  const instagramClient = createInstagramClient({
    accessToken,
    apiVersion: env.INSTAGRAM_API_VERSION,
  });

  async function createImageContainer(input: CreateImageContainerInput) {
    return instagramClient.createImageContainer(
      input.instagramUserId,
      input.imageUrl,
      input.caption,
      input.altText,
      input.isAiGenerated,
    );
  }

  async function createVideoContainer(input: CreateVideoContainerInput) {
    return instagramClient.createVideoContainer(
      input.instagramUserId,
      input.videoUrl,
      input.caption,
      input.isAiGenerated,
    );
  }

  async function createCarouselItemContainer(
    instagramUserId: string,
    item: {
      imageUrl?: string;
      videoUrl?: string;
    },
  ) {
    return instagramClient.createCarouselItemContainer(instagramUserId, item);
  }

  async function createCarouselContainer(
    instagramUserId: string,
    children: string[],
    caption?: string,
    isAiGenerated?: boolean,
  ) {
    return instagramClient.createCarouselContainer(
      instagramUserId,
      children,
      caption,
      isAiGenerated,
    );
  }

  async function getStatus(
    containerId: string,
  ): Promise<InstagramContainerStatus> {
    const status = await instagramClient.getContainerStatus(containerId);

    if (!status.status_code) {
      throw new Error(
        `Instagram container ${containerId} returned no status_code`,
      );
    }

    if (
      status.status_code !== "EXPIRED" &&
      status.status_code !== "ERROR" &&
      status.status_code !== "FINISHED" &&
      status.status_code !== "IN_PROGRESS" &&
      status.status_code !== "PUBLISHED"
    ) {
      throw new Error(
        `Instagram container ${containerId} returned unknown status_code: ${status.status_code}`,
      );
    }

    return {
      id: status.id,
      status_code: status.status_code,
    };
  }

  async function waitUntilReady(
    containerId: string,
    options: {
      intervalMs?: number;
      timeoutMs?: number;
    } = {},
  ) {
    const intervalMs = options.intervalMs ?? 60_000;
    const timeoutMs = options.timeoutMs ?? 5 * 60_000;

    const startedAt = Date.now();

    while (true) {
      const status = await getStatus(containerId);

      if (status.status_code === "FINISHED") {
        return status;
      }

      if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
        throw new Error(
          `Instagram container ${containerId} failed: ${status.status_code}`,
        );
      }

      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error(`Instagram container ${containerId} timed out`);
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  async function createReelContainer(input: CreateReelInput) {
    return instagramClient.createReelContainer(
      input.instagramUserId,
      input.videoUrl,
      input.caption,
      input.isAiGenerated,
    );
  }

  async function createStoryContainer(input: CreateStoryInput) {
    return instagramClient.createStoryContainer(
      input.instagramUserId,
      input.imageUrl,
      input.videoUrl,
      input.isAiGenerated,
    );
  }

  return {
    createImageContainer,
    createVideoContainer,
    createCarouselItemContainer,
    createCarouselContainer,
    getStatus,
    createReelContainer,
    waitUntilReady,
    createStoryContainer,
  };
}
