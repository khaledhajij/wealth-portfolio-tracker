import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The CA is public, server-side trust material. Its dynamic fs path is ignored
  // by automatic tracing; include this exact file for deployed Node functions.
  outputFileTracingIncludes: {
    "/*": ["./.certs/supabase-ca.crt"],
  },
};

export default nextConfig;
