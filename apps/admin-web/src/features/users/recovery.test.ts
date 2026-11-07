import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { mockServer } from "@/mocks/server";
import { usersRepository } from "./repository";
import { adminUserListItemSchema } from "./contracts";

describe("live customer projections", () => {
  afterEach(() => { delete process.env.NEXT_PUBLIC_ENABLE_MOCKS; });
  it("preserves unavailable historical session counts in the live contract", async () => {
    process.env.NEXT_PUBLIC_ENABLE_MOCKS="false";
    mockServer.use(http.get('/api/v1/admin/users/user_liveCustomer/sessions',()=>HttpResponse.json({
      items:[],activeCount:0,expiredCount:null,revokedCount:null,region:{availability:'empty',message:'Active sessions only'},
    })));
    await expect(usersRepository.getSessions({userId:'user_liveCustomer'})).resolves.toMatchObject({activeCount:0,expiredCount:null,revokedCount:null});
  });
  it("fetches a bounded live customer directory without simulated authority", async () => {
    process.env.NEXT_PUBLIC_ENABLE_MOCKS = "false";
    let params: URLSearchParams | undefined;
    mockServer.use(http.get('/api/v1/admin/users', ({request}) => {
      params = new URL(request.url).searchParams;
      return HttpResponse.json({items:[],pagination:{page:2,pageSize:25,totalItems:0,totalPages:0},uniqueCustomersTotal:0,iosCustomers:0,androidCustomers:0,multiPlatformCustomers:0,region:{availability:'empty'}});
    }));
    await expect(usersRepository.getUsers({page:2,query:'customer',role:'super-admin'})).resolves.toHaveProperty('items',[]);
    expect(params?.get('page')).toBe('2');
    expect(params?.get('role')).toBeNull();
  });
  it.each(["EG", null])("accepts a customer without devices and unknown diagnostics (%s)", (country) => {
    const result = adminUserListItemSchema.safeParse({
      id: "user_liveCustomer", displayName: "Customer", maskedEmail: "c***@gmail.com",
      country, language: "ar", primaryPlatform: null, registeredPlatforms: [],
      iosDeviceCount: 0, androidDeviceCount: 0, totalDeviceCount: 0,
      plan: "Free", status: "deletion_pending", verification: "unknown",
      registeredAt: "2026-10-23T00:00:00Z", lastActiveAt: null, risk: "unknown",
    });
    expect(result.success).toBe(true);
  });
});
