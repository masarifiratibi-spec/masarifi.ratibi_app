"use client";

import Link from "next/link";
import {
  Activity,
  ChevronDown,
  CircleDollarSign,
  Database,
  FileInput,
  HeartPulse,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { getNavigationLabel } from "@/core/localization/display-labels";
import { useLocale } from "@/core/localization/provider";
import type { SidebarNavigationAccordionNode, SidebarNavigationNode } from "./shell-state";
import { flattenSidebarNodes, strongestActiveRoute } from "./shell-state";

const icons: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "heart-pulse": HeartPulse,
  activity: Activity,
  users: Users,
  "circle-dollar-sign": CircleDollarSign,
  "file-input": FileInput,
  database: Database,
  "shield-check": ShieldCheck,
  settings: Settings,
};

function SidebarIcon({ iconKey }: { iconKey: string }) {
  const Icon = icons[iconKey] ?? Activity;
  return <Icon size={18} />;
}

function SidebarLeaf({
  node,
  activeRoute,
  compact,
  close,
}: {
  node: ReturnType<typeof flattenSidebarNodes>[number];
  activeRoute?: string;
  compact: boolean;
  close?: () => void;
}) {
  const { item } = node;
  const { locale } = useLocale();
  const label = getNavigationLabel(locale, item.id, item.labelKey);
  const active = Boolean(item.route && activeRoute === item.route);
  if (item.availability !== "active" || !item.route) {
    return (
      <div
        aria-disabled="true"
        className="nav-item nav-disabled"
        title={compact ? `${item.labelKey} — ${item.availability === "denied" ? "غير مصرح" : "قريباً"}` : undefined}
      >
        <SidebarIcon iconKey={item.iconKey} />
        <span>{label}</span>
        {!compact && <small>{item.availability === "denied" ? "غير مصرح" : "قريباً"}</small>}
      </div>
    );
  }
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`nav-item ${active ? "active" : ""}`}
      href={item.route}
      onClick={close}
      title={compact ? label : undefined}
    >
      <SidebarIcon iconKey={item.iconKey} />
      <span>{label}</span>
    </Link>
  );
}

function SidebarAccordion({
  node,
  pathname,
  activeRoute,
  compact,
  close,
  open: controlledOpen,
  onOpenChange,
}: {
  node: SidebarNavigationAccordionNode;
  pathname: string;
  activeRoute?: string;
  compact: boolean;
  close?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const panelId = useId();
  const { locale } = useLocale();
  const activeChild = node.items.find((item) => item.kind === "accordion" && item.defaultOpen)?.id;
  const [open, setOpen] = useState(node.defaultOpen);
  const [openChild, setOpenChild] = useState<string | undefined>(activeChild);
  const expanded = controlledOpen ?? open;
  const label = getNavigationLabel(locale, node.id, node.labelKey);

  const toggle = () => {
    const next = !expanded;
    setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div className={`nav-accordion nav-accordion-level-${node.items.some((item) => item.kind === "accordion") ? "parent" : "leaf"}`}>
      <button
        aria-controls={panelId}
        aria-expanded={expanded}
        className={`nav-item nav-accordion-button ${node.active ? "nav-ancestor-active" : ""}`}
        onClick={toggle}
        type="button"
      >
        <SidebarIcon iconKey={node.iconKey} />
        <span>{label}</span>
        <ChevronDown aria-hidden="true" className="nav-arrow" size={16} />
      </button>
      {expanded && (
        <div className="nav-accordion-panel" id={panelId}>
          {node.items.map((item) => {
            if (item.kind === "item") {
              return <SidebarLeaf activeRoute={activeRoute} close={close} compact={compact} key={item.id} node={item} />;
            }
            const controlled = node.exclusiveChildren ? openChild === item.id : undefined;
            return (
              <SidebarAccordion
                activeRoute={activeRoute}
                close={close}
                compact={compact}
                key={item.id}
                node={item}
                onOpenChange={node.exclusiveChildren ? (nextOpen) => setOpenChild(nextOpen ? item.id : undefined) : undefined}
                open={controlled}
                pathname={pathname}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SidebarNavigationList({
  nodes,
  pathname,
  compact,
  close,
}: {
  nodes: SidebarNavigationNode[];
  pathname: string;
  compact: boolean;
  close?: () => void;
}) {
  const displayNodes = compact ? flattenSidebarNodes(nodes) : nodes;
  const activeRoute = strongestActiveRoute(pathname, nodes);
  return (
    <>
      {displayNodes.map((node) =>
        node.kind === "item"
          ? <SidebarLeaf activeRoute={activeRoute} close={close} compact={compact} key={node.id} node={node} />
          : <SidebarAccordion activeRoute={activeRoute} close={close} compact={compact} key={node.id} node={node} pathname={pathname} />,
      )}
    </>
  );
}
