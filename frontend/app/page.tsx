"use client";

import { useState, useRef, useEffect } from "react";

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

const QUICK_QUESTIONS = [
  "What caused this defect?",
  "Is it safe to fly?",
  "What repair procedure is needed?",
  "How urgent is the repair?",
];

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [componentName, setComponentName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setResult(null);
    setError(null);
    setChatMessages([]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    setFile(dropped);
    setPreview(URL.createObjectURL(dropped));
    setResult(null);
    setError(null);
    setChatMessages([]);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setChatMessages([]);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("component_name", componentName || "Unknown Component");

    try {
      const res = await fetch(`${API_URL}/api/inspect`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Inspection failed");
      const data = await res.json();
      setResult(data);
      setChatMessages([{
        role: "assistant",
        content: `Inspection complete for **${data.component_name}**. I detected **${data.defect_type}** with **${data.severity}** severity. Compliance status: **${data.compliance_status?.toUpperCase()}**. Ask me anything about this result.`,
      }]);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const sendChat = async (message: string) => {
    if (!message.trim() || !result) return;
    const userMsg = { role: "user", content: message };
    const history = [...chatMessages, userMsg];
    setChatMessages(history);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspection_id: result.id,
          message,
          history: chatMessages,
        }),
      });
      const data = await res.json();
      setChatMessages([...history, { role: "assistant", content: data.response }]);
    } catch {
      setChatMessages([...history, { role: "assistant", content: "Sorry, I couldn't process that. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <main className="min-h-screen">
      <div className="border-b border-slate-800 px-8 py-6">
        <h1 className="text-2xl font-semibold text-white">Aircraft Component Inspection</h1>
        <p className="text-slate-400 text-sm mt-1">Upload an image of an aircraft component for AI-powered defect detection</p>
      </div>

      <div className="max-w-6xl px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Panel */}
          <div className="space-y-4">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-cyan-500/60 transition-colors cursor-pointer bg-slate-900/40"
              onClick={() => document.getElementById("fileInput")?.click()}
            >
              {preview ? (
                <div className="relative w-full h-64">
                  <img src={preview} alt="Preview" className="w-full h-64 object-contain rounded-lg" />
                  {result?.bounding_boxes?.map((box: any, i: number) => (
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
              ) : (
                <div className="space-y-3">
                  <div className="text-5xl">📷</div>
                  <p className="text-slate-300 font-medium">Drop image here or click to upload</p>
                  <p className="text-slate-500 text-sm">Supports JPG, PNG, WEBP</p>
                </div>
              )}
              <input id="fileInput" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>

            <input
              type="text"
              placeholder="Component name (e.g. Left Wing Panel, Engine Blade)"
              value={componentName}
              onChange={(e) => setComponentName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition-colors"
            />

            <button
              onClick={handleSubmit}
              disabled={!file || loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-all shadow-lg shadow-blue-500/20"
            >
              {loading ? "Analyzing..." : "Run Inspection"}
            </button>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
            )}

            {/* Result Card */}
            {loading && (
              <div className="border border-slate-800 rounded-xl p-8 text-center space-y-4 bg-slate-900/40">
                <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-slate-400">Running YOLOv8 inference...</p>
              </div>
            )}

            {result && !loading && (
              <div className="border border-slate-800 rounded-xl p-6 space-y-4 bg-slate-900/40">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-lg text-white">{result.component_name}</h2>
                  <span className={`text-white text-xs font-bold px-3 py-1 rounded-full ${complianceColors[result.compliance_status]}`}>
                    {complianceIcons[result.compliance_status]} {result.compliance_status?.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/60 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Defect Type</p>
                    <p className="font-medium capitalize text-slate-200">{result.defect_type}</p>
                  </div>
                  <div className="bg-slate-800/60 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Severity</p>
                    <span className={`text-xs font-semibold px-2 py-1 rounded border capitalize ${severityColors[result.severity]}`}>
                      {result.severity}
                    </span>
                  </div>
                  <div className="bg-slate-800/60 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Confidence</p>
                    <p className="font-medium text-slate-200">{result.confidence}%</p>
                  </div>
                  <div className="bg-slate-800/60 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Repair Time</p>
                    <p className="font-medium text-slate-200">{result.estimated_repair_time}</p>
                  </div>
                </div>
                <div className="bg-slate-800/60 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Location</p>
                  <p className="text-sm text-slate-300">{result.location}</p>
                </div>
                <div className="bg-slate-800/60 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Recommendation</p>
                  <p className="text-sm text-slate-300">{result.recommendation}</p>
                </div>
              </div>
            )}

            {!result && !loading && (
              <div className="border border-slate-800 rounded-xl p-8 text-center text-slate-600 bg-slate-900/40">
                <div className="text-4xl mb-3">🔍</div>
                <p>Upload an image to start inspection</p>
              </div>
            )}
          </div>

          {/* Chat Panel */}
          <div className="flex flex-col border border-slate-800 rounded-xl overflow-hidden h-[700px] bg-slate-900/40">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
              <span className="font-semibold text-sm text-slate-200">AI Inspector Chatbot</span>
              {result && <span className="ml-auto text-xs text-slate-500">{result.component_name}</span>}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 && (
                <div className="text-center text-slate-600 mt-16 space-y-2">
                  <div className="text-4xl">💬</div>
                  <p className="text-sm">Run an inspection to start chatting</p>
                  <p className="text-xs">Ask anything about the defect, repair procedures, or safety</p>
                </div>
              )}

              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-br-sm"
                      : "bg-slate-800 text-slate-200 rounded-bl-sm"
                  }`}>
                    {msg.content.split("**").map((part, j) =>
                      j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                    )}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Questions */}
            {result && chatMessages.length <= 1 && (
              <div className="px-4 pb-2 flex flex-wrap gap-2">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendChat(q)}
                    className="text-xs border border-slate-700 hover:border-cyan-500/60 hover:text-cyan-400 text-slate-400 px-3 py-1.5 rounded-full transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="px-4 py-3 border-t border-slate-800 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat(chatInput)}
                placeholder={result ? "Ask about this inspection..." : "Run an inspection first..."}
                disabled={!result || chatLoading}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 disabled:opacity-40"
              />
              <button
                onClick={() => sendChat(chatInput)}
                disabled={!result || !chatInput.trim() || chatLoading}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-30 disabled:cursor-not-allowed px-4 py-2.5 rounded-lg transition-all"
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
