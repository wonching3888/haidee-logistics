"use client";

import { useState } from "react";

interface Props {
  onSearch: (params: {
    year: number;
    month: number;
    route: string;
    driver: string;
    date: string;
  }) => void;
}

export default function TripPnlFilter({ onSearch }: Props) {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [route, setRoute] = useState("");
  const [driver, setDriver] = useState("");
  const [date, setDate] = useState("");

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "8px",
        }}
      >
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[2024, 2025, 2026].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button onClick={() => setDate("")}>清空日期</button>
      </div>
      <button
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
          marginTop: "8px",
        }}
      >
        查询 Search
      </button>
    </div>
  );
}
