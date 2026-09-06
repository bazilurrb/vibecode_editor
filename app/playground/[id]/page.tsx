"use client"
import { SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { useParams } from "next/navigation"
import { toast } from "sonner"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { useFileExplorer } from "@/features/playground/hooks/useFileExplorer";
import { Separator } from "@/components/ui/separator";
import { usePlayground } from "@/features/playground/hooks/usePlayground";
import TemplateFileTree from "@/features/playground/components/template-file-tree";
import { Button } from "@/components/ui/button";
import WebContainerPreview from "@/features/webContainers/components/webcontainer-preview";
import ToggleAI from "@/features/playground/components/toggle-ai";

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    TooltipProvider
} from "@/components/ui/tooltip";

import { Save, Bot, Settings, FileText, X, AlertCircle, FolderOpen } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TemplateFile, TemplateFolder } from "@/features/playground/types";
import type { TemplateFile as JsonTemplateFile } from "@/features/playground/libs/path-to-json";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { PlaygroundEditor } from "@/features/playground/components/playground-editor";
import { useWebContainer } from "@/features/webContainers/hooks/useWebContainer";
import LoadingStep from "@/components/ui/loader";
import { findFilePath } from "@/features/playground/libs";
import { useAISuggestions } from "@/features/ai/hooks/useAISuggestion";


const Page = () => {
    const { id } = useParams<{ id: string }>();
    const [isPreviewVisible, setIsPreviewVisible] = useState(true);
    const { playgroundData, templateData, isLoading, error, loadPlayground, saveTemplateData } = usePlayground(id);

    const aiSuggestion = useAISuggestions();

    const {
        activeFileId,
        closeAllFiles,
        openFile,
        closeFile,
        editorContent,
        updateFileContent,
        handleAddFile,
        handleAddFolder,
        handleDeleteFile,
        handleDeleteFolder,
        handleRenameFile,
        handleRenameFolder,
        openFiles,
        setTemplateData,
        setActiveFileId,
        setPlaygroundId,
        setOpenFiles,
    } = useFileExplorer();

    const {
        serverUrl,
        isLoading: containerLoading,
        error: containerError,
        instance,
        writeFileSync,
        // @ts-ignore
    } = useWebContainer({ templateData });

    const lastSyncedContent = useRef<Map<string, string>>(new Map());

    useEffect(() => {
        setPlaygroundId(id);
    }, [id, setPlaygroundId])

    useEffect(() => {
        if (templateData && !openFiles.length) {
            setTemplateData(templateData);
        }
    }, [templateData, setTemplateData, openFiles.length])


    // Create wrapper functions that pass saveTemplateData
    const wrappedHandleAddFile = useCallback(
        (newFile: TemplateFile, parentPath: string) => {
            return handleAddFile(
                newFile,
                parentPath,
                writeFileSync!,
                instance,
                saveTemplateData
            );
        },
        [handleAddFile, writeFileSync, instance, saveTemplateData]
    );

    const wrappedHandleAddFolder = useCallback(
        (newFolder: TemplateFolder, parentPath: string) => {
            return handleAddFolder(newFolder, parentPath, instance, saveTemplateData);
        },
        [handleAddFolder, instance, saveTemplateData]
    );

    const wrappedHandleDeleteFile = useCallback(
        (file: TemplateFile, parentPath: string) => {
            return handleDeleteFile(file, parentPath, saveTemplateData);
        },
        [handleDeleteFile, saveTemplateData]
    );

    const wrappedHandleDeleteFolder = useCallback(
        (folder: TemplateFolder, parentPath: string) => {
            return handleDeleteFolder(folder, parentPath, saveTemplateData);
        },
        [handleDeleteFolder, saveTemplateData]
    );

    const wrappedHandleRenameFile = useCallback(
        (
            file: TemplateFile,
            newFilename: string,
            newExtension: string,
            parentPath: string
        ) => {
            return handleRenameFile(
                file,
                newFilename,
                newExtension,
                parentPath,
                saveTemplateData
            );
        },
        [handleRenameFile, saveTemplateData]
    );

    const wrappedHandleRenameFolder = useCallback(
        (folder: TemplateFolder, newFolderName: string, parentPath: string) => {
            return handleRenameFolder(
                folder,
                newFolderName,
                parentPath,
                saveTemplateData
            );
        },
        [handleRenameFolder, saveTemplateData]
    );

    const activeFile = openFiles.find((f) => f.id === activeFileId);
    const hasUnsavedChanges = openFiles.some((f) => f.hasUnsavedChanges);
    // f = file

    useEffect(() => {
        if (openFiles.length === 0) return;
        // #region agent log
        fetch('http://127.0.0.1:7302/ingest/649621eb-5f46-45f2-97c4-4c29651dd686', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '0c5b92' }, body: JSON.stringify({ sessionId: '0c5b92', location: 'page.tsx:render-state', message: 'editor render state', data: { activeFileId, editorContentLength: editorContent.length, editorContentPreview: editorContent.slice(0, 80), openFilesCount: openFiles.length, activeFileName: activeFile ? `${activeFile.filename}.${activeFile.fileExtension}` : null, hasEditorUI: false }, timestamp: Date.now(), hypothesisId: 'A,C' }) }).catch(() => { });
        // #endregion
    }, [openFiles.length, activeFileId, editorContent, activeFile]);

    const handleTabChange = (fileId: string) => {
        setActiveFileId(fileId);
        const file = openFiles.find((f) => f.id === fileId);
        // #region agent log
        fetch('http://127.0.0.1:7302/ingest/649621eb-5f46-45f2-97c4-4c29651dd686', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '0c5b92' }, body: JSON.stringify({ sessionId: '0c5b92', location: 'page.tsx:handleTabChange', message: 'tab changed', data: { fileId, fileFound: !!file, fileContentLength: file?.content?.length ?? 0, editorContentLength: editorContent.length }, timestamp: Date.now(), hypothesisId: 'C' }) }).catch(() => { });
        // #endregion
    }

    const handleFileSelect = (file: TemplateFile) => {
        // #region agent log
        fetch('http://127.0.0.1:7302/ingest/649621eb-5f46-45f2-97c4-4c29651dd686', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '0c5b92' }, body: JSON.stringify({ sessionId: '0c5b92', location: 'page.tsx:handleFileSelect', message: 'file selected from tree', data: { filename: file.filename, extension: file.fileExtension, contentLength: (file.content || '').length }, timestamp: Date.now(), hypothesisId: 'B' }) }).catch(() => { });
        // #endregion
        openFile(file);
    }

    const handleSave = useCallback(
        async (fileId?: string) => {
            const targetFileId = fileId || activeFileId;
            if (!targetFileId) return;

            const fileToSave = openFiles.find((f) => f.id === targetFileId);
            if (!fileToSave) return;

            const latestTemplateData = useFileExplorer.getState().templateData;
            if (!latestTemplateData) return;

            try {
                const filePath = findFilePath(fileToSave, latestTemplateData);
                if (!filePath) {
                    toast.error(
                        `Could not find path for file: ${fileToSave.filename}.${fileToSave.fileExtension}`
                    );
                    return;
                }
                // Update file content in template data (clone for immutability)
                const updatedTemplateData = JSON.parse(
                    JSON.stringify(latestTemplateData)
                );
                const updateFileContent = (
                    items: (TemplateFile | TemplateFolder)[]
                ): (TemplateFile | TemplateFolder)[] => {
                    return items.map((item) => {
                        if ("folderName" in item && Array.isArray((item as TemplateFolder).items)) {
                            return {
                                ...item,
                                items: updateFileContent((item as TemplateFolder).items),
                            };
                        } else if (
                            "filename" in item &&
                            item.filename === fileToSave.filename &&
                            item.fileExtension === fileToSave.fileExtension
                        ) {
                            return { ...item, content: fileToSave.content };
                        }
                        return item;
                    });
                };
                updatedTemplateData.items = updateFileContent(
                    updatedTemplateData.items
                );

                // Sync with WebContainer
                if (writeFileSync) {
                    await writeFileSync(filePath, fileToSave.content);
                    lastSyncedContent.current.set(fileToSave.id, fileToSave.content);
                    if (instance && instance.fs) {
                        await instance.fs.writeFile(filePath, fileToSave.content);
                    }
                }

                // Await the save operation
                await saveTemplateData(updatedTemplateData);

                // Set state using the updated local data
                setTemplateData(updatedTemplateData);

                // Update open files
                const updatedOpenFiles = openFiles.map((f) =>
                    f.id === targetFileId
                        ? {
                            ...f,
                            content: fileToSave.content,
                            originalContent: fileToSave.content,
                            hasUnsavedChanges: false,
                        }
                        : f
                );
                setOpenFiles(updatedOpenFiles);

                toast.success(
                    `Saved ${fileToSave.filename}.${fileToSave.fileExtension}`
                );
            } catch (error) {
                console.error("Error saving file:", error);
                toast.error(
                    `Failed to save ${fileToSave.filename}.${fileToSave.fileExtension}`
                );
                throw error;
            }
        },
        [
            activeFileId,
            openFiles,
            writeFileSync,
            instance,
            saveTemplateData,
            setTemplateData,
            setOpenFiles,
        ]
    );

    const handleSaveAll = async () => {
        const unsavedFiles = openFiles.filter((f) => f.hasUnsavedChanges);

        if (unsavedFiles.length === 0) {
            toast.info("No unsaved changes");
            return;
        }

        try {
            await Promise.all(unsavedFiles.map((f) => handleSave(f.id)));
            toast.success(`Saved ${unsavedFiles.length} file(s)`);
        } catch (error) {
            toast.error("Failed to save some files");
        }
    };

    // Add event to save file by click ctrl + s
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === "s") {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleSave]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-4">
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <h2 className="text-xl font-semibold text-red-600 mb-2">
                    Something went wrong
                </h2>
                <p className="text-gray-600 mb-4">{error}</p>
                <Button onClick={() => window.location.reload()} variant="destructive">
                    Try Again
                </Button>
            </div>
        );
    }

    // Loading state
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-4">
                <div className="w-full max-w-md p-6 rounded-lg shadow-sm border">
                    <h2 className="text-xl font-semibold mb-6 text-center">
                        Loading Playground
                    </h2>
                    <div className="mb-8">
                        <LoadingStep
                            currentStep={1}
                            step={1}
                            label="Loading playground data"
                        />
                        <LoadingStep
                            currentStep={2}
                            step={2}
                            label="Setting up environment"
                        />
                        <LoadingStep currentStep={3} step={3} label="Ready to code" />
                    </div>
                </div>
            </div>
        );
    }
    // No template data
    if (!templateData) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-4">
                <FolderOpen className="h-12 w-12 text-amber-500 mb-4" />
                <h2 className="text-xl font-semibold text-amber-600 mb-2">
                    No template data available
                </h2>
                <Button onClick={() => window.location.reload()} variant="outline">
                    Reload Template
                </Button>
            </div>
        );
    }

    return (
        <TooltipProvider>
            <>

                <TemplateFileTree
                    data={templateData!}
                    onFileSelect={handleFileSelect}
                    selectedFile={activeFile}
                    title="File Explorer"
                    onAddFile={wrappedHandleAddFile}
                    onAddFolder={wrappedHandleAddFolder}
                    onDeleteFile={wrappedHandleDeleteFile}
                    onDeleteFolder={wrappedHandleDeleteFolder}
                    onRenameFile={wrappedHandleRenameFile}
                    onRenameFolder={wrappedHandleRenameFolder}
                />

                {/* TODO: TEMPLATE TREE */}
                <SidebarInset>
                    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
                        <SidebarTrigger className='-ml-1' />
                        <Separator orientation='vertical' className='mr-2 h-4' />

                        <div className="flex flex-1 items-center gap-2">
                            <div className="flex flex-col flex-1">
                                <h1>
                                    {playgroundData?.title || "Code Playground"}
                                </h1>

                                <p className="text-xs text-muted-foreground">
                                    {openFiles.length} Files(s) open
                                    {hasUnsavedChanges && " - Unsaved changes"}
                                </p>
                            </div>

                            <div className="flex items-center gap-1">
                                <Tooltip>
                                    <TooltipTrigger render={
                                        <Button
                                            size={"sm"}
                                            variant={"outline"}
                                            onClick={() => handleSave()}
                                            disabled={!activeFile || !activeFile.hasUnsavedChanges}>
                                            <Save className="size-4" />
                                        </Button>
                                    }>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        Save (Ctrl + S)
                                    </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger render={
                                        <Button
                                            size={"sm"}
                                            variant={"outline"}
                                            onClick={handleSaveAll}
                                            disabled={!hasUnsavedChanges}
                                        >
                                            <Save className="size-4" /> All
                                        </Button>
                                    }>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        Save All (Ctrl + Shift + S)
                                    </TooltipContent>
                                </Tooltip>

                                {/* TODO: TOGGLE-AI */}
                                <ToggleAI
                                    isEnabled={aiSuggestion.isEnabled}
                                    onToggle={aiSuggestion.toggleEnabled}
                                    suggestionLoading={aiSuggestion.isLoading}
                                />

                                <DropdownMenu>
                                    <DropdownMenuTrigger render={
                                        <Button
                                            size={"sm"}
                                            variant={"outline"}
                                        // onClick={() => { }}
                                        // disabled={!hasUnsavedChanges}
                                        >
                                            <Settings className="size-4" />
                                        </Button>
                                    }>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                            onClick={() => setIsPreviewVisible(!isPreviewVisible)}
                                        >
                                            {isPreviewVisible ? "Hide" : "Show"} Preview
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={closeAllFiles}>
                                            Close All Files
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                            </div>
                        </div>
                    </header>

                    <div className="h-[calc(100vh-4rem)]">
                        {openFiles.length > 0 ? (
                            <div className="h-full flex flex-col">
                                <div className="border-b bg-muted/30">
                                    <Tabs
                                        value={activeFileId || ""}
                                        onValueChange={handleTabChange}
                                    >
                                        <div className="flex items-center justify-between px-4 py-2">
                                            <TabsList className="h-8 bg-transparent p-0">
                                                {openFiles.map((file) => (
                                                    <TabsTrigger
                                                        key={file.id}
                                                        value={file.id}
                                                        className="relative h-8 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm group"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <FileText className="h-3 w-3" />
                                                            <span>
                                                                {file.filename}.{file.fileExtension}
                                                            </span>
                                                            {file.hasUnsavedChanges && (
                                                                <span className="h-2 w-2 rounded-full bg-orange-500" />
                                                            )}
                                                            <span
                                                                className="ml-2 h-4 w-4 hover:bg-destructive hover:text-destructive-foreground rounded-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    closeFile(file.id);
                                                                }}
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </span>
                                                        </div>
                                                    </TabsTrigger>
                                                ))}
                                            </TabsList>

                                            {openFiles.length > 1 && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={closeAllFiles}
                                                    className="h-6 px-2 text-xs"
                                                >
                                                    Close All
                                                </Button>
                                            )}
                                        </div>
                                    </Tabs>
                                </div>

                                <div className="flex-1">
                                    <ResizablePanelGroup
                                        orientation="horizontal"
                                        className="h-full"
                                    >
                                        <ResizablePanel defaultSize={isPreviewVisible ? 50 : 100}>
                                            <PlaygroundEditor
                                                activeFile={activeFile}
                                                content={activeFile?.content || ""}
                                                onContentChange={(value) =>
                                                    activeFileId && updateFileContent(activeFileId, value)
                                                }
                                                suggestion={aiSuggestion.suggestion}
                                                suggestionLoading={aiSuggestion.isLoading}
                                                suggestionPosition={aiSuggestion.position}
                                                onAcceptSuggestion={(editor, monaco) =>
                                                    aiSuggestion.acceptSuggestion(editor, monaco)
                                                }
                                                onRejectSuggestion={(editor) =>
                                                    aiSuggestion.rejectSuggestion(editor)
                                                }
                                                onTriggerSuggestion={(type, editor) =>
                                                    aiSuggestion.fetchSuggestion(type, editor)
                                                }
                                            />
                                        </ResizablePanel>
                                        {isPreviewVisible && (
                                            <>
                                                <ResizableHandle />
                                                <ResizablePanel defaultSize={50}>
                                                    <WebContainerPreview
                                                        templateData={templateData}
                                                        instance={instance}
                                                        writeFileSync={writeFileSync}
                                                        isLoading={containerLoading}
                                                        error={containerError}
                                                        serverUrl={serverUrl!}
                                                        forceResetup={false}
                                                    />
                                                </ResizablePanel>
                                            </>
                                        )}

                                    </ResizablePanelGroup>
                                </div>


                            </div>) : (
                            <div className="flex flex-col h-full items-center justify-center text-muted-foreground gap-4">
                                <FileText className="h-16 w-16 text-gray-300" />
                                <div className="text-center">
                                    <p className="text-lg font-medium">No files open</p>
                                    <p className="text-sm text-gray-500">
                                        Select a file from the sidebar to start editing
                                    </p>
                                </div>
                            </div>

                        )}
                    </div>
                </SidebarInset>
            </>
        </TooltipProvider>
    )
}

export default Page