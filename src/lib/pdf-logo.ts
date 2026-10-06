import path from "path";
import { readFile } from "fs/promises";

/*
 * Shared logo for every generated PDF (quote and contract).
 *
 * PDFs have a white page, so they must use the dark-text logo
 * (public/dryhome-logo-light.png, "light" = for light backgrounds).
 * public/dryhome-logo.png is the white-text variant for the dark
 * sidebar and dark page headers, and is invisible on a white PDF.
 */
let cachedLogo: Promise<string | null> | null = null;

export function loadPdfLogoDataUri(): Promise<string | null> {
  if (!cachedLogo) {
    cachedLogo = readLogo();
  }

  return cachedLogo;
}

async function readLogo(): Promise<string | null> {
  try {
    const logoBuffer = await readFile(
      path.join(process.cwd(), "public", "dryhome-logo-light.png")
    );

    return `data:image/png;base64,${logoBuffer.toString("base64")}`;
  } catch (error) {
    console.error("Unable to load PDF logo:", error);
    cachedLogo = null;

    return null;
  }
}
