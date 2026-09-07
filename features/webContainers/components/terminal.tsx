"use client";

import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import type { Terminal as TerminalType } from "xterm";
import type { FitAddon as FitAddonType } from "xterm-addon-fit";
import type { SearchAddon as SearchAddonType } from "xterm-addon-search";
import "xterm/css/xterm.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Copy, Trash2, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface TerminalProps {
  webcontainerUrl?: string;
  className?: string;
  theme?: "dark" | "light";
  webContainerInstance?: any;
}

// Define the methods that will be exposed through the ref
export interface TerminalRef {
  writeToTerminal: (data: string) => void;
  clearTerminal: () => void;
  focusTerminal: () => void;
  runCommand: (command: string) => void;
  killProcess: () => void;
}

const TerminalComponent = forwardRef<TerminalRef, TerminalProps>(({ 
  webcontainerUrl, 
  className,
  theme = "dark",
  webContainerInstance
}, ref) => {
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const term = useRef<TerminalType | null>(null);
  const fitAddon = useRef<FitAddonType | null>(null);
  const searchAddon = useRef<SearchAddonType | null>(null);
  const shellProcess = useRef<any>(null);
  const shellInputWriter = useRef<WritableStreamDefaultWriter<string> | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const terminalThemes = {
    dark: {
      background: "#09090B",
      foreground: "#FAFAFA",
      cursor: "#FAFAFA",
      cursorAccent: "#09090B",
      selection: "#27272A",
      black: "#18181B",
      red: "#EF4444",
      green: "#22C55E",
      yellow: "#EAB308",
      blue: "#3B82F6",
      magenta: "#A855F7",
      cyan: "#06B6D4",
      white: "#F4F4F5",
      brightBlack: "#3F3F46",
      brightRed: "#F87171",
      brightGreen: "#4ADE80",
      brightYellow: "#FDE047",
      brightBlue: "#60A5FA",
      brightMagenta: "#C084FC",
      brightCyan: "#22D3EE",
      brightWhite: "#FFFFFF",
    },
    light: {
      background: "#FFFFFF",
      foreground: "#18181B",
      cursor: "#18181B",
      cursorAccent: "#FFFFFF",
      selection: "#E4E4E7",
      black: "#18181B",
      red: "#DC2626",
      green: "#16A34A",
      yellow: "#CA8A04",
      blue: "#2563EB",
      magenta: "#9333EA",
      cyan: "#0891B2",
      white: "#F4F4F5",
      brightBlack: "#71717A",
      brightRed: "#EF4444",
      brightGreen: "#22C55E",
      brightYellow: "#EAB308",
      brightBlue: "#3B82F6",
      brightMagenta: "#A855F7",
      brightCyan: "#06B6D4",
      brightWhite: "#FAFAFA",
    },
  };

  const clearTerminal = useCallback(() => {
    if (term.current) {
      term.current.clear();
    }
  }, []);

  const killProcess = useCallback(() => {
    if (shellInputWriter.current) {
      shellInputWriter.current.write("\x03"); // Send SIGINT (Ctrl+C)
    }
  }, []);

  const runCommand = useCallback((command: string) => {
    if (shellInputWriter.current) {
      const formatted = command.endsWith("\n") || command.endsWith("\r") ? command : command + "\r";
      shellInputWriter.current.write(formatted);
    } else if (term.current) {
      term.current.writeln(`\r\n[Cannot run '${command}': shell not connected]`);
    }
  }, []);

  // Expose methods through ref
  useImperativeHandle(ref, () => ({
    writeToTerminal: (data: string) => {
      if (term.current) {
        term.current.write(data);
      }
    },
    clearTerminal,
    focusTerminal: () => {
      if (term.current) {
        term.current.focus();
      }
    },
    runCommand,
    killProcess,
  }));

  const copyTerminalContent = useCallback(async () => {
    if (term.current) {
      const content = term.current.getSelection();
      if (content) {
        try {
          await navigator.clipboard.writeText(content);
        } catch (error) {
          console.error("Failed to copy to clipboard:", error);
        }
      }
    }
  }, []);

  const downloadTerminalLog = useCallback(() => {
    if (term.current) {
      const buffer = term.current.buffer.active;
      let content = "";
      
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) {
          content += line.translateToString(true) + "\n";
        }
      }

      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `terminal-log-${new Date().toISOString().slice(0, 19)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, []);

  const searchInTerminal = useCallback((searchTermValue: string) => {
    if (searchAddon.current && searchTermValue) {
      searchAddon.current.findNext(searchTermValue);
    }
  }, []);

  // Initialize xterm instance
  useEffect(() => {
    let isMounted = true;
    let resizeObserver: ResizeObserver | null = null;

    async function initializeTerminal() {
      if (!terminalContainerRef.current || term.current) return;

      const { Terminal } = await import("xterm");
      const { FitAddon } = await import("xterm-addon-fit");
      const { WebLinksAddon } = await import("xterm-addon-web-links");
      const { SearchAddon } = await import("xterm-addon-search");

      if (!isMounted || !terminalContainerRef.current) return;

      const terminal = new Terminal({
        cursorBlink: true,
        fontFamily: '"Fira Code", "JetBrains Mono", "Consolas", monospace',
        fontSize: 13,
        lineHeight: 1.2,
        letterSpacing: 0,
        theme: terminalThemes[theme],
        allowTransparency: false,
        convertEol: true,
        scrollback: 2000,
        tabStopWidth: 2,
      });

      const fitAddonInstance = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      const searchAddonInstance = new SearchAddon();

      terminal.loadAddon(fitAddonInstance);
      terminal.loadAddon(webLinksAddon);
      terminal.loadAddon(searchAddonInstance);

      terminal.open(terminalContainerRef.current);
      
      fitAddon.current = fitAddonInstance;
      searchAddon.current = searchAddonInstance;
      term.current = terminal;

      // Fit terminal to dimensions
      requestAnimationFrame(() => {
        if (isMounted && fitAddon.current) {
          try {
            fitAddon.current.fit();
          } catch (e) {
            // Ignore mount timing
          }
        }
      });

      // Handle terminal resize observer
      resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          if (isMounted && fitAddon.current) {
            try {
              fitAddon.current.fit();
              if (shellProcess.current && term.current) {
                shellProcess.current.resize({
                  cols: term.current.cols,
                  rows: term.current.rows,
                });
              }
            } catch (e) {
              // Ignore layout shifts
            }
          }
        });
      });

      if (terminalContainerRef.current) {
        resizeObserver.observe(terminalContainerRef.current);
      }
    }

    initializeTerminal();

    return () => {
      isMounted = false;
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (shellInputWriter.current) {
        try {
          shellInputWriter.current.releaseLock();
        } catch (e) {
          // ignore
        }
        shellInputWriter.current = null;
      }
      if (shellProcess.current) {
        try {
          shellProcess.current.kill();
        } catch (e) {
          // ignore
        }
        shellProcess.current = null;
      }
      if (term.current) {
        term.current.dispose();
        term.current = null;
      }
    };
  }, [theme]);

  // Connect terminal to WebContainer jsh shell
  const connectShell = useCallback(async () => {
    if (!webContainerInstance || !term.current || shellProcess.current) return;

    try {
      const terminal = term.current;
      const fit = fitAddon.current;
      if (fit) {
        try {
          fit.fit();
        } catch (e) {
          // ignore
        }
      }

      const cols = terminal.cols || 80;
      const rows = terminal.rows || 24;

      // Spawn native WebContainer jsh shell
      const shell = await webContainerInstance.spawn("jsh", {
        terminal: {
          cols,
          rows,
        },
      });

      shellProcess.current = shell;
      setIsConnected(true);

      // Pipe shell output directly into xterm
      shell.output.pipeTo(
        new WritableStream({
          write(data) {
            if (term.current) {
              term.current.write(data);
            }
          },
        })
      );

      // Pipe user terminal keystrokes into shell input
      const inputWriter = shell.input.getWriter();
      shellInputWriter.current = inputWriter;

      const onDataDisposable = terminal.onData((data) => {
        if (shellInputWriter.current) {
          shellInputWriter.current.write(data);
        }
      });

      // Handle shell process exit
      shell.exit.then((code: number) => {
        setIsConnected(false);
        shellProcess.current = null;
        if (shellInputWriter.current) {
          try {
            shellInputWriter.current.releaseLock();
          } catch (e) {
            // ignore
          }
          shellInputWriter.current = null;
        }
        onDataDisposable.dispose();
        if (term.current) {
          term.current.writeln(`\r\n[Shell exited with code ${code}. Press Enter or reconnect to restart]`);
        }
      });

    } catch (error) {
      console.error("WebContainer shell error:", error);
      setIsConnected(false);
      if (term.current) {
        term.current.writeln(`\r\n❌ Failed to start WebContainer shell: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }, [webContainerInstance]);

  useEffect(() => {
    if (webContainerInstance && term.current && !shellProcess.current) {
      connectShell();
    }
  }, [webContainerInstance, connectShell]);

  return (
    <div className={cn("flex flex-col h-full bg-background border rounded-lg overflow-hidden", className)}>
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/40 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
          </div>
          <span className="text-xs font-semibold text-foreground/80">WebContainer Terminal</span>
          <div className="flex items-center gap-1.5 ml-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
            )} />
            <span className="text-[11px] text-muted-foreground">
              {isConnected ? "Connected (jsh)" : "Connecting..."}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {showSearch && (
            <div className="flex items-center gap-1 mr-1">
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  searchInTerminal(e.target.value);
                }}
                className="h-6 w-28 text-xs px-2"
              />
            </div>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSearch(!showSearch)}
            className="h-6 w-6 p-0 hover:bg-muted"
            title="Search"
          >
            <Search className="h-3 w-3" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={copyTerminalContent}
            className="h-6 w-6 p-0 hover:bg-muted"
            title="Copy Selection"
          >
            <Copy className="h-3 w-3" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={downloadTerminalLog}
            className="h-6 w-6 p-0 hover:bg-muted"
            title="Download Log"
          >
            <Download className="h-3 w-3" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={clearTerminal}
            className="h-6 w-6 p-0 hover:bg-muted"
            title="Clear Terminal"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Terminal Content */}
      <div className="flex-1 relative min-h-0">
        <div 
          ref={terminalContainerRef} 
          className="absolute inset-0 p-2 overflow-hidden"
          style={{ 
            background: terminalThemes[theme].background,
          }}
        />
      </div>
    </div>
  );
});

TerminalComponent.displayName = "TerminalComponent";

export default TerminalComponent;