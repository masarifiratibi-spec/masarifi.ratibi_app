import { describe, expect, it } from "vitest";
import AuditPage from "@/app/admin/audit/[eventId]/page";
import DeletionPage from "@/app/admin/data-requests/deletions/[requestId]/page";
import ExportPage from "@/app/admin/data-requests/exports/[requestId]/page";
import IncidentPage from "@/app/admin/security/incidents/[incidentId]/page";
import { ErrorState } from "@/components/admin/ui";

const uuid = "00000000-0000-4000-8000-000000000001";
const cases = [
  { prefix: "AUD", open: (id: string) => AuditPage({ params: Promise.resolve({ eventId: id }) }) },
  { prefix: "DEL", open: (id: string) => DeletionPage({ params: Promise.resolve({ requestId: id }) }) },
  { prefix: "EXP", open: (id: string) => ExportPage({ params: Promise.resolve({ requestId: id }) }) },
  { prefix: "INC", open: (id: string) => IncidentPage({ params: Promise.resolve({ incidentId: id }) }) },
];

describe.each(cases)("$prefix detail links", ({ prefix, open }) => {
  it("opens a canonical server ID and the matching demo ID in the same view", async () => {
    const demo = await open(`${prefix}-1001`);
    const live = await open(uuid);
    expect(demo.type).not.toBe(ErrorState);
    expect(live.type).toBe(demo.type);
    expect(Object.values(live.props)).toContain(uuid);
  });

  it("rejects a different resource prefix or an unsafe path", async () => {
    for (const invalid of ["CUS-1001", "../other"]) expect((await open(invalid)).type).toBe(ErrorState);
  });
});
