import { env } from "../../../config/env";
import { createInstagramClient } from "../client/instagram.client";
import { createCommentReconciliationService } from "./comments.reconciliation";

export function createInstagramCommentsService(accessToken: string) {
  const instagramClient = createInstagramClient({
    accessToken,
    apiVersion: env.INSTAGRAM_API_VERSION,
  });

  const reconciliation = createCommentReconciliationService(accessToken);

  async function listComments(
    mediaId: string,
    options?: { after?: string; limit?: number },
  ) {
    return instagramClient.listComments(mediaId, options);
  }

  async function listReplies(commentId: string) {
    return instagramClient.listCommentReplies(commentId);
  }

  async function replyToComment(commentId: string, message: string) {
    return instagramClient.replyToComment(commentId, message);
  }

  async function deleteComment(commentId: string) {
    return instagramClient.deleteComment(commentId);
  }

  return {
    listComments,
    listReplies,
    replyToComment,
    deleteComment,
    reconcilePostComments: reconciliation.reconcilePostComments,
    reconcileProfileComments: reconciliation.reconcileProfileComments,
  };
}
