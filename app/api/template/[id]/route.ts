import { scanTemplateDirectory } from "@/features/playground/libs/path-to-json";
import { db } from "@/lib/db";
import { templatePaths } from "@/lib/template";
import path from "path";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const param = await params;
  const id = param?.id;

  if (!id || id === "undefined" || id === "null") {
    return Response.json({ error: "Missing or invalid playground ID" }, { status: 400 });
  }

  let templateKey: string | undefined;

  // 1. Check if ID matches a playground in database
  try {
    const playground = await db.playground.findUnique({
      where: { id },
    });
    if (playground?.template) {
      templateKey = playground.template;
    }
  } catch (error) {
    console.warn("Database query error for playground id:", id, error);
  }

  // 2. If not found in DB by ID, check if ID is itself a valid template key (e.g. REACT, EXPRESS, etc.)
  if (!templateKey) {
    const normalizedId = id.toUpperCase();
    if (templatePaths[normalizedId] || templatePaths[id]) {
      templateKey = templatePaths[normalizedId] ? normalizedId : id;
    }
  }

  // 3. Check case-insensitive match among all template keys
  if (!templateKey) {
    const found = Object.keys(templatePaths).find(k => k.toLowerCase() === id.toLowerCase());
    if (found) {
      templateKey = found;
    }
  }

  // 4. If still not found, return 404
  if (!templateKey) {
    return Response.json({ error: `Playground '${id}' not found` }, { status: 404 });
  }

  const templatePath = templatePaths[templateKey] || templatePaths[templateKey.toUpperCase()] || templatePaths[templateKey.toLowerCase()];

  if (!templatePath) {
    return Response.json({ error: `Invalid template: ${templateKey}` }, { status: 404 });
  }

  try {
    const inputPath = path.resolve(process.cwd(), templatePath);
    console.log(`[API /template/${id}] Scanning template path:`, inputPath);

    // Direct in-memory scan (no disk writing/unlinking required)
    const result = await scanTemplateDirectory(inputPath);

    if (!result || !result.items) {
      return Response.json({ error: "Failed to read template items" }, { status: 500 });
    }

    return Response.json({ success: true, templateJson: result }, { status: 200 });
  } catch (error) {
    console.error("Error generating template JSON:", error);
    return Response.json({ error: "Failed to generate template: " + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}