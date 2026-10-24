import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import {
  CurrentPermissionsProvider,
  useCurrentPermission,
} from "./current-permissions";

function Probe() {
  const can = useCurrentPermission("super-admin");
  return (
    <div>
      {can("users.read") && <span>Customer list</span>}
      {can("users.status.manage") && <span>Suspend customer</span>}
      {can("audit.logs.read") && <span>Audit logs</span>}
    </div>
  );
}

test("uses exact server permissions even when a simulated role would allow more", () => {
  const html = renderToStaticMarkup(
    <CurrentPermissionsProvider
      permissions={new Set(["users.read", "audit.read"])}
    >
      <Probe />
    </CurrentPermissionsProvider>,
  );
  expect(html).toContain("Customer list");
  expect(html).toContain("Audit logs");
  expect(html).not.toContain("Suspend customer");
  expect(
    renderToStaticMarkup(
      <CurrentPermissionsProvider permissions={new Set()}>
        <Probe />
      </CurrentPermissionsProvider>,
    ),
  ).not.toContain("Customer list");
});
