import type { UploadAuthorization } from "../../types/bookable-images";

export async function uploadToImageKit(
  file: File,
  authorization: UploadAuthorization,
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileName", authorization.fileName || file.name);
  formData.append("publicKey", authorization.publicKey);
  formData.append("signature", authorization.signature);
  formData.append("token", authorization.token);
  formData.append("expire", String(authorization.expire));
  formData.append("folder", authorization.folder);

  const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    body: formData,
  });
  const body = (await response.json().catch(() => undefined)) as
    | { fileId?: string; message?: string }
    | undefined;

  if (!response.ok || !body?.fileId) {
    throw new Error(body?.message || "Image upload failed.");
  }

  return body.fileId;
}
