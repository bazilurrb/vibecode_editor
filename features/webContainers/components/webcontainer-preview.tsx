"use client"
import React, { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import type { TemplateFolder } from "@/features/playground/types";
import { transformToWebContainerFormat } from "../hooks/transformer";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { WebContainer } from "@webcontainer/api";

// 1. DYNAMIC IMPORT: Prevents SSR "self is not defined" error from xterm.js
const TerminalComponent = dynamic(() => import("./terminal"), {
    ssr: false,
    loading: () => <div className="h-full bg-zinc-900 text-zinc-400 p-4 text-xs font-mono">Loading Terminal...</div>,
});

interface WebContainerPreviewProps {
    templateData: TemplateFolder;
    serverUrl: string;
    isLoading: boolean;
    error: string | null;
    instance: WebContainer | null;
    writeFileSync: (path: string, content: string) => Promise<void>;
    forceResetup?: boolean;
}

const WebContainerPreview = ({
    templateData,
    error,
    instance,
    isLoading,
    serverUrl,
    writeFileSync,
    forceResetup = false,
}: WebContainerPreviewProps) => {

    const [previewUrl, setPreviewUrl] = useState<string>("");
    const [loadingState, setLoadingState] = useState({
        transforming: false,
        mounting: false,
        installing: false,
        starting: false,
        ready: false,
    });
    const [currentStep, setCurrentStep] = useState(0);
    const totalSteps = 4;
    const [setupError, setSetupError] = useState<string | null>(null);
    const [isSetupComplete, setIsSetupComplete] = useState(false);
    const [isSetupInProgress, setIsSetupInProgress] = useState(false);

    const terminalRef = useRef<any>(null);

    // Helper to safely write to terminal even if it mounts asynchronously
    const writeLog = (message: string) => {
        if (terminalRef.current?.writeToTerminal) {
            terminalRef.current.writeToTerminal(message);
        } else {
            console.log(message.trim());
        }
    };

    // Reset setup state when forceResetup changes
    useEffect(() => {
        if (forceResetup) {
            setIsSetupComplete(false);
            setIsSetupInProgress(false);
            setPreviewUrl("");
            setCurrentStep(0);
            setLoadingState({
                transforming: false,
                mounting: false,
                installing: false,
                starting: false,
                ready: false,
            });
        }
    }, [forceResetup]);

    useEffect(() => {
        async function setupContainer() {
            if (!instance || isSetupComplete || isSetupInProgress) return;

            try {
                setIsSetupInProgress(true);
                setSetupError(null);

                // Register server-ready listener early
                instance.on("server-ready", (port: number, url: string) => {
                    console.log(`Server ready on port ${port} at ${url}`);
                    writeLog(`\r\n🌐 Server ready at ${url}\r\n`);
                    setPreviewUrl(url);
                    setLoadingState((prev) => ({
                        ...prev,
                        starting: false,
                        ready: true,
                    }));
                    setIsSetupComplete(true);
                    setIsSetupInProgress(false);
                });

                // Check if files are already mounted in existing container session
                try {
                    const packageJsonExists = await instance.fs.readFile('package.json', 'utf8');
                    if (packageJsonExists) {
                        writeLog("🔄 Reconnecting to existing WebContainer session...\r\n");
                        setCurrentStep(4);
                        setLoadingState((prev) => ({ ...prev, starting: true }));

                        // Restart dev server if needed on reconnect
                        await instance.spawn("npm", ["run", "dev"]);
                        return;
                    }
                } catch (e) {
                    // Files not mounted yet, proceed with setup
                }

                // Step 1: Transform data
                setLoadingState((prev) => ({ ...prev, transforming: true }));
                setCurrentStep(1);
                writeLog("🔄 Transforming template data...\r\n");

                // @ts-ignore
                const files = transformToWebContainerFormat(templateData);

                // Step 2: Mount files
                setLoadingState((prev) => ({
                    ...prev,
                    transforming: false,
                    mounting: true,
                }));
                setCurrentStep(2);
                writeLog("📁 Mounting files to WebContainer...\r\n");

                await instance.mount(files);
                writeLog("✅ Files mounted successfully\r\n");

                // Step 3: Install dependencies
                setLoadingState((prev) => ({
                    ...prev,
                    mounting: false,
                    installing: true,
                }));
                setCurrentStep(3);
                writeLog("📦 Installing dependencies (npm install)...\r\n");

                const installProcess = await instance.spawn("npm", ["install"]);

                installProcess.output.pipeTo(
                    new WritableStream({
                        write(data) {
                            writeLog(data);
                        },
                    })
                );

                const installExitCode = await installProcess.exit;

                if (installExitCode !== 0) {
                    throw new Error(`Failed to install dependencies. Exit code: ${installExitCode}`);
                }

                writeLog("\r\n✅ Dependencies installed successfully\r\n");

                // Step 4: Start development server
                setLoadingState((prev) => ({
                    ...prev,
                    installing: false,
                    starting: true,
                }));
                setCurrentStep(4);
                writeLog("🚀 Starting development server (npm run dev)...\r\n");

                // Use "dev" instead of "start" for WebContainer projects
                const startProcess = await instance.spawn("npm", ["run", "dev"]);

                startProcess.output.pipeTo(
                    new WritableStream({
                        write(data) {
                            writeLog(data);
                        },
                    })
                );

            } catch (err) {
                console.error("Error setting up container:", err);
                const errorMessage = err instanceof Error ? err.message : String(err);

                if (terminalRef.current?.writeToTerminal) {
                    terminalRef.current.writeToTerminal(`❌ Error: ${errorMessage}\r\n`);
                }

                writeLog(`\r\n❌ Error: ${errorMessage}\r\n`);

                setSetupError(errorMessage);
                setIsSetupInProgress(false);
                setLoadingState({
                    transforming: false,
                    mounting: false,
                    installing: false,
                    starting: false,
                    ready: false,
                });
            }
        }

        setupContainer();
    }, [instance, templateData, isSetupComplete, isSetupInProgress]);

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-4 max-w-md p-6 rounded-lg bg-gray-50 dark:bg-gray-900">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                    <h3 className="text-lg font-medium">Initializing WebContainer</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Setting up the environment for your project...
                    </p>
                </div>
            </div>
        );
    }

    if (error || setupError) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-6 rounded-lg max-w-md">
                    <div className="flex items-center gap-2 mb-3">
                        <XCircle className="h-5 w-5" />
                        <h3 className="font-semibold">Error</h3>
                    </div>
                    <p className="text-sm">{error || setupError}</p>
                </div>
            </div>
        );
    }

    const getStepIcon = (stepIndex: number) => {
        if (stepIndex < currentStep) {
            return <CheckCircle className="h-5 w-5 text-green-500" />;
        } else if (stepIndex === currentStep) {
            return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
        } else {
            return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
        }
    };

    const getStepText = (stepIndex: number, label: string) => {
        const isActive = stepIndex === currentStep;
        const isComplete = stepIndex < currentStep;

        return (
            <span className={`text-sm font-medium ${isComplete ? 'text-green-600' :
                isActive ? 'text-blue-600' : 'text-gray-500'
                }`}>
                {label}
            </span>
        );
    };

    return (
        <div className="h-full w-full flex flex-col">
            <div className="flex-1 flex flex-col min-h-0">
                {!previewUrl ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6">
                        <div className="w-full max-w-md p-6 rounded-lg bg-white dark:bg-zinc-800 shadow-sm">
                            <Progress
                                value={(currentStep / totalSteps) * 100}
                                className="h-2 mb-6"
                            />
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    {getStepIcon(1)}
                                    {getStepText(1, "Transforming template data")}
                                </div>
                                <div className="flex items-center gap-3">
                                    {getStepIcon(2)}
                                    {getStepText(2, "Mounting files")}
                                </div>
                                <div className="flex items-center gap-3">
                                    {getStepIcon(3)}
                                    {getStepText(3, "Installing dependencies")}
                                </div>
                                <div className="flex items-center gap-3">
                                    {getStepIcon(4)}
                                    {getStepText(4, "Starting development server")}
                                </div>
                            </div>
                        </div>

                        <div>
                            <TerminalComponent
                                ref={terminalRef}
                                webContainerInstance={instance}
                                theme="dark"
                                className="h-full"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex-1">
                        <iframe
                            src={previewUrl}
                            className="w-full h-full border-none"
                            title="WebContainer Preview"
                        />
                    </div>
                )}
            </div>

            {/* Always render Terminal component so terminalRef is available during npm install */}
            <div className="h-64 border-t bg-black">
                <TerminalComponent
                    ref={terminalRef}
                    webContainerInstance={instance}
                    theme="dark"
                    className="h-full"
                />
            </div>
        </div>
    );
};

export default WebContainerPreview;

// Changes Made

// // 1. Replaced static import with next/dynamic and ssr: false to fix "self is not defined" error from xterm
// const TerminalComponent = dynamic(() => import("./terminal"), { ssr: false });

// // 2. Added a safe logger helper to log messages to console if terminalRef isn't mounted yet
// const writeLog = (message: string) => { ... };

// // 3. Moved "server-ready" listener to register BEFORE spawns so it never misses the server boot event
// instance.on("server-ready", ...);

// // 4. Changed command from "npm run start" to "npm run dev" for WebContainer compatibility
// const startProcess = await instance.spawn("npm", ["run", "dev"]);

// // 5. Moved TerminalComponent outside the conditional ternary so terminalRef remains mounted and visible during "npm install"
// <TerminalComponent ref={terminalRef} ... />