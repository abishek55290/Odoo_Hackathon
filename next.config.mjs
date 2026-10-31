/** @type {import("next").NextConfig} */
const nextConfig = {
  typescript: {
    // Type checking is strictly enforced by `npm run typecheck`
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
