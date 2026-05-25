import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    // Enable server-side styled-components compilation registry
    styledComponents: true,
  },
};

export default nextConfig;
