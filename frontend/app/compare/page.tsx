"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const verdictStyles: Record<string, { color: string; icon: string; label: string }> = {
  worsened: { color: "bg-red-500", icon: "📈", label: "WORSENED" },
  new_defect: { color: "bg-red-500", icon: "🆕", label: "NEW DEFECT" },
  improved: { color: "bg-emerald-500", icon: "📉", label: "IMPROVED" },
  resolved: { color: "bg-emerald-500", icon: "✅", label: "RESOLVED" },
  stable: { color: "bg-amber-500", icon: "➖", label: "STABLE" },
  no_defect: { color: "bg-emerald-500", icon: "✅", label: "NO DEFECT" },
};

function ImageWithBoxes({ src, boxes }: { src: string; boxes: any[] }) {
  return (
    <div className="relative w-full h-64 bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
      <img src={src} alt="" className="w-full h-64 object-contain" />
      {boxes?.map((box, i) => (
        <div
          key={i}
          className="absolute border-2 border-red-500 pointer-events-none"
          style={{
            left: `${box.x1 * 100}%`,
            top: `${box.y1 * 100}%`,
            width: `${(box.x2 - box.x1) * 100}%`,
            height: `${(box.y2 - box.y1) * 100}%`,
          }}
        >
          <span className="absolute -top-5 left-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">
            {box.class} {box.confidence}%
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ComparePage() {
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [beforePreview, setBeforePreview] = useState<string | null>(null);
  const [afterPreview, setAfterPreview] = useState<string | null>(null);
  const [componentName, setComponentName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!beforeFile || !afterFile) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("before_file", beforeFile);
    formData.append("after_file", afterFile);
    formData.append("component_name", componentName || "Unknown Component");

    try {
      const res = await fetch(`${API_URL}/api/compare`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Comparison failed");
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const verdict = result ? verdictStyles[result.comparison.verdict] : null;

  return (
    <main className="min-h-screen">
      <div className="border-b border-slate-800 px-8 py-6">
        <h1 className="text-2xl font-semibold text-white">Defect Degradation Tracking</h1>
        <p className="text-slate-400 text-sm mt-1">Upload two photos of the same component taken at different times to track how a defect has progressed</p>
      </div>

      <div className="max-w-5xl px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-300">Before (earlier inspection)</p>
            <div
              className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center hover:border-cyan-500/60 transition-colors cursor-pointer min-h-[180px] flex items-center justify-center bg-slate-900/40"
              onClick={() => document.getElementById("beforeInput")?.click()}
            >
              {beforePreview ? (
                <img src={beforePreview} alt="Before" className="w-full h-40 object-contain rounded-lg" />
              ) : (
                <div className="space-y-2">
                  <div className="text-4xl">📷</div>
                  <p className="text-slate-400 text-sm">Click to upload earlier photo</p>
                </div>
              )}
              <input
                id="beforeInput"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setBeforeFile(f);
                  setBeforePreview(URL.createObjectURL(f));
                  setResult(null);
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-300">After (recent inspection)</p>
            <div
              className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center hover:border-cyan-500/60 transition-colors cursor-pointer min-h-[180px] flex items-center justify-center bg-slate-900/40"
              onClick={() => document.getElementById("afterInput")?.click()}
            >
              {afterPreview ? (
                <img src={afterPreview} alt="After" className="w-full h-40 object-contain rounded-lg" />
              ) : (
                <div className="space-y-2">
                  <div className="text-4xl">📷</div>
                  <p className="text-slate-400 text-sm">Click to upload recent photo</p>
                </div>
              )}
              <input
                id="afterInput"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setAfterFile(f);
                  setAfterPreview(URL.createObjectURL(f));
                  setResult(null);
                }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          <input
            type="text"
            placeholder="Component name (e.g. Left Wing Panel)"
            value={componentName}
            onChange={(e) => setComponentName(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition-colors"
          />
          <button
            onClick={handleSubmit}
            disabled={!beforeFile || !afterFile || loading}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-all shadow-lg shadow-blue-500/20"
          >
            {loading ? "Comparing..." : "Run Comparison"}
          </button>
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
          )}
        </div>

        {loading && (
          <div className="border border-slate-800 rounded-xl p-8 text-center space-y-4 bg-slate-900/40">
            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-400">Analyzing both images and computing degradation...</p>
          </div>
        )}

        {result && !loading && verdict && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 border border-slate-800 rounded-xl p-5 bg-slate-900/40">
              <span className={`text-white text-sm font-bold px-4 py-2 rounded-full ${verdict.color}`}>
                {verdict.icon} {verdict.label}
              </span>
              <p className="text-sm text-slate-300">{result.comparison.summary}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-300">Before — {result.before.defect_type} ({result.before.severity})</p>
                <ImageWithBoxes src={beforePreview!} boxes={result.before.bounding_boxes} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-300">After — {result.after.defect_type} ({result.after.severity})</p>
                <ImageWithBoxes src={afterPreview!} boxes={result.after.bounding_boxes} />
              </div>
            </div>

            {result.comparison.area_change_pct !== null && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 text-sm">
                <span className="text-slate-500">Defect area change: </span>
                <span className={result.comparison.area_change_pct > 0 ? "text-red-400 font-semibold" : "text-emerald-400 font-semibold"}>
                  {result.comparison.area_change_pct > 0 ? "+" : ""}{result.comparison.area_change_pct}%
                </span>
              </div>
            )}
          </div>
        )}

        {!result && !loading && (
          <div className="border border-slate-800 rounded-xl p-12 text-center text-slate-600 bg-slate-900/40">
            <div className="text-4xl mb-3">🔍</div>
            <p>Upload both images to track defect progression</p>
          </div>
        )}
      </div>
    </main>
  );
}
