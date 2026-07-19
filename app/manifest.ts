import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Voicenk",
    short_name: "Voicenk",
    description: "Universal Voice Messenger",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7f5",
    theme_color: "#111111",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}