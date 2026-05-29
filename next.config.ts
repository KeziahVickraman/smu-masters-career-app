import type { NextConfig } from "next";

// This project lives under ~/Desktop, which is iCloud-synced. iCloud races with
// Turbopack's rapid temp-file writes in the build directory and removes them
// mid-write — causing "ENOENT _buildManifest.js.tmp" / missing-manifest errors
// (500s in `next dev`, and failed local `next build`s). The `.nosync` suffix makes
// iCloud ignore the build directory, so we use it for all LOCAL work. On Vercel
// (VERCEL=1) the filesystem isn't iCloud-synced — keep the default `.next` there to
// avoid any output-detection surprises during deployment.
const nextConfig: NextConfig = {
  distDir: process.env.VERCEL ? ".next" : ".next.nosync",
};

export default nextConfig;
