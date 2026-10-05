import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // A document is sent to the server as text only. The longest one Redline
    // stores (MAX_DOCUMENT_CHARS, 300,000 characters) can pass 1 MB, the
    // default limit, once encoded.
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
