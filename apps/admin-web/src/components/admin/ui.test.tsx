import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { RegionState } from "./ui";

describe("regional overview states", () => {
  test("renders loading, empty, warning, forbidden, and retryable errors independently", () => {
    expect(renderToStaticMarkup(<RegionState isPending isError={false}>content</RegionState>)).toContain("role=\"status\"");

    expect(
      renderToStaticMarkup(
        <RegionState
          isPending={false}
          isError={false}
          region={{ availability: "empty", retryable: false, message: "No rows for this period." }}
        >
          content
        </RegionState>,
      ),
    ).toContain("No rows for this period.");

    expect(
      renderToStaticMarkup(
        <RegionState
          isPending={false}
          isError={false}
          region={{ availability: "partial", retryable: true, message: "Partial data." }}
        >
          <strong>usable sibling content</strong>
        </RegionState>,
      ),
    ).toContain("usable sibling content");

    expect(
      renderToStaticMarkup(
        <RegionState
          isPending={false}
          isError
          error={{ code: "forbidden" }}
          onRetry={() => undefined}
        >
          content
        </RegionState>,
      ),
    ).toContain("attention.read");
  });

  test("accepts a caller-supplied permission label for forbidden regions", () => {
    const markup = renderToStaticMarkup(
      <RegionState
        isPending={false}
        isError
        error={{ code: "forbidden" }}
        permission="devices.read"
        onRetry={() => undefined}
      >
        content
      </RegionState>,
    );
    expect(markup).toContain("devices.read");
    expect(markup).not.toContain("attention.read");
  });

  test("renders forbidden availability with the supplied permission", () => {
    const markup = renderToStaticMarkup(
      <RegionState
        isPending={false}
        isError={false}
        region={{ availability: "forbidden" }}
        permission="sessions.read"
      >
        content
      </RegionState>,
    );
    expect(markup).toContain("sessions.read");
  });

  test("renders unavailable regions as an accessible alert without protected content", () => {
    const markup = renderToStaticMarkup(
      <RegionState
        isPending={false}
        isError={false}
        region={{ availability: "unavailable", message: "unsafe upstream detail" }}
        permission="devices.read"
      >
        <strong>protected device content</strong>
      </RegionState>,
    );

    expect(markup).toContain("role=\"alert\"");
    expect(markup).not.toContain("protected device content");
    expect(markup).not.toContain("unsafe upstream detail");
  });
});
