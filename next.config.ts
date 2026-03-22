import type { NextConfig } from "next";
import withMdkCheckout from "@moneydevkit/nextjs/next-plugin";

const nextConfig: NextConfig = {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default withMdkCheckout(nextConfig as any);
