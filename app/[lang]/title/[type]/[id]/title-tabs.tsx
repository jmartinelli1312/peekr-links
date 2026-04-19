"use client";

import { useState } from "react";

type TabKey = "overview" | "cast" | "crew" | "platforms" | "awards" | "comments";

interface TitleTabsProps {
  tabs: { key: TabKey; label: string; available: boolean }[];
  children: React.ReactNode;
  defaultTab?: TabKey;
}

export default function TitleTabs({ tabs, children, defaultTab = "overview" }: TitleTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);

  return (
    <>
      <div className="bubble-tabs">
        {tabs
          .filter((t) => t.available)
          .map((t) => (
            <button
              key={t.key}
              type="button"
              className={`tab-pill ${activeTab === t.key ? "active" : ""}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
      </div>

      {/* All tab panels are rendered in HTML for SEO, CSS toggles visibility */}
      <div>
        {Array.isArray(children)
          ? (children as React.ReactElement[]).map((child, i) => {
              const tab = tabs.filter((t) => t.available)[i];
              if (!tab) return null;
              return (
                <div
                  key={tab.key}
                  style={{ display: activeTab === tab.key ? "block" : "none" }}
                >
                  {child}
                </div>
              );
            })
          : children}
      </div>
    </>
  );
}
