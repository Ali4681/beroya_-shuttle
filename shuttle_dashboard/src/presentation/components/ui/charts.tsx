"use client";

import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PALETTE = ["#1aa8b4", "#7367f0", "#ff9f43", "#28c76f", "#ea5455", "#00bad1"];

export function DistributionBars({ data }: { data: { label: string; count: number }[] }) {
  const t = useTranslations("Common");
  if (data.length === 0) return null;
  return (
    <div className="h-[220px] w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#8a8f9c33" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#8a8f9c", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: "#a8a5b1", fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "#22e0ee14" }}
            contentStyle={{
              background: "var(--surface-elevated)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              boxShadow: "var(--shadow-lg)",
              padding: "8px 12px",
            }}
            labelStyle={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 13, marginBottom: 2 }}
            itemStyle={{ color: "var(--text-secondary)", fontSize: 13, padding: 0 }}
          />
          <Bar dataKey="count" name={t("count")} radius={[6, 6, 0, 0]} maxBarSize={48}>
            {data.map((entry, index) => (
              <Cell key={entry.label} fill={PALETTE[index % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
