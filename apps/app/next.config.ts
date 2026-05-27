import type { NextConfig } from "next";

type WebpackResolveConfig = {
  extensionAlias?: Record<string, string[]>;
};

type WebpackConfig = {
  resolve?: WebpackResolveConfig;
};

const nextConfig: NextConfig = {
  webpack: (config: WebpackConfig) => {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js", ".jsx"]
    };

    return config;
  }
};

export default nextConfig;
