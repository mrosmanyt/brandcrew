/** Same backend as the website. Override at runtime with EXPO_PUBLIC_CINEM_ORIGIN. */
export const DEFAULT_ORIGIN = "https://brandcrew.vercel.app";
export const PACKAGE_ID = "tech.cinem.pro";
export const PRODUCT_NAME = "CINEM Pro";

export function deskOrigin() {
  const fromEnv = process.env.EXPO_PUBLIC_CINEM_ORIGIN?.replace(/\/$/, "");
  return fromEnv || DEFAULT_ORIGIN;
}
