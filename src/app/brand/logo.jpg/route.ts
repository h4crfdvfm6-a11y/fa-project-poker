import { LOGO_JPEG_BASE64 } from "@/lib/brand-logo";

export const dynamic = "force-static";

export function GET() {
  return new Response(Buffer.from(LOGO_JPEG_BASE64, "base64"), {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
