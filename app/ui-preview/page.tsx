import { notFound } from "next/navigation";
import PreviewClient from "./PreviewClient";

/**
 * Design fixtures for reviewing screens without signing in. Dev only: 404s in production.
 * The sample values here are NOT product data and never leave this route.
 */
export default function UiPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PreviewClient />;
}
