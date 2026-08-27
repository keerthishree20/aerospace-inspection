"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const severityBadge: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-400",
  medium: "bg-amber-500/10 text-amber-400",
  critical: "bg-red-500/10 text-red-400",
  none: "bg-slate-700/30 text-slate-400",
};

const complianceBadge: Record<string, string> = {
  airworthy: "text-emerald-400",
  conditional: "text-amber-400",
  grounded: "text-red-400",
};

export default function HistoryPage() {
  const router = useRouter();
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/inspections`)
      .then((r) => r.json())
      .then((data) => setInspections(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen">
      <div className="border-b border-slate-800 px-8 py-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Inspection History</h1>
          <p className="text-slate-400 text-sm mt-1">All past aircraft component inspections</p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all shadow-lg shadow-blue-500/20"
        >
          + New Inspection
        </button>
      </div>

      <div className="max-w-5xl px-8 py-8">
        {loading && (
          <div className="text-center py-20 text-slate-500">Loading inspections...</div>
        )}

        {!loading && inspections.length === 0 && (
          <div className="text-center py-20 text-slate-600">
            <div className="text-4xl mb-3">📋</div>
            <p>No inspections yet. Run your first inspection.</p>
          </div>
        )}

        {!loading && inspections.length > 0 && (
          <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/40">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 text-left">
                  <th className="py-3 pl-4 pr-4">#</th>
                  <th className="py-3 pr-4">Component</th>
                  <th className="py-3 pr-4">Defect Type</th>
                  <th className="py-3 pr-4">Severity</th>
                  <th className="py-3 pr-4">Confidence</th>
                  <th className="py-3 pr-4">Compliance</th>
                  <th className="py-3 pr-4">Date</th>
                </tr>
              </thead>
              <tbody>
                {inspections.map((i) => (
                  <tr key={i.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 pl-4 pr-4 text-slate-500">{i.id}</td>
                    <td className="py-4 pr-4 font-medium text-slate-200">{i.component_name}</td>
                    <td className="py-4 pr-4 capitalize text-slate-300">{i.defect_type}</td>
                    <td className="py-4 pr-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold capitalize ${severityBadge[i.severity]}`}>
                        {i.severity}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-slate-300">{i.confidence}%</td>
                    <td className={`py-4 pr-4 font-semibold capitalize ${complianceBadge[i.compliance_status]}`}>
                      {i.compliance_status}
                    </td>
                    <td className="py-4 pr-4 text-slate-500">
                      {new Date(i.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
