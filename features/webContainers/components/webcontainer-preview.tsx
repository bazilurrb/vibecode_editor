"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import type { TemplateFolder } from "@/features/playground/libs/path-to-json";
import { transformToWebContainerFormat } from "../hooks/transformer";
import { 
  CheckCircle, 
  Loader2, 
  XCircle, 
  RotateCw, 
  Play, 
  Square, 
  ExternalLink, 
  Terminal as TerminalIcon, 
  RefreshCw,
  Globe
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import TerminalComponent, { TerminalRef } from "./terminal";
import { WebContainer } from "@webcontainer/api";
import { cn } from "@/lib/utils";

interface WebContainerPreviewProps {
  templateData?: TemplateFolder | null;
  serverUrl?: string | null;
  isLoading?: boolean;
  error?: string | null;
  instance: WebContainer | null;
  writeFileSync?: (path: string, content: string) => Promise<void>;
  forceResetup?: boolean;
}

const WebContainerPreview: React.FC<WebContainerPreviewProps> = ({
  templateData,
  error,
  instance,
  isLoading,
  serverUrl: propServerUrl,
  writeFileSync,
  forceResetup = false,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string>(propServerUrl || "");
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 4;
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [isSetupInProgress, setIsSetupInProgress] = useState(false);
  const [isServerRunning, setIsServerRunning] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  
  const terminalRef = useRef<TerminalRef | null>(null);
  const devServerProcessRef = useRef<any>(null);
  const isSetupInProgressRef = useRef(false);
  const isSetupCompleteRef = useRef(false);

  // Sync propServerUrl if provided
  useEffect(() => {
    if (propServerUrl && !previewUrl) {
      setPreviewUrl(propServerUrl);
    }
  }, [propServerUrl, previewUrl]);

  // Listen for server-ready events from WebContainer
  useEffect(() => {
    if (!instance) return;

    const unsubscribe = instance.on("server-ready", (port: number, url: string) => {
      console.log(`[WebContainer] Server ready on port ${port} at ${url}`);
      terminalRef.current?.writeToTerminal(`\r\n🌐 Dev server ready at: ${url}\r\n`);
      setPreviewUrl(url);
      setCurrentStep(4);
      setIsServerRunning(true);
      setSetupError(null);
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [instance]);

  // Start development server
  const startDevServer = useCallback(async () => {
    if (!instance) return;

    try {
      // Inspect package.json for dev / start / serve script
      let commandArgs = ["run", "dev"];
      try {
        const pkgRaw = await instance.fs.readFile("package.json", "utf-8");
        const pkg = JSON.parse(pkgRaw);
        if (pkg.scripts) {
          if (pkg.scripts.dev) {
            commandArgs = ["run", "dev"];
          } else if (pkg.scripts.start) {
            commandArgs = ["run", "start"];
          } else if (pkg.scripts.serve) {
            commandArgs = ["run", "serve"];
          }
        }
      } catch (e) {
        console.warn("Could not read package.json scripts, using default 'run dev'", e);
      }

      terminalRef.current?.writeToTerminal(`\r\n🚀 Spawning development server (npm ${commandArgs.join(" ")})...\r\n`);

      const process = await instance.spawn("npm", commandArgs);
      devServerProcessRef.current = process;
      setIsServerRunning(true);

      process.output.pipeTo(
        new WritableStream({
          write(data) {
            terminalRef.current?.writeToTerminal(data);
          },
        })
      );

      process.exit.then((exitCode: number) => {
        setIsServerRunning(false);
        devServerProcessRef.current = null;
        if (exitCode !== 0) {
          terminalRef.current?.writeToTerminal(`\r\n❌ Dev server exited with code ${exitCode}\r\n`);
          setSetupError((prev) => prev || `Dev server exited with code ${exitCode}. See terminal logs below.`);
        } else {
          terminalRef.current?.writeToTerminal(`\r\n⏹ Dev server stopped.\r\n`);
        }
      });

    } catch (err) {
      console.error("Failed to start dev server:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setSetupError(`Failed to start server: ${msg}`);
      terminalRef.current?.writeToTerminal(`\r\n❌ Failed to start server: ${msg}\r\n`);
    }
  }, [instance]);

  // Stop development server
  const stopDevServer = useCallback(() => {
    if (devServerProcessRef.current) {
      terminalRef.current?.writeToTerminal("\r\n⏹ Stopping development server...\r\n");
      try {
        devServerProcessRef.current.kill();
      } catch (e) {
        // ignore
      }
      devServerProcessRef.current = null;
      setIsServerRunning(false);
    }
  }, []);

  // Restart development server
  const restartDevServer = useCallback(() => {
    stopDevServer();
    setTimeout(() => {
      startDevServer();
    }, 400);
  }, [stopDevServer, startDevServer]);

  // Main container setup pipeline
  const setupContainer = useCallback(async () => {
    if (!instance || !templateData || !templateData.items || templateData.items.length === 0) {
      return;
    }
    if (isSetupInProgressRef.current || isSetupCompleteRef.current) {
      return;
    }

    try {
      isSetupInProgressRef.current = true;
      setIsSetupInProgress(true);
      setSetupError(null);

      // Step 1: Transform template data
      setCurrentStep(1);
      terminalRef.current?.writeToTerminal("🔄 Transforming template files...\r\n");
      // @ts-ignore
      const files = transformToWebContainerFormat(templateData);

      // Step 2: Mount files into container
      setCurrentStep(2);
      terminalRef.current?.writeToTerminal("📁 Mounting files into WebContainer...\r\n");
      await instance.mount(files);
      terminalRef.current?.writeToTerminal("✅ Files mounted successfully.\r\n");

      // Step 3: Install dependencies
      setCurrentStep(3);
      let hasNodeModules = false;
      try {
        const entries = await instance.fs.readdir("node_modules");
        if (entries && entries.length > 0) {
          hasNodeModules = true;
        }
      } catch (e) {
        // node_modules doesn't exist yet
      }

      if (!hasNodeModules) {
        terminalRef.current?.writeToTerminal("📦 Installing dependencies (npm install)...\r\n");
        const installProcess = await instance.spawn("npm", ["install"]);
        
        installProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              terminalRef.current?.writeToTerminal(data);
            },
          })
        );

        const installExitCode = await installProcess.exit;
        if (installExitCode !== 0) {
          throw new Error(`Failed to install dependencies (exit code ${installExitCode})`);
        }
        terminalRef.current?.writeToTerminal("✅ Dependencies installed successfully.\r\n");
      } else {
        terminalRef.current?.writeToTerminal("⚡ Dependencies already present, skipping install.\r\n");
      }

      // Step 4: Start development server
      setCurrentStep(4);
      await startDevServer();

      isSetupCompleteRef.current = true;
      setIsSetupComplete(true);
      setIsSetupInProgress(false);
      isSetupInProgressRef.current = false;

    } catch (err) {
      console.error("Error setting up container:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      terminalRef.current?.writeToTerminal(`\r\n❌ Setup Error: ${errorMessage}\r\n`);
      setSetupError(errorMessage);
      setIsSetupInProgress(false);
      isSetupInProgressRef.current = false;
    }
  }, [instance, templateData, startDevServer]);

  // Handle forceResetup
  useEffect(() => {
    if (forceResetup) {
      isSetupCompleteRef.current = false;
      isSetupInProgressRef.current = false;
      setIsSetupComplete(false);
      setIsSetupInProgress(false);
      setPreviewUrl("");
      setCurrentStep(0);
      setSetupError(null);
      stopDevServer();
      setupContainer();
    }
  }, [forceResetup, stopDevServer, setupContainer]);

  // Run setup when instance and template data are ready
  useEffect(() => {
    if (instance && templateData && templateData.items && templateData.items.length > 0) {
      if (!isSetupComplete && !isSetupInProgress) {
        setupContainer();
      }
    }
  }, [instance, templateData, isSetupComplete, isSetupInProgress, setupContainer]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md p-6 rounded-lg bg-card border shadow-sm">
          <Loader2 className="h-9 w-9 animate-spin text-primary mx-auto" />
          <h3 className="text-base font-semibold text-foreground">Initializing WebContainer</h3>
          <p className="text-xs text-muted-foreground">
            Booting in-browser virtual runtime environment...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="bg-destructive/10 text-destructive border border-destructive/20 p-6 rounded-lg max-w-md">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-5 w-5 shrink-0" />
            <h3 className="font-semibold text-sm">Container Error</h3>
          </div>
          <p className="text-xs">{error}</p>
        </div>
      </div>
    );
  }

  const getStepIcon = (stepIndex: number) => {
    if (stepIndex < currentStep || (stepIndex === 4 && previewUrl)) {
      return <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />;
    } else if (stepIndex === currentStep) {
      return <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />;
    } else {
      return <div className="h-4 w-4 rounded-full border border-muted-foreground/30 shrink-0" />;
    }
  };

  const getStepText = (stepIndex: number, label: string) => {
    const isDone = stepIndex < currentStep || (stepIndex === 4 && previewUrl);
    const isActive = stepIndex === currentStep && !previewUrl;
    
    return (
      <span className={cn(
        "text-xs font-medium transition-colors",
        isDone ? "text-emerald-600 dark:text-emerald-400" :
        isActive ? "text-foreground font-semibold" :
        "text-muted-foreground"
      )}>
        {label}
      </span>
    );
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-background">
      {/* Top Half: Progress Card or Active Preview */}
      <div className={cn(
        "flex-1 min-h-0 flex flex-col relative",
        !isTerminalOpen && previewUrl ? "h-full" : ""
      )}>
        {!previewUrl ? (
          <div className="h-full flex flex-col items-center justify-center p-6 overflow-y-auto">
            <div className="w-full max-w-md p-6 rounded-xl bg-card border shadow-sm space-y-6">
              <div className="space-y-1.5 text-center">
                <h3 className="text-base font-semibold tracking-tight text-foreground">
                  Setting Up Web Environment
                </h3>
                <p className="text-xs text-muted-foreground">
                  Mounting files, configuring dependencies, and starting development server.
                </p>
              </div>

              <Progress
                value={(currentStep / totalSteps) * 100}
                className="h-1.5"
              />

              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-2.5">
                  {getStepIcon(1)}
                  {getStepText(1, "Transforming template data")}
                </div>
                <div className="flex items-center gap-2.5">
                  {getStepIcon(2)}
                  {getStepText(2, "Mounting project files")}
                </div>
                <div className="flex items-center gap-2.5">
                  {getStepIcon(3)}
                  {getStepText(3, "Installing packages (npm install)")}
                </div>
                <div className="flex items-center gap-2.5">
                  {getStepIcon(4)}
                  {getStepText(4, "Starting development server")}
                </div>
              </div>

              {setupError && (
                <div className="p-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-md text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-medium">
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Setup Encountered an Issue</span>
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-90">{setupError}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSetupError(null);
                      isSetupCompleteRef.current = false;
                      isSetupInProgressRef.current = false;
                      setIsSetupComplete(false);
                      setIsSetupInProgress(false);
                      setupContainer();
                    }}
                    className="h-7 text-xs w-full mt-2"
                  >
                    <RotateCw className="w-3 h-3 mr-1.5" /> Retry Setup
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* Preview Toolbar */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30 shrink-0 gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-background border text-xs max-w-sm w-full font-mono text-muted-foreground truncate">
                  <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate">{previewUrl}</span>
                </div>

                <div className="flex items-center gap-1.5 ml-1 shrink-0">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    isServerRunning ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                  )} />
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {isServerRunning ? "Running" : "Stopped"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIframeKey((k) => k + 1)}
                  className="h-7 px-2 text-xs"
                  title="Reload Preview"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>

                {isServerRunning ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={stopDevServer}
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                    title="Stop Server"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={startDevServer}
                    className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700"
                    title="Start Server"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={restartDevServer}
                  className="h-7 px-2 text-xs"
                  title="Restart Server"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(previewUrl, "_blank")}
                  className="h-7 px-2 text-xs"
                  title="Open in New Tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>

                <Button
                  size="sm"
                  variant={isTerminalOpen ? "secondary" : "ghost"}
                  onClick={() => setIsTerminalOpen(!isTerminalOpen)}
                  className="h-7 px-2 text-xs ml-1"
                  title={isTerminalOpen ? "Hide Terminal" : "Show Terminal"}
                >
                  <TerminalIcon className="w-3.5 h-3.5 mr-1" />
                  <span className="text-[11px]">Terminal</span>
                </Button>
              </div>
            </div>

            {/* Iframe Preview */}
            <div className="flex-1 relative bg-white min-h-0">
              <iframe
                key={iframeKey}
                src={previewUrl}
                allow="cross-origin-isolated; autoplay; camera; microphone; geolocation"
                className="w-full h-full border-none"
                title="WebContainer Preview"
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Half: Persistent Terminal (Never unmounts, preserving all logs!) */}
      <div className={cn(
        "border-t shrink-0 flex flex-col transition-all duration-200",
        !previewUrl ? "flex-1 min-h-[200px]" : isTerminalOpen ? "h-60" : "h-0 hidden"
      )}>
        <TerminalComponent 
          ref={terminalRef}
          webContainerInstance={instance}
          theme="dark"
          className="h-full rounded-none border-0"
        />
      </div>
    </div>
  );
};

export default WebContainerPreview;