import { describe, expect, test } from "vitest";
import { socialMediaLinksSchema } from "./social-media";

describe("social media account links", () => {
  const empty = { instagram: "", tiktok: "", snapchat: "" };
  test("accepts hidden accounts and profile links copied from each platform", () => {
    expect(socialMediaLinksSchema.parse(empty)).toEqual(empty);
    expect(
      socialMediaLinksSchema.parse({
        instagram: " https://www.instagram.com/masarifi/?igsh=abc ",
        tiktok: "https://www.tiktok.com/@masarifi",
        snapchat: "https://www.snapchat.com/add/masarifi",
      }).instagram,
    ).toBe("https://www.instagram.com/masarifi/?igsh=abc");
  });
  test.each([
    "javascript:alert(1)",
    "http://instagram.com/masarifi",
    "https://instagram.com.evil.test/masarifi",
    "https://instagram.com@evil.test/masarifi",
    "https://instagram.com/",
    "https://instagram.com:444/masarifi",
    "https://instagram.com/masarifi\\evil",
    "https://tiktok.com/@masarifi",
  ])("rejects unsafe or wrong-platform Instagram links: %s", (instagram) => {
    expect(
      socialMediaLinksSchema.safeParse({ ...empty, instagram }).success,
    ).toBe(false);
  });
});
