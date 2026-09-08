"use server";

import { currentUser } from "@/features/auth/actions";
import { db } from "@/lib/db";
import { Templates } from "@prisma/client";
import { revalidatePath } from "next/cache";
import path from "path";
import JSZip from "jszip";
import { TemplateFile, TemplateFolder } from "@/features/playground/libs/path-to-json";
import type {
  GithubRepoItem,
  GetUserReposResponse,
  ImportGithubRepoParams,
  ImportGithubRepoResponse,
} from "@/features/dashboard/types";

/**
 * Fetch the authenticated user's GitHub repositories using their linked GitHub OAuth account.
 */
export async function getUserGithubRepos(): Promise<GetUserReposResponse> {
  const user = await currentUser();
  if (!user?.id) {
    return {
      hasGithubConnected: false,
      repos: [],
      error: "You must be signed in to view your repositories.",
    };
  }

  try {
    const githubAccount = await db.account.findFirst({
      where: {
        userId: user.id,
        provider: "github",
      },
    });

    if (!githubAccount || !githubAccount.accessToken) {
      return {
        hasGithubConnected: false,
        repos: [],
      };
    }

    const res = await fetch(
      "https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member",
      {
        headers: {
          Authorization: `Bearer ${githubAccount.accessToken}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "VibeCoder-App",
        },
        cache: "no-store",
      }
    );

    if (res.status === 401) {
      return {
        hasGithubConnected: false,
        repos: [],
        error: "GitHub token has expired. Please reconnect your GitHub account.",
      };
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error("GitHub API error:", res.status, errText);
      return {
        hasGithubConnected: true,
        repos: [],
        error: `Failed to fetch repositories from GitHub (${res.status}).`,
      };
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      return {
        hasGithubConnected: true,
        repos: [],
      };
    }

    const repos: GithubRepoItem[] = data.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      isPrivate: repo.private,
      htmlUrl: repo.html_url,
      defaultBranch: repo.default_branch || "main",
      language: repo.language,
      stargazersCount: repo.stargazers_count || 0,
      forksCount: repo.forks_count || 0,
      updatedAt: repo.updated_at,
      owner: {
        login: repo.owner?.login || "",
        avatarUrl: repo.owner?.avatar_url || "",
      },
    }));

    return {
      hasGithubConnected: true,
      repos,
    };
  } catch (error) {
    console.error("Error in getUserGithubRepos:", error);
    return {
      hasGithubConnected: false,
      repos: [],
      error: "An unexpected error occurred while fetching repositories.",
    };
  }
}

const IGNORED_FOLDERS = [
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".turbo",
  ".vscode",
  ".idea",
  "coverage",
];

const IGNORED_FILES = [
  ".DS_Store",
  "thumbs.db",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
];

const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "ico",
  "mp4", "mp3", "wav", "ogg", "webm",
  "pdf", "zip", "tar", "gz", "rar", "7z",
  "woff", "woff2", "ttf", "eot", "otf",
  "exe", "dll", "so", "dylib", "bin",
  "pyc", "class", "lockb",
]);

function detectTemplateFromPackageJson(pkgContent: string): Templates {
  try {
    const pkg = JSON.parse(pkgContent);
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };

    if (allDeps["next"]) return "NEXTJS";
    if (allDeps["@angular/core"]) return "ANGULAR";
    if (allDeps["vue"] || allDeps["@vitejs/plugin-vue"]) return "VUE";
    if (allDeps["hono"] || allDeps["@hono/node-server"]) return "HONOR";
    if (allDeps["express"]) return "EXPRESS";
    return "REACT";
  } catch {
    return "REACT";
  }
}

function buildTemplateFolderFromFiles(
  files: { relativePath: string; content: string }[]
): TemplateFolder {
  const root: TemplateFolder = {
    folderName: "Root",
    items: [],
  };

  for (const file of files) {
    const segments = file.relativePath.split("/").filter(Boolean);
    if (segments.length === 0) continue;

    let currentFolder = root;

    // Traverse or create folders along the path
    for (let i = 0; i < segments.length - 1; i++) {
      const folderName = segments[i];
      let existing = currentFolder.items.find(
        (item): item is TemplateFolder =>
          "folderName" in item && item.folderName === folderName
      );

      if (!existing) {
        existing = {
          folderName,
          items: [],
        };
        currentFolder.items.push(existing);
      }

      currentFolder = existing;
    }

    // Add file to the leaf folder
    const fullFileName = segments[segments.length - 1];
    const parsed = path.parse(fullFileName);
    const templateFile: TemplateFile = {
      filename: parsed.name,
      fileExtension: parsed.ext.replace(/^\./, ""),
      content: file.content,
    };

    currentFolder.items.push(templateFile);
  }

  return root;
}



/**
 * Import a GitHub repository by downloading its archive, extracting files into TemplateFolder,
 * and creating a new Playground project in the database.
 */
export async function importGithubRepo(
  params: ImportGithubRepoParams
): Promise<ImportGithubRepoResponse> {
  const user = await currentUser();
  if (!user?.id) {
    return { success: false, error: "You must be signed in to import a repository." };
  }

  const { owner, repo, branch, customTitle } = params;
  if (!owner || !repo) {
    return { success: false, error: "Repository owner and name are required." };
  }

  try {
    // Check if user has connected GitHub to use their auth token (higher rate limit & private repo support)
    const githubAccount = await db.account.findFirst({
      where: {
        userId: user.id,
        provider: "github",
      },
    });

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "VibeCoder-App",
    };

    if (githubAccount?.accessToken) {
      headers["Authorization"] = `Bearer ${githubAccount.accessToken}`;
    }

    // 1. Fetch repo metadata to verify existence and get default branch if not specified
    const repoInfoRes = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      { headers }
    );

    if (!repoInfoRes.ok) {
      if (repoInfoRes.status === 404) {
        return {
          success: false,
          error: `Repository '${owner}/${repo}' was not found. If this is a private repository, please ensure your GitHub account is linked.`,
        };
      }
      return {
        success: false,
        error: `Failed to access repository '${owner}/${repo}' (HTTP ${repoInfoRes.status}).`,
      };
    }

    const repoInfo = await repoInfoRes.json();
    const targetBranch = branch || repoInfo.default_branch || "main";

    // 2. Fetch repo zipball archive
    const zipUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/zipball/${encodeURIComponent(targetBranch)}`;
    const zipRes = await fetch(zipUrl, {
      headers,
      redirect: "follow",
    });

    if (!zipRes.ok) {
      return {
        success: false,
        error: `Failed to download repository contents for branch '${targetBranch}' (${zipRes.status}).`,
      };
    }

    const zipBuffer = await zipRes.arrayBuffer();
    const zip = await JSZip.loadAsync(zipBuffer);

    // 3. Extract and filter files
    const extractedFiles: { relativePath: string; content: string }[] = [];
    let packageJsonContent: string | null = null;

    const entries = Object.keys(zip.files);
    for (const entryPath of entries) {
      const entry = zip.files[entryPath];
      if (entry.dir) continue;

      // GitHub zipballs put everything under a root folder: owner-repo-sha/...
      const parts = entryPath.split("/");
      // Remove the top-level folder
      parts.shift();
      const relativePath = parts.join("/");
      if (!relativePath) continue;

      // Check if any segment is in IGNORED_FOLDERS
      const shouldIgnoreFolder = parts
        .slice(0, -1)
        .some((part) => IGNORED_FOLDERS.includes(part));
      if (shouldIgnoreFolder) continue;

      const fileName = parts[parts.length - 1];
      if (IGNORED_FILES.includes(fileName)) continue;

      const ext = path.extname(fileName).replace(/^\./, "").toLowerCase();
      if (BINARY_EXTENSIONS.has(ext)) continue;

      try {
        const textContent = await entry.async("string");

        // Keep track of package.json for template detection
        if (relativePath === "package.json") {
          packageJsonContent = textContent;
        }

        extractedFiles.push({
          relativePath,
          content: textContent,
        });
      } catch (err) {
        console.warn(`Skipping unreadable file ${relativePath}:`, err);
      }
    }

    if (extractedFiles.length === 0) {
      return {
        success: false,
        error: "No usable files found in the repository.",
      };
    }

    // 4. Build TemplateFolder tree and detect template
    const templateData = buildTemplateFolderFromFiles(extractedFiles);
    const detectedTemplate = packageJsonContent
      ? detectTemplateFromPackageJson(packageJsonContent)
      : "REACT";

    // 5. Create Playground in database
    const playgroundTitle = customTitle?.trim() || repoInfo.name || repo;
    const playgroundDescription =
      repoInfo.description || `Imported from GitHub: ${owner}/${repo} (${targetBranch})`;

    const playground = await db.playground.create({
      data: {
        title: playgroundTitle,
        description: playgroundDescription,
        template: detectedTemplate,
        userId: user.id,
      },
    });

    // 6. Save TemplateFile content
    await db.templateFile.create({
      data: {
        playgroundId: playground.id,
        content: JSON.stringify(templateData),
      },
    });

    revalidatePath("/dashboard");

    return {
      success: true,
      playgroundId: playground.id,
    };
  } catch (error) {
    console.error("Error importing GitHub repository:", error);
    const message =
      error instanceof Error ? error.message : "Failed to import GitHub repository.";
    return {
      success: false,
      error: message,
    };
  }
}
