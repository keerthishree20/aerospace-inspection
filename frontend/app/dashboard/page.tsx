"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const COMPLIANCE_COLORS: Record<string, string> = {
  airworthy: "#34d399",
  conditional: "#fbbf24",
  grounded: "#f87171",
};

const SEVERITY_COLORS: Record<string, string> = {
  low: "#34d399",
  medium: "#fbbf24",
  critical: "#f87171",
  none: "#64748b",
};

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/stats`).then((r) => r.json()),
      fetch(`${API_URL}/api/inspections`).then((r) => r.json()),
    ]).then(([s, i]) => {
      setStats(s);
      setInspections(i.slice(0, 5));
    }).finally(() => setLoading(false));
  }, []);

  const compliancePieData = stats
    ? Object.entries(stats.compliance ?? {}).map(([key, val]) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        value: val as number,
        key,
      }))
    : [];

  const severityBarData = stats
    ? Object.entries(stats.severities ?? {}).map(([key, val]) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        count: val as number,
        key,
      }))
    : [];

  const defectBarData = stats
    ? Object.entries(stats.defect_types ?? {}).map(([key, val]) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        count: val as number,
      }))
    : [];

  const groundedCount = stats?.compliance?.grounded ?? 0;

  return (
    <main className="min-h-screen">
      <div className="border-b border-slate-800 px-8 py-6">
        <h1 className="text-2xl font-semibold text-white">Fleet Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Aggregated defect intelligence across all inspections</p>
      </div>

      <div className="max-w-6xl px-8 py-8 space-y-8">
        {/* Grounded Alert */}
        {groundedCount > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4 flex items-center gap-3">
            <span className="text-2xl">🚨</span>
            <div>
              <p className="font-semibold text-red-400">
                {groundedCount} component{groundedCount > 1 ? "s" : ""} currently GROUNDED
              </p>
              <p className="text-red-400/80 text-sm">Immediate maintenance action required before next flight</p>
            </div>
            <button
              onClick={() => router.push("/history")}
              className="ml-auto text-sm border border-red-500/40 hover:bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg transition-colors"
            >
              View Details →
            </button>
          </div>
        )}

        {loading && <div className="text-center py-20 text-slate-500">Loading stats...</div>}

        {stats && !loading && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Inspections", value: stats.total_inspections, color: "text-white" },
                { label: "Airworthy", value: stats.compliance?.airworthy ?? 0, color: "text-emerald-400" },
                { label: "Conditional", value: stats.compliance?.conditional ?? 0, color: "text-amber-400" },
                { label: "Grounded", value: stats.compliance?.grounded ?? 0, color: "text-red-400" },
              ].map((card) => (
                <div key={card.label} className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
                  <p className="text-slate-500 text-xs mb-2">{card.label}</p>
                  <p className={`text-4xl font-bold ${card.color}`}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Compliance Donut */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
                <h2 className="font-semibold mb-4 text-slate-200">Compliance Distribution</h2>
                {compliancePieData.every((d) => d.value === 0) ? (
                  <p className="text-slate-600 text-sm text-center py-10">No data yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={compliancePieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {compliancePieData.map((entry) => (
                          <Cell key={entry.key} fill={COMPLIANCE_COLORS[entry.key]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
                        labelStyle={{ color: "#fff" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div className="flex justify-center gap-4 mt-2">
                  {compliancePieData.map((d) => (
                    <div key={d.key} className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: COMPLIANCE_COLORS[d.key] }} />
                      {d.name} ({d.value})
                    </div>
                  ))}
                </div>
              </div>

              {/* Severity Bar Chart */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
                <h2 className="font-semibold mb-4 text-slate-200">Severity Breakdown</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={severityBarData} barSize={36}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
                      labelStyle={{ color: "#fff" }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {severityBarData.map((entry) => (
                        <Cell key={entry.key} fill={SEVERITY_COLORS[entry.key]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Defect Types Chart */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
              <h2 className="font-semibold mb-4 text-slate-200">Defect Types Detected</h2>
              {defectBarData.length === 0 ? (
                <p className="text-slate-600 text-sm">No defects recorded yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={defectBarData} barSize={48}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
                      labelStyle={{ color: "#fff" }}
                    />
                    <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Recent Inspections */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-200">Recent Inspections</h2>
                <button
                  onClick={() => router.push("/history")}
                  className="text-xs text-cyan-400 hover:text-cyan-300"
                >
                  View all →
                </button>
              </div>
              <div className="space-y-2">
                {inspections.length === 0 && (
                  <p className="text-slate-600 text-sm">No inspections yet.</p>
                )}
                {inspections.map((i) => (
                  <div key={i.id} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-4 py-3">
                    <div>
                      <p className="font-medium text-sm text-slate-200">{i.component_name}</p>
                      <p className="text-xs text-slate-500 capitalize">{i.defect_type} · {new Date(i.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">{i.confidence}%</span>
                      <span
                        className="text-xs font-semibold px-2 py-1 rounded-full capitalize"
                        style={{
                          background: COMPLIANCE_COLORS[i.compliance_status] + "22",
                          color: COMPLIANCE_COLORS[i.compliance_status],
                          border: `1px solid ${COMPLIANCE_COLORS[i.compliance_status]}55`,
                        }}
                      >
                        {i.compliance_status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
