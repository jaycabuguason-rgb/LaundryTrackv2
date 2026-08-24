/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
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
    unoptimized: true,
  },
}

export default nextConfig
