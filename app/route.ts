import { catalogHtml } from "./catalog-html";
export const dynamic = "force-dynamic";
export async function GET() {
  return new Response(catalogHtml, { headers: {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  } });
}
