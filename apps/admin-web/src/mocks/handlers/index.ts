import type { RequestHandler } from "msw";
import { attentionHandlers } from "./attention";
import { navigationHandlers } from "./navigation";
import { platformOptionHandlers } from "./platform-options";
import { searchHandlers } from "./search";
import { sessionHandlers } from "./session";
import { overviewHandlers } from "./overview";
import { usersHandlers } from "./users";
import { importsHandlers } from "./imports";
import { systemHealthHandlers } from "./system-health";
import { accessHandlers } from "./access";
import { billingHandlers } from "./billing";
import { aiHandlers } from "./ai";
import { communicationsHandlers } from "./communications";
import { securityHandlers } from "./security";
import { governanceHandlers } from "./governance";

export const handlers: RequestHandler[] = [
  ...sessionHandlers,
  ...platformOptionHandlers,
  ...navigationHandlers,
  ...attentionHandlers,
  ...searchHandlers,
  ...overviewHandlers,
  ...usersHandlers,
  ...importsHandlers,
  ...systemHealthHandlers,
  ...accessHandlers,
  ...billingHandlers,
  ...aiHandlers,
  ...communicationsHandlers,
  ...securityHandlers,
  ...governanceHandlers,
];

export function overrideHandlers(...overrides: RequestHandler[]): RequestHandler[] {
  return [...overrides, ...handlers];
}
