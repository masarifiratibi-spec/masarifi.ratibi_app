import { describe, expect, test, beforeEach, vi } from "vitest";
import { CommunicationsRepository } from "./repository";

describe("Communications Repository", () => {
  let repository: CommunicationsRepository;

  beforeEach(() => {
    repository = new CommunicationsRepository();
    vi.clearAllMocks();
  });

  describe("query-key structure", () => {
    test("generates deterministic query keys for support tickets", () => {
      const key1 = repository.getSupportTicketsQueryKey({
        page: 1,
        pageSize: "25",
        status: "open",
      });
      const key2 = repository.getSupportTicketsQueryKey({
        page: 1,
        pageSize: "25",
        status: "open",
      });

      expect(key1).toEqual(key2);
      expect(key1).toEqual(["phase6-communications", "support-tickets", { page: 1, pageSize: "25", status: "open" }]);
    });

    test("generates different keys for different filter values", () => {
      const key1 = repository.getSupportTicketsQueryKey({
        page: 1,
        pageSize: "25",
        status: "open",
      });
      const key2 = repository.getSupportTicketsQueryKey({
        page: 2,
        pageSize: "50",
        status: "resolved",
      });

      expect(key1).not.toEqual(key2);
    });
  });

  describe("URL encoding", () => {
    test("properly encodes special characters in search queries", () => {
      const searchQuery = "test search & special=chars";
      const encoded = repository.encodeSearchParams({ search: searchQuery });
      
      expect(encoded).toContain("search=");
      expect(encoded).toContain("special");
      expect(encoded).not.toContain("&special=");
    });

    test("handles Arabic text encoding", () => {
      const arabicText = "بحث باللغة العربية";
      const encoded = repository.encodeSearchParams({ search: arabicText });
      
      expect(encoded).toContain("search=");
      expect(encoded).toContain("%D8%A8"); // Arabic character encoding
    });
  });

  describe("strict response parsing", () => {
    test("accepts valid response structure", async () => {
      const validResponse = {
        id: "TKT-1001",
        subject: "Test ticket",
        status: "open",
        priority: "medium",
        version: 1,
        createdAt: "2026-07-29T12:00:00+03:00",
        updatedAt: "2026-07-29T12:00:00+03:00",
      };

      await expect(
        repository.validateResponse(validResponse, "supportTicket")
      ).resolves.toBeDefined();
    });
  });

  describe("safe error parsing", () => {
    test("parses API errors without exposing sensitive data", () => {
      const apiError = {
        status: 403,
        code: "FORBIDDEN",
        message: "Access denied",
        correlationId: "CORR-12345-ABCDEF",
      };

      const parsed = repository.parseApiError(apiError);
      
      expect(parsed).toEqual({
        status: "403",
        code: "FORBIDDEN",
        message: "Access denied",
        correlationId: "CORR-12345-ABCDEF",
      });
    });

    test("handles errors with field-level validation", () => {
      const validationError = {
        status: 422,
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        correlationId: "CORR-12345-ABCDEF",
        fieldErrors: {
          subject: ["Subject is required"],
          priority: ["Invalid priority value"],
        },
      };

      const parsed = repository.parseApiError(validationError);
      
      expect(parsed.fieldErrors).toBeDefined();
      expect(parsed.fieldErrors?.subject).toEqual(["Subject is required"]);
    });

    test("sanitizes error messages to prevent information leakage", () => {
      const unsafeError = {
        status: 500,
        code: "INTERNAL_ERROR",
        message: "Database connection failed: postgresql://user:pass@localhost/db",
        correlationId: "CORR-12345-ABCDEF",
      };

      const parsed = repository.parseApiError(unsafeError);
      
      expect(parsed.message).not.toContain("postgresql://");
      expect(parsed.message).not.toContain("user:pass");
    });
  });

  describe("targeted invalidation", () => {
    test("invalidates specific query keys after mutations", () => {
      const queryClient = {
        invalidateQueries: vi.fn(),
      };

      repository.invalidateSupportTicketList(queryClient);
      
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["phase6-communications", "support-tickets"],
      });
    });

    test("invalidates detail views when specific ticket is modified", () => {
      const queryClient = {
        invalidateQueries: vi.fn(),
      };

      repository.invalidateSupportTicketDetail(queryClient, "TKT-1001");
      
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["phase6-communications", "support-tickets", "TKT-1001"],
      });
    });
  });

  describe("no direct fixture access", () => {
    test("does not expose fixture data directly", () => {
      // Repository should not have direct access to fixtures
      expect(repository).not.toHaveProperty("fixtures");
      expect(repository).not.toHaveProperty("mockData");
    });

    test("fetches data through API client only", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);

      await repository.getSupportTickets({ page: 1, pageSize: "25" });
      
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/admin/support/tickets"),
        expect.any(Object)
      );

      fetchSpy.mockRestore();
    });
  });

  describe("API request construction", () => {
    test("constructs GET requests with correct headers", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);

      await repository.getSupportTickets({ page: 1, pageSize: "25" });
      
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/v1/admin/support/tickets?page=1&pageSize=25",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );

      fetchSpy.mockRestore();
    });

    test("constructs POST requests with proper body", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      await repository.actOnSupportTicket("TKT-1001", {
        action: "assign",
        expectedVersion: 1,
        assignTo: "AGENT-001",
      });
      
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/v1/admin/support/tickets/TKT-1001/actions",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("assignTo"),
        })
      );

      fetchSpy.mockRestore();
    });
  });
});
