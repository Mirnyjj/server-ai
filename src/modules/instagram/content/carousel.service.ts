import { createInstagramContainerService } from "./container.service.js";
import { createInstagramPublishService } from "./publish.service.js";
import type { CreateCarouselInput } from "./content.types.js";

export function createInstagramCarouselService(accessToken: string) {
  const containerService = createInstagramContainerService(accessToken);

  const publishService = createInstagramPublishService(accessToken);

  async function publishCarousel(input: CreateCarouselInput) {
    if (input.items.length < 2) {
      throw new Error("Instagram carousel requires at least 2 items");
    }

    if (input.items.length > 10) {
      throw new Error("Instagram carousel supports up to 10 items");
    }

    const children: string[] = [];

    for (const item of input.items) {
      const container = await containerService.createCarouselItemContainer(
        input.instagramUserId,
        item,
      );

      children.push(container.id);
    }

    for (const containerId of children) {
      await containerService.waitUntilReady(containerId);
    }

    const carousel = await containerService.createCarouselContainer(
      input.instagramUserId,
      children,
      input.caption,
      input.isAiGenerated,
    );

    await containerService.waitUntilReady(carousel.id);

    return publishService.publish(input.instagramUserId, carousel.id);
  }

  return {
    publishCarousel,
  };
}
