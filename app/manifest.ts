import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LaundryTrack",
    short_name: "LaundryTrack",
    description: "LaundryTrack offline-first laundry shop management",
    start_url: "/",
    display: "standalone",
    background_color: "#0c249c",
    theme_color: "#0c249c",
    icons: [
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/icon-light-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/icon-dark-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
    ],
  };
}
