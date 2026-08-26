"use client"
import { SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { useParams } from "next/navigation"
import { toast } from "sonner"
import React, { useEffect, useState } from "react"
import { useFileExplorer } from "@/features/playground/hooks/useFileExplorer";
import { Separator } from "@/components/ui/separator";
import { usePlayground } from "@/features/playground/hooks/usePlayground";
import TemplateFileTree from "@/features/playground/components/template-file-tree";
import { Button } from "@/components/ui/button";

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    TooltipProvider
} from "@/components/ui/tooltip";

import { Save, Bot, Settings, FileText, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TemplateFile } from "@/features/playground/types";

const Page = () => {
    const { id } = useParams<{ id: string }>();
    const [isPreviewVisible, setIsPreviewVisible] = useState(true);
    const { playgroundData, templateData, isLoading, error, loadPlayground, saveTemplateData } = usePlayground(id);
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

    useEffect(()=>{
        setPlaygroundId(id);
    }, [id, setPlaygroundId])
    
    useEffect(()=>{
        if(templateData && !openFiles.length){
            setTemplateData(templateData);
        }
    },[templateData, setTemplateData, openFiles.length])

    const activeFile = openFiles.find((f) => f.id === activeFileId);
    const hasUnsavedChanges = openFiles.some((f) => f.hasUnsavedChanges);
    // f = file

    const handleFileSelect = (file: TemplateFile) => {
        console.log("HandlePath", file)
        openFile(file);
    }

    return (
        <TooltipProvider>
            <>

                <TemplateFileTree data={templateData!} 
                onFileSelect={handleFileSelect} 
                selectedFile={activeFile} />

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
                                            onClick={() => { }}
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
                                            onClick={() => { }}
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
                                <Tooltip>
                                    <TooltipTrigger render={
                                        <Button
                                            size={"sm"}
                                            variant={"outline"}
                                            onClick={() => { }}
                                            disabled={!hasUnsavedChanges}
                                        >
                                            <Bot className="h-4 w-4" /> TOGGLE-AI
                                        </Button>
                                    }>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        TOGGLE-AI
                                    </TooltipContent>
                                </Tooltip>

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
                                        onValueChange={setActiveFileId}
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