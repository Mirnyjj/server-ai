import type { FastifyInstance } from "fastify";

import { env } from "../../../config/env";
import { createMetaTestClient } from "./meta-test.client";

export async function registerMetaTestRoutes(app: FastifyInstance) {
  const accessTokenInst = env.INSTAGRAM_MARKER;
  const accessTokenFace = process.env.FACE_MARKER;

  if (!accessTokenInst) {
    throw new Error("INSTAGRAM_MARKER is not configured");
  }

  if (!accessTokenFace) {
    throw new Error("FACE_MARKER is not configured");
  }

  const instagram = createMetaTestClient({
    accessToken: accessTokenInst,
    platform: "instagram",
  });

  const facebook = createMetaTestClient({
    accessToken: accessTokenFace,
    platform: "facebook",
  });

  // =========================================================
  // FACEBOOK
  // =========================================================

  app.get("/api/meta-test/me", async () => {
    return facebook.getMe();
  });

  app.get("/api/meta-test/pages", async () => {
    return facebook.getPages();
  });

  app.get<{
    Params: {
      pageId: string;
    };
  }>("/api/meta-test/pages/:pageId", async (request) => {
    return facebook.getPage(request.params.pageId);
  });

  app.get<{
    Params: {
      pageId: string;
    };
  }>("/api/meta-test/pages/:pageId/posts", async (request) => {
    return facebook.getPagePosts(request.params.pageId);
  });

  app.get<{
    Params: {
      pageId: string;
    };
  }>("/api/meta-test/pages/:pageId/feed", async (request) => {
    return facebook.getPageFeed(request.params.pageId);
  });

  // =========================================================
  // BUSINESS MANAGEMENT
  // =========================================================

  app.get("/api/meta-test/businesses", async () => {
    return facebook.getBusinesses();
  });

  app.get<{
    Params: {
      businessId: string;
    };
  }>("/api/meta-test/businesses/:businessId", async (request) => {
    return facebook.getBusiness(request.params.businessId);
  });

  app.get<{
    Params: {
      businessId: string;
    };
  }>("/api/meta-test/businesses/:businessId/owned-pages", async (request) => {
    return facebook.getBusinessOwnedPages(request.params.businessId);
  });

  app.get<{
    Params: {
      businessId: string;
    };
  }>("/api/meta-test/businesses/:businessId/client-pages", async (request) => {
    return facebook.getBusinessClientPages(request.params.businessId);
  });

  // =========================================================
  // BUSINESS ASSET USER PROFILE ACCESS
  // =========================================================

  app.get<{
    Params: {
      businessId: string;
    };
  }>("/api/meta-test/businesses/:businessId/users", async (request) => {
    return facebook.getBusinessUsers(request.params.businessId);
  });

  app.get<{ Params: { userId: string } }>(
    "/api/meta-test/business-asset-user-profile/:userId",
    async (request) =>
      facebook.getBusinessAssetUserProfile(request.params.userId),
  );

  // =========================================================
  // INSTAGRAM
  // =========================================================

  app.get<{
    Params: {
      instagramUserId: string;
    };
  }>("/api/meta-test/instagram/:instagramUserId", async (request) => {
    return instagram.getInstagramProfile(request.params.instagramUserId);
  });

  app.get<{
    Params: {
      instagramUserId: string;
    };
  }>("/api/meta-test/instagram/:instagramUserId/media", async (request) => {
    return instagram.getInstagramMedia(request.params.instagramUserId);
  });

  // Instagram Insights
  app.get<{
    Params: {
      instagramUserId: string;
    };
  }>("/api/meta-test/instagram/:instagramUserId/insights", async (request) => {
    return instagram.getInstagramInsights(request.params.instagramUserId);
  });

  // Instagram comments
  app.get<{
    Params: {
      mediaId: string;
    };
  }>("/api/meta-test/instagram/media/:mediaId/comments", async (request) => {
    return instagram.getInstagramComments(request.params.mediaId);
  });

  // Instagram media creation
  app.post<{
    Body: {
      instagramUserId: string;
      imageUrl: string;
      caption?: string;
    };
  }>("/api/meta-test/instagram/media", async (request) => {
    const { instagramUserId, imageUrl, caption } = request.body;

    return instagram.createInstagramPhoto(instagramUserId, imageUrl, caption);
  });

  // Instagram media publish
  app.post<{
    Body: {
      instagramUserId: string;
      creationId: string;
    };
  }>("/api/meta-test/instagram/media/publish", async (request) => {
    const { instagramUserId, creationId } = request.body;

    return instagram.publishInstagramMedia(instagramUserId, creationId);
  });
}
