// Firebase Storage subset for the PawSnap demo: files become downscaled data URLs kept in this browser.
import { state, save, fbError } from "./core.js";

const storage = { type: "storage", app: null };
export function getStorage(app) { storage.app = app || null; return storage; }
export function ref(_s, path = "") { return { fullPath: path, name: path.split("/").pop(), bucket: "demo" }; }

function readAsDataURL(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
}
async function shrink(dataUrl, max = 1080) {
  if (!/^data:image\/(png|jpe?g|webp|gif|bmp)/i.test(dataUrl)) return dataUrl;
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8);
}
export async function uploadBytes(r, blob) {
  const url = await shrink(await readAsDataURL(blob));
  state.files[r.fullPath] = url;
  save();
  return { ref: r, metadata: { fullPath: r.fullPath, size: url.length } };
}
export const uploadBytesResumable = uploadBytes;
export async function getDownloadURL(r) {
  const url = state.files[r.fullPath];
  if (!url) throw fbError("storage/object-not-found");
  return url;
}
export async function deleteObject(r) { delete state.files[r.fullPath]; save(); }
