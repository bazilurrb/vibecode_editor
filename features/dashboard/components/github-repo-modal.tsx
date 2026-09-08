"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { signIn } from "next-auth/react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Search,
  Star,
  Lock,
  Globe,
  ExternalLink,
  GitBranch,
  Loader2,
  RefreshCw,
  FolderGit2,
  ArrowRight,
  AlertCircle,
  X,
} from "lucide-react";
import {
  getUserGithubRepos,
  importGithubRepo,
} from "@/features/dashboard/actions/github";
import type { GithubRepoItem } from "@/features/dashboard/types";

interface GithubRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "bg-blue-500",
  JavaScript: "bg-yellow-400",
  Python: "bg-emerald-500",
  HTML: "bg-orange-500",
  CSS: "bg-indigo-500",
  Rust: "bg-amber-600",
  Go: "bg-cyan-500",
  Java: "bg-red-500",
  Vue: "bg-emerald-400",
  C: "bg-slate-400",
  "C++": "bg-pink-500",
};

export const GithubRepoModal: React.FC<GithubRepoModalProps> = ({
  isOpen,
  onClose,
}) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"my-repos" | "url">("my-repos");

  // User repos state
  const [repos, setRepos] = useState<GithubRepoItem[]>([]);
  const [hasGithubConnected, setHasGithubConnected] = useState<boolean | null>(null);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Manual URL import state
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [customTitle, setCustomTitle] = useState("");

  // Importing state
  const [isImporting, setIsImporting] = useState(false);
  const [importingRepoName, setImportingRepoName] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string>("");

  const fetchRepos = async () => {
    setIsLoadingRepos(true);
    setFetchError(null);
    try {
      const res = await getUserGithubRepos();
      setHasGithubConnected(res.hasGithubConnected);
      if (res.error) {
        setFetchError(res.error);
      }
      setRepos(res.repos || []);
      // If user doesn't have GitHub connected, default to URL tab
      if (!res.hasGithubConnected) {
        setActiveTab("url");
      }
    } catch (err) {
      console.error("Failed to load user GitHub repos:", err);
      setFetchError("Unable to load repositories. Please check your connection.");
    } finally {
      setIsLoadingRepos(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRepos();
    } else {
      // Reset state on modal close
      setSearchQuery("");
      setRepoUrl("");
      setBranch("");
      setCustomTitle("");
      setIsImporting(false);
      setImportingRepoName(null);
    }
  }, [isOpen]);

  // Filtered repositories based on search
  const filteredRepos = repos.filter((r) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      r.name.toLowerCase().includes(query) ||
      (r.description && r.description.toLowerCase().includes(query)) ||
      (r.language && r.language.toLowerCase().includes(query))
    );
  });

  // Handle importing a repo directly from the list
  const handleImportFromList = async (repo: GithubRepoItem) => {
    setIsImporting(true);
    setImportingRepoName(repo.fullName);
    setImportStatus(`Cloning ${repo.fullName}...`);

    try {
      const res = await importGithubRepo({
        owner: repo.owner.login,
        repo: repo.name,
        branch: repo.defaultBranch,
      });

      if (!res.success || !res.playgroundId) {
        toast.error(res.error || "Failed to import repository");
        setIsImporting(false);
        setImportingRepoName(null);
        return;
      }

      toast.success(`Repository '${repo.name}' imported successfully!`);
      onClose();
      router.push(`/playground/${res.playgroundId}`);
    } catch (err) {
      console.error("Import error:", err);
      toast.error("An unexpected error occurred while importing repository");
      setIsImporting(false);
      setImportingRepoName(null);
    }
  };

  // Handle importing by manual URL / owner/repo
  const handleImportFromUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim() || isImporting) return;

    // Parse URL or owner/repo format
    // Matches: https://github.com/owner/repo or github.com/owner/repo or owner/repo
    const cleanInput = repoUrl.trim().replace(/\/$/, "");
    const match = cleanInput.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+)/) ||
      cleanInput.match(/^([^/]+)\/([^/]+)$/);

    if (!match) {
      toast.error("Invalid repository format. Please enter 'owner/repo' or a full GitHub URL.");
      return;
    }

    const owner = match[1];
    // Strip trailing .git if present
    const repo = match[2].replace(/\.git$/, "");

    setIsImporting(true);
    setImportingRepoName(`${owner}/${repo}`);
    setImportStatus(`Fetching ${owner}/${repo}...`);

    try {
      const res = await importGithubRepo({
        owner,
        repo,
        branch: branch.trim() || undefined,
        customTitle: customTitle.trim() || undefined,
      });

      if (!res.success || !res.playgroundId) {
        toast.error(res.error || "Failed to import repository");
        setIsImporting(false);
        setImportingRepoName(null);
        return;
      }

      toast.success(`Repository '${repo}' imported successfully!`);
      onClose();
      router.push(`/playground/${res.playgroundId}`);
    } catch (err) {
      console.error("Import error:", err);
      toast.error("An unexpected error occurred while importing repository");
      setIsImporting(false);
      setImportingRepoName(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isImporting && !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-zinc-800 bg-zinc-950 text-zinc-100">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-zinc-800/80 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-white">
              <FolderGit2 className="h-6 w-6 text-[#E93F3F]" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                Open GitHub Repository
              </DialogTitle>
              <DialogDescription className="text-sm text-zinc-400 mt-0.5">
                Import any repository into VibeCoder and start developing in WebContainer
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Loading / Importing Overlay */}
        {isImporting ? (
          <div className="flex flex-col items-center justify-center p-12 py-20 text-center space-y-4">
            <div className="relative flex items-center justify-center">
              <div className="h-16 w-16 rounded-full border-4 border-zinc-800 border-t-[#E93F3F] animate-spin" />
              <FolderGit2 className="h-7 w-7 text-zinc-400 absolute" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-zinc-100">
                {importStatus || "Importing repository..."}
              </h3>
              <p className="text-sm text-zinc-400 max-w-sm mx-auto">
                Downloading files, setting up directory tree, and initializing your playground.
              </p>
            </div>
          </div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as any)}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="px-6 pt-4 border-b border-zinc-800/80 flex items-center justify-between">
              <TabsList className="bg-zinc-900 border border-zinc-800">
                <TabsTrigger
                  value="my-repos"
                  className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
                >
                  My Repositories
                  {repos.length > 0 && (
                    <span className="ml-2 text-xs bg-zinc-700/60 px-1.5 py-0.5 rounded-full text-zinc-300">
                      {repos.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="url"
                  className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
                >
                  Import via URL
                </TabsTrigger>
              </TabsList>

              {activeTab === "my-repos" && hasGithubConnected && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchRepos}
                  disabled={isLoadingRepos}
                  className="text-xs text-zinc-400 hover:text-zinc-200 h-8 px-2"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 mr-1 ${isLoadingRepos ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
              )}
            </div>

            {/* Tab 1: My Repositories */}
            <TabsContent
              value="my-repos"
              className="flex-1 flex flex-col overflow-hidden p-6 pt-4 m-0 space-y-4"
            >
              {/* Not connected banner */}
              {hasGithubConnected === false && (
                <div className="flex flex-col items-center justify-center p-8 border border-zinc-800 rounded-xl bg-zinc-900/40 text-center space-y-4 my-auto">
                  <div className="p-3 bg-zinc-800/80 rounded-full text-white border border-zinc-700/50">
                    <Image src="/github.svg" alt="GitHub" width={40} height={40} style={{ width: "auto", height: "auto" }} />
                  </div>
                  <div className="max-w-md space-y-1">
                    <h3 className="text-base font-semibold text-zinc-200">
                      Connect your GitHub Account
                    </h3>
                    <p className="text-sm text-zinc-400">
                      Link your GitHub account to browse and import your personal and organization repositories directly.
                    </p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={() => signIn("github")}
                      className="bg-[#E93F3F] hover:bg-[#d03636] text-white"
                    >
                      Connect GitHub
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab("url")}
                      className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                    >
                      Import by URL instead
                    </Button>
                  </div>
                </div>
              )}

              {/* Connected & Loading */}
              {isLoadingRepos && (
                <div className="flex-1 flex flex-col items-center justify-center py-16 space-y-3">
                  <Loader2 className="h-8 w-8 text-[#E93F3F] animate-spin" />
                  <p className="text-sm text-zinc-400">Fetching your GitHub repositories...</p>
                </div>
              )}

              {/* Connected & Repos available */}
              {!isLoadingRepos && hasGithubConnected && (
                <>
                  {/* Search input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                      placeholder="Search your repositories by name, description, or language..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-8 bg-zinc-900/60 border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:border-[#E93F3F] focus:ring-[#E93F3F]/20"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {fetchError && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{fetchError}</span>
                    </div>
                  )}

                  {/* Repos list */}
                  <div className="flex-1 overflow-y-auto space-y-2 max-h-[380px] pr-1">
                    {filteredRepos.length === 0 ? (
                      <div className="text-center py-12 text-zinc-500">
                        <FolderGit2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-medium">No repositories found</p>
                        <p className="text-xs text-zinc-600 mt-1">
                          {searchQuery
                            ? "Try adjusting your search query"
                            : "Your GitHub account doesn't have any repositories yet"}
                        </p>
                      </div>
                    ) : (
                      filteredRepos.map((repo) => (
                        <div
                          key={repo.id}
                          className="group flex items-center justify-between p-3.5 rounded-lg border border-zinc-800/80 bg-zinc-900/30 hover:bg-zinc-900 hover:border-zinc-700/80 transition-all duration-200"
                        >
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-semibold text-zinc-200 truncate group-hover:text-[#E93F3F] transition-colors">
                                {repo.name}
                              </h4>
                              {repo.isPrivate ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] h-4.5 px-1.5 border-zinc-700 text-zinc-400 gap-1 font-normal"
                                >
                                  <Lock className="h-2.5 w-2.5" /> Private
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] h-4.5 px-1.5 border-zinc-700 text-zinc-400 gap-1 font-normal"
                                >
                                  <Globe className="h-2.5 w-2.5" /> Public
                                </Badge>
                              )}
                              <a
                                href={repo.htmlUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-zinc-500 hover:text-zinc-300"
                                title="View on GitHub"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>

                            {repo.description && (
                              <p className="text-xs text-zinc-400 line-clamp-1 mb-2">
                                {repo.description}
                              </p>
                            )}

                            <div className="flex items-center gap-4 text-xs text-zinc-500">
                              {repo.language && (
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`h-2 w-2 rounded-full ${
                                      LANGUAGE_COLORS[repo.language] || "bg-zinc-500"
                                    }`}
                                  />
                                  <span>{repo.language}</span>
                                </div>
                              )}
                              {repo.stargazersCount > 0 && (
                                <div className="flex items-center gap-1">
                                  <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                                  <span>{repo.stargazersCount}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <GitBranch className="h-3 w-3" />
                                <span>{repo.defaultBranch}</span>
                              </div>
                              {repo.updatedAt && (
                                <span>
                                  Updated{" "}
                                  {formatDistanceToNow(new Date(repo.updatedAt), {
                                    addSuffix: true,
                                  })}
                                </span>
                              )}
                            </div>
                          </div>

                          <Button
                            size="sm"
                            onClick={() => handleImportFromList(repo)}
                            disabled={isImporting}
                            className="bg-[#E93F3F] hover:bg-[#d03636] text-white shrink-0 text-xs h-8 px-3 transition-colors"
                          >
                            Import
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </TabsContent>

            {/* Tab 2: Import via URL */}
            <TabsContent value="url" className="p-6 space-y-4 m-0">
              <form onSubmit={handleImportFromUrl} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="repo-url" className="text-sm font-medium text-zinc-200">
                    Repository URL or Path <span className="text-[#E93F3F]">*</span>
                  </Label>
                  <Input
                    id="repo-url"
                    placeholder="e.g. https://github.com/facebook/react or owner/repo"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    required
                    disabled={isImporting}
                    className="bg-zinc-900/60 border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:border-[#E93F3F] focus:ring-[#E93F3F]/20"
                  />
                  <p className="text-xs text-zinc-500">
                    Enter any public repository, or a private repository if your GitHub account is linked.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="branch" className="text-sm font-medium text-zinc-200">
                      Branch (Optional)
                    </Label>
                    <Input
                      id="branch"
                      placeholder="e.g. main, master, or dev"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      disabled={isImporting}
                      className="bg-zinc-900/60 border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:border-[#E93F3F]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="custom-title" className="text-sm font-medium text-zinc-200">
                      Project Name (Optional)
                    </Label>
                    <Input
                      id="custom-title"
                      placeholder="Defaults to repository name"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      disabled={isImporting}
                      className="bg-zinc-900/60 border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:border-[#E93F3F]"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={isImporting}
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!repoUrl.trim() || isImporting}
                    className="bg-[#E93F3F] hover:bg-[#d03636] text-white"
                  >
                    Import Repository
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
