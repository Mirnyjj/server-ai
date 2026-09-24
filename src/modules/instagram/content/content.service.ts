import { createInstagramContainerService } from "./container.service";
import { createInstagramPublishService } from "./publish.service";
import { createInstagramReelsService } from "./reels.service";
import { createInstagramCarouselService } from "./carousel.service";
import type {
  CreateCarouselInput,
  CreateImageContainerInput,
  CreateReelInput,
  CreateStoryInput,
} from "./content.types";
import { createInstagramStoriesService } from "./stories.service";

export function createInstagramContentService(accessToken: string) {
  const containerService = createInstagramContainerService(accessToken);

  const publishService = createInstagramPublishService(accessToken);

  const storiesService = createInstagramStoriesService(accessToken);

  const reelsService = createInstagramReelsService(accessToken);

  const carouselService = createInstagramCarouselService(accessToken);

  async function publishImage(input: CreateImageContainerInput) {
    const container = await containerService.createImageContainer(input);

    await containerService.waitUntilReady(container.id);

    return publishService.publish(input.instagramUserId, container.id);
  }

  async function publishReel(input: CreateReelInput) {
    const container = await reelsService.createReel(input);

    await reelsService.waitUntilReady(container.id);

    return publishService.publish(input.instagramUserId, container.id);
  }

  async function publishCarousel(input: CreateCarouselInput) {
    return carouselService.publishCarousel(input);
  }

  async function publishStory(input: CreateStoryInput) {
    return storiesService.publishStory(input);
  }

  return {
    publishImage,
    publishReel,
    publishCarousel,
    publishStory,
  };
}
