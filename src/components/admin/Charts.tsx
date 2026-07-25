"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { ChartPoint } from "@/types/admin";

const colors = ["#1C3934", "#CFA47A", "#46756C", "#96B8B0"];

export function ChartCard({ title, subtitle, summary, children }: { title: string; subtitle?: string; summary: string; children: React.ReactNode }) {
  return <article className="chart-card"><div className="card-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div><div className="chart-wrap">{children}</div><p className="sr-only">{summary}</p></article>;
}

export function TrendChart({ data, compare = false }: { data: ChartPoint[]; compare?: boolean }) {
  return <ResponsiveContainer width="100%" height={250}><AreaChart data={data} margin={{ top: 12, right: 0, left: -18, bottom: 0 }}><defs><linearGradient id="tealFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#46756C" stopOpacity={0.28}/><stop offset="100%" stopColor="#46756C" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} /><Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, direction: "rtl" }} /><Area type="monotone" dataKey="current" stroke="#46756C" strokeWidth={2.5} fill="url(#tealFill)" />{compare && <Area type="monotone" dataKey="previous" stroke="#CFA47A" strokeDasharray="5 5" fill="transparent" />}</AreaChart></ResponsiveContainer>;
}

export function VolumeChart({ data, stacked = false }: { data: ChartPoint[]; stacked?: boolean }) {
  return <ResponsiveContainer width="100%" height={250}><BarChart data={data} margin={{ top: 12, right: 0, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} /><Tooltip cursor={{ fill: "var(--surface-muted)" }} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, direction: "rtl" }} /><Bar dataKey="current" stackId={stacked ? "a" : undefined} fill="#46756C" radius={[5, 5, 0, 0]} /><Bar dataKey="secondary" stackId={stacked ? "a" : undefined} fill="#CFA47A" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer>;
}

export function DonutChart({ data }: { data: { name: string; value: number }[] }) {
  return <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={3}>{data.map((item, index) => <Cell key={item.name} fill={colors[index % colors.length]} />)}</Pie><Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, direction: "rtl" }} /></PieChart></ResponsiveContainer>;
}
