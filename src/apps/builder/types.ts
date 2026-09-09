export interface PublishApprovalPayload {
  requestId: string;
  appId: string;
  name: string;
  prUrl: string | null;
  previewUrl: string | null;
}
