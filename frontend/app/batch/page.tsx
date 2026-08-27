"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const severityColors: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  critical: "bg-red-500/10 text-red-400 border-red-500/30",
  none: "bg-slate-700/30 text-slate-400 border-slate-600/40",
};

const complianceColors: Record<string, string> = {
  airworthy: "bg-emerald-500",
  conditional: "bg-amber-500",
  grounded: "bg-red-500",
};

const complianceIcons: Record<string, string> = {
  airworthy: "✅",
  conditional: "⚠️",
  grounded: "🚫",
};

export default function BatchInspect() {
  const [files, setFiles] = useState<File[]>([]);
  const [componentName, setComponentName] = useState("");
  const [loading, setLoading] = useState(false);
  const [batchResult, setBatchResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    setFiles(selected);
    setBatchResult(null);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files || []);
    if (!dropped.length) return;
    setFiles(dropped);
    setBatchResult(null);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!files.length) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    formData.append("component_name", componentName || "Unknown Component");

    try {
      const res = await fetch(`${API_URL}/api/inspect/batch`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Batch inspection failed");
      const data = await res.json();
      setBatchResult(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen">
      <div className="border-b border-slate-800 px-8 py-6">
        <h1 className="text-2xl font-semibold text-white">Batch Component Inspection</h1>
        <p className="text-slate-400 text-sm mt-1">Upload multiple component images at once for bulk AI-powered defect detection</p>
      </div>

      <div className="max-w-5xl px-8 py-8">
        <div className="space-y-4 mb-8">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-cyan-500/60 transition-colors cursor-pointer bg-slate-900/40"
            onClick={() => document.getElementById("batchFileInput")?.click()}
          >
            {files.length > 0 ? (
              <div className="space-y-3">
                <div className="text-4xl">🗂️</div>
                <p className="text-slate-200 font-medium">{files.length} image{files.length > 1 ? "s" : ""} selected</p>
                <p className="text-slate-500 text-sm">{files.map((f) => f.name).join(", ")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-5xl">🗂️</div>
                <p className="text-slate-300 font-medium">Drop multiple images here or click to upload</p>
                <p className="text-slate-500 text-sm">Select several JPG, PNG, or WEBP files</p>
              </div>
            )}
            <input
              id="batchFileInput"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <input
            type="text"
            placeholder="Section/batch name (e.g. Left Wing Panel Set)"
            value={componentName}
            onChange={(e) => setComponentName(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition-colors"
          />

          <button
            onClick={handleSubmit}
            disabled={!files.length || loading}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-all shadow-lg shadow-blue-500/20"
          >
            {loading ? `Analyzing ${files.length} image${files.length > 1 ? "s" : ""}...` : "Run Batch Inspection"}
          </button>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
          )}
        </div>

        {loading && (
          <div className="border border-slate-800 rounded-xl p-8 text-center space-y-4 bg-slate-900/40">
            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-400">Running inspection across {files.length} components...</p>
          </div>
        )}

        {batchResult && !loading && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <div className="text-3xl">📋</div>
              <div>
                <p className="font-semibold text-white">{batchResult.total} components inspected</p>
                <p className="text-sm text-slate-400">
                  {batchResult.grounded_count > 0 ? (
                    <span className="text-red-400">⚠️ {batchResult.grounded_count} grounded — immediate attention required</span>
                  ) : (
                    <span className="text-emerald-400">✅ No critical groundings detected</span>
                  )}
                </p>
              </div>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <th className="text-left px-4 py-3">Image</th>
                    <th className="text-left px-4 py-3">Defect Type</th>
                    <th className="text-left px-4 py-3">Severity</th>
                    <th className="text-left px-4 py-3">Confidence</th>
                    <th className="text-left px-4 py-3">Compliance</th>
                    <th className="text-left px-4 py-3">Repair Time</th>
                  </tr>
                </thead>
                <tbody>
                  {batchResult.results.map((r: any) => (
                    <tr key={r.id} className="border-t border-slate-800 hover:bg-slate-800/40">
                      <td className="px-4 py-3 text-slate-300">{r.image_filename}</td>
                      <td className="px-4 py-3 capitalize text-slate-200">{r.defect_type}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded border capitalize ${severityColors[r.severity]}`}>
                          {r.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-200">{r.confidence}%</td>
                      <td className="px-4 py-3">
                        <span className={`text-white text-xs font-bold px-2 py-1 rounded-full ${complianceColors[r.compliance_status]}`}>
                          {complianceIcons[r.compliance_status]} {r.compliance_status?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{r.estimated_repair_time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!batchResult && !loading && (
          <div className="border border-slate-800 rounded-xl p-12 text-center text-slate-600 bg-slate-900/40">
            <div className="text-4xl mb-3">🔍</div>
            <p>Upload multiple images to start batch inspection</p>
          </div>
        )}
      </div>
    </main>
  );
}
