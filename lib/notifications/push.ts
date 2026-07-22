export function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const raw = window.atob(base64);
  return Uint8Array.from(
    raw,
    (character) => character.charCodeAt(0),
  );
}

export function isStandalonePwa() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean(
      (window.navigator as Navigator & {
        standalone?: boolean;
      }).standalone,
    )
  );
}

export function isIosDevice() {
  if (typeof window === "undefined") return false;

  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}
