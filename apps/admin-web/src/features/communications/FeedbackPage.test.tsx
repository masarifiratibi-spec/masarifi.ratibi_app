import { expect, test } from "vitest";
import FeedbackDetailPage from "@/app/admin/feedback/[feedbackId]/page";
import { ErrorState } from "@/components/admin/ui";
import { FeedbackDetailRoute } from "./CommunicationRoutes";

test("the actual feedback page admits the API UUID from its list link", async () => {
  const feedbackId = "11000000-0000-4000-8000-000000000091";
  const page = await FeedbackDetailPage({
    params: Promise.resolve({ feedbackId }),
  });
  expect(page.type).toBe(FeedbackDetailRoute);
  expect(page.props).toEqual({ feedbackId });
});

test("retains the existing fixture route format", async () => {
  const page = await FeedbackDetailPage({
    params: Promise.resolve({ feedbackId: "FDB-1001" }),
  });
  expect(page.type).toBe(FeedbackDetailRoute);
});

test.each([
  "../feedback",
  "%2Ffeedback",
  "not-an-id",
  "FDB-1001?admin=true",
  "11000000-0000-4000-8000-000000000091/other",
  "",
])(
  "the actual feedback page rejects unsafe or unsupported route identifier %s",
  async (feedbackId) => {
    const page = await FeedbackDetailPage({
      params: Promise.resolve({ feedbackId }),
    });
    expect(page.type).toBe(ErrorState);
  },
);
