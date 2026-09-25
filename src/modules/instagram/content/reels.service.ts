import { createInstagramContainerService } from "./container.service.js";
import type { CreateReelInput } from "./content.types.js";

export function createInstagramReelsService(accessToken: string) {
  const containerService = createInstagramContainerService(accessToken);

  async function createReel(input: CreateReelInput) {
    return containerService.createReelContainer(input);
  }

  async function waitUntilReady(containerId: string) {
    return containerService.waitUntilReady(containerId);
  }

  return {
    createReel,
    waitUntilReady,
  };
}
