import type { Metadata } from "next";
import { NotFoundClient } from "./_not-found-client";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "The oracle has no wisdom here. Return to Fortune Sats.",
  robots: { index: false },
};

export default function NotFound() {
  return <NotFoundClient />;
}
