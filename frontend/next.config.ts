import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            {
                // Cloudflare R2 Public URL (r2.dev)
                protocol: "https",
                hostname: "*.r2.dev",
            },
            {
                // AWS S3
                protocol: "https",
                hostname: "*.amazonaws.com",
            },
        ],
    },
};

export default nextConfig;
