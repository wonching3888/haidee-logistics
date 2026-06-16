"use client";

import { useState, type CSSProperties } from "react";
import { PNL_ROUTE_FILTERS } from "@/lib/pnl-report-types";

interface Props {
  drivers?: string[];
  onSearch: (params: {
    year: number;
    month: number;
    route: string;
    driver: string;
    date: string;
  }) => void;
}

const rowStyle: CSSProperties = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
  alignItems: "center",
  marginBottom: "12px",
};

const labelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "4px",
  fontSize: "14px",
};

export default function TripPnlFilter({ drivers = [], onSearch }: Props) {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [route, setRoute] = useState("ALL");
  const [driver, setDriver] = useState("ALL");
  const [date, setDate] = useState("");

  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={rowStyle}>
        <label style={labelStyle}>
          年份 Year
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{ marginLeft: "4px" }}
          >
            {[2024, 2025, 2026].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          月份 Month
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            style={{ marginLeft: "4px" }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          路线 Route
          <select
            value={route}
            onChange={(e) => setRoute(e.target.value)}
            style={{ marginLeft: "4px" }}
          >
            {PNL_ROUTE_FILTERS.map((r) => (
              <option key={r} value={r}>
                {r === "ALL" ? "全部 All" : r}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          司机 Driver
          <select
            value={driver}
            onChange={(e) => setDriver(e.target.value)}
            style={{ marginLeft: "4px" }}
          >
            <option value="ALL">全部 All</option>
            {drivers.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div style={rowStyle}>
        <label style={labelStyle}>
          日期 Date（可选）
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ marginLeft: "4px" }}
          />
        </label>
        <button type="button" onClick={() => setDate("")}>
          清空日期
        </button>
      </div>
      <button
        type="button"
        onClick={() => onSearch({ year, month, route, driver, date })}
        style={{
          backgroundColor: "#2563eb",
          color: "white",
          padding: "10px 32px",
          borderRadius: "8px",
          border: "none",
          cursor: "pointer",
          fontSize: "15px",
          fontWeight: "600",
          display: "block",
          marginTop: "16px",
        }}
      >
        查询 Search
      </button>
    </div>
  );
}
