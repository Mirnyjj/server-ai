export type InstagramMediaContainerResponse = {
  id: string;
};

export type InstagramContainerStatusResponse = {
  id: string;
  status_code?: string;
  status?: string;
};

export type InstagramPublishMediaResponse = {
  id: string;
};
export type CreateImageContainerInput = {
  instagramUserId: string;
  imageUrl: string;
  caption?: string;
  altText?: string;
  isAiGenerated?: boolean;
};

export type CreateVideoContainerInput = {
  instagramUserId: string;
  videoUrl: string;
  caption?: string;
  isAiGenerated?: boolean;
};

export type CreateReelInput = {
  instagramUserId: string;
  videoUrl: string;
  caption?: string;
  isAiGenerated?: boolean;
};

export type CarouselItem = {
  imageUrl?: string;
  videoUrl?: string;
};

export type CreateCarouselInput = {
  instagramUserId: string;
  items: CarouselItem[];
  caption?: string;
  isAiGenerated?: boolean;
};

export type InstagramContainerResponse = {
  id: string;
};

export type InstagramContainerStatus = {
  id: string;
  status_code: "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";
};

export type InstagramPublishResponse = {
  id: string;
};

export type CreateStoryInput = {
  instagramUserId: string;
  imageUrl?: string;
  videoUrl?: string;
  isAiGenerated?: boolean;
};
