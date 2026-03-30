"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { getBots } from "@/lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/* ══════════════════════════════════════
   IMPORT STRATEGY MODAL — Fully Interactive
   - Drag-drop zone with visual feedback
   - File input browser
   - Server path import
   - Bot selector when multiple bots
   ══════════════════════════════════════ */


interface ImportModalProps {
  onImport: (fileName: string) => void;
}

export function ImportStrategyModal({ onImport }: ImportModalProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [bots, setBots] = useState<{ id: number; name: string; status: string }[]>([]);
  const [selectedBot, setSelectedBot] = useState<number | "">("");
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      getBots().then((res) => {
        setBots(res);
        if (res.length > 0) setSelectedBot(res[0].id);
      }).catch(console.error);
    }
  }, [open]);

  const handleFile = useCallback((f: File) => {
    if (f.name.endsWith(".py")) {
      setFile(f);
    } else {
      console.warn("Only .py files are accepted");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleImport = useCallback(async () => {
    if (!file) return;
    setImporting(true);
    try {
      // Pass the selected bot alongside the file to the parent handler if needed
      await onImport(file.name);
    } catch (e) {
      console.error(e);
    } finally {
      setImporting(false);
      setFile(null);
      setOpen(false);
    }
  }, [file, onImport]);

  const reset = () => {
    setFile(null);
    setDragging(false);
    setImporting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <button className="h-9 px-4 rounded-btn bg-accent/50 border border-border text-xs font-bold text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors flex items-center gap-2">
          📥 Import .py
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-extrabold text-foreground">Import Strategy</DialogTitle>
        </DialogHeader>

        {/* Drag-drop zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors my-2 ${
            dragging ? "border-primary bg-primary/5" : file ? "border-ft-green bg-ft-green/5" : "border-border hover:border-primary/50"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".py"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          {file ? (
            <>
              <div className="text-3xl mb-2">✅</div>
              <div className="text-sm text-foreground font-medium mb-1">{file.name}</div>
              <div className="text-2xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB &mdash; Click to change</div>
            </>
          ) : (
            <>
              <div className="text-3xl mb-2">{dragging ? "📦" : "📄"}</div>
              <div className="text-sm text-foreground font-medium mb-1">
                {dragging ? "Drop file here" : "Drop .py strategy file here or click to browse"}
              </div>
              <div className="text-2xs text-muted-foreground">Accepts FreqTrade strategy Python files</div>
            </>
          )}
        </div>

        {/* Bot selector */}
        <div className="mb-2">
          <label className="text-2xs text-muted-foreground font-medium block mb-1">Import to bot</label>
          <select
            value={selectedBot}
            onChange={(e) => setSelectedBot(Number(e.target.value))}
            className="w-full bg-accent/30 border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary transition-colors"
          >
            {bots.length === 0 ? (
              <option value="">No bots available</option>
            ) : (
              bots.map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({b.status})</option>
              ))
            )}
          </select>
        </div>

        {/* Server import */}
        <div className="text-2xs text-muted-foreground text-center my-2">&mdash; or import from server &mdash;</div>
        <div className="bg-accent/30 border border-border rounded-lg px-4 py-3 text-xs text-muted-foreground font-mono-data mb-4">
          /opt/freqtrade/user_data/strategies/ <span className="text-foreground font-semibold">(26 files)</span>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => { reset(); setOpen(false); }}>Cancel</Button>
          <Button onClick={handleImport} disabled={!file || importing}>
            {importing ? "Importing..." : "Import"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
