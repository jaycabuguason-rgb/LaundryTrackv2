/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // P0-B: surface type errors in build (was ignoreBuildErrors:true)
    ignoreBuildErrors: false,
  },
  allowedDevOrigins: [
    "172.22.160.1",
    "localhost",
    "127.0.0.1",
    // VS Code port-forwarding / dev tunnels
    "*.devtunnels.ms",
    "*.asse.devtunnels.ms",
  ],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" },
    ],
  },
}

export default nextConfig
