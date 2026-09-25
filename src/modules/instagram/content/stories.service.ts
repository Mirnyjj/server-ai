import { createInstagramContainerService } from "./container.service.js";
import { createInstagramPublishService } from "./publish.service.js";
import type { CreateStoryInput } from "./content.types.js";

export function createInstagramStoriesService(accessToken: string) {
  const containerService = createInstagramContainerService(accessToken);
  const publishService = createInstagramPublishService(accessToken);

  async function publishStory(input: CreateStoryInput) {
    if (!input.imageUrl && !input.videoUrl) {
      throw new Error("Instagram Story requires imageUrl or videoUrl");
    }

    if (input.imageUrl && input.videoUrl) {
      throw new Error(
        "Instagram Story cannot contain both imageUrl and videoUrl",
      );
    }

    const container = await containerService.createStoryContainer(input);

    await containerService.waitUntilReady(container.id);

    return publishService.publish(input.instagramUserId, container.id);
  }

  return {
    publishStory,
  };
}
