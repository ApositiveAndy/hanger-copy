export type PreparedPhoto = {
  dataUrl: string;
  base64: string;
  mime: "image/jpeg";
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error("Couldn’t read that photo. Use the camera, or a JPEG or PNG from your library."),
      );
    };
    image.src = url;
  });
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif|gif|bmp|avif)$/i.test(file.name)) {
    throw new Error("Choose a photo of the piece.");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("That photo is too large. Try another shot.");
  }
  const image = await loadImage(file);
  const maxEdge = 1280;
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Couldn’t read that photo.");
  context.drawImage(image, 0, 0, width, height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  const base64 = dataUrl.split(",")[1] ?? "";
  if (base64.length < 32) throw new Error("Couldn’t read that photo.");
  return { dataUrl, base64, mime: "image/jpeg" };
}

export async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}

export function base64FromDataUrl(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}
