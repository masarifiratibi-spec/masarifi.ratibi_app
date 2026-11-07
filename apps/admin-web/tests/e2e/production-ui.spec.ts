import { expect, test } from "@playwright/test";

test("queue cards fit supported long job labels in both directions and themes", async ({ page }, testInfo) => {
  await page.goto("/admin/jobs/queues");
  const cards = page.locator("[data-queue-card]");
  const viewportWidth = page.viewportSize()!.width;
  await expect(cards.first()).toBeVisible();
  // A synthetic public registry label at the supported 128-character boundary.
  // Keep the real QueueCard markup, metrics and status badge for the reflow check.
  const longLabel = "assistant.reconcile_" + "x".repeat(108);
  const heading = cards.first().locator("h2");
  await heading.evaluate((element, label) => { element.textContent = label; }, longLabel);
  for (const locale of ["ar", "en"] as const) {
    if (await page.locator("html").getAttribute("lang") !== locale) {
      await page.getByRole("button", { name: "تغيير اللغة", exact: true }).click();
    }
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    for (const theme of ["light", "dark"] as const) {
      if (await page.locator("html").getAttribute("data-theme") !== theme) {
        await page.getByRole("button", { name: locale === "ar" ? "تبديل المظهر" : "Toggle theme", exact: true }).click();
      }
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(heading).toHaveText(longLabel);
      expect(await heading.evaluate(element => {
        const range = document.createRange(); range.selectNodeContents(element);
        const box = element.getBoundingClientRect();
        return Array.from(range.getClientRects()).every(line => line.left >= box.left - 1 && line.right <= box.right + 1);
      })).toBe(true);
      expect(await page.evaluate(width => document.documentElement.scrollWidth <= width + 1, viewportWidth)).toBe(true);
      expect(await cards.evaluateAll((elements, width) => elements.every(element => {
        const box = element.getBoundingClientRect();
        return box.left >= -1 && box.right <= width + 1;
      }), viewportWidth)).toBe(true);
      expect(await cards.locator(".card-heading").evaluateAll(elements => elements.every(element => {
        const card = element.closest("article")!.getBoundingClientRect();
        return Array.from(element.children).every(child => {
          const box = child.getBoundingClientRect();
          return box.left >= card.left && box.right <= card.right;
        });
      }))).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`queue-reflow-${locale}-${theme}.png`) });
    }
  }
});

test("overview chart ticks remain inside their SVG viewport", async ({ page }) => {
  await page.goto("/admin");
  for (const title of ["نمو المستخدمين", "حجم الاستيراد"]) {
  const chart = page.locator(".chart-card").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  const ticks = chart.locator("svg text").filter({ hasText: /^\d{5,6}$/ });
  await expect(ticks.first()).toBeVisible();
  expect(await ticks.count()).toBeGreaterThan(0);
  const clipped = await ticks.evaluateAll(elements => elements
    .filter(element => /^\d{5,6}$/.test(element.textContent ?? ""))
    .filter(element => {
      const box = element.getBoundingClientRect();
      const svg = element.closest("svg")!.getBoundingClientRect();
      return box.left < svg.left - 1 || box.right > svg.right + 1;
    }).map(element => element.textContent));
  expect(clipped).toEqual([]);
  }
});

test("dark attention text has readable contrast", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: "تبديل المظهر" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".attention-card h2")).toBeVisible();
  const ratios = await page.locator(".attention-card h2, .attention-card .card-heading p, .attention-card h3, .attention-item p, .attention-meta").evaluateAll(elements => {
    const rgba = (color: string) => color.match(/[\d.]+/g)!.map(Number);
    const luminance = (color: string) => {
      const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
      return rgb.map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
        .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    };
    return elements.map(element => {
      const foreground = rgba(getComputedStyle(element).color);
      const background = getComputedStyle(element.closest(".attention-card")!).backgroundColor;
      const backgroundChannels = rgba(background);
      const alpha = foreground[3] ?? 1;
      const composited = foreground.slice(0, 3).map((channel, index) => alpha * channel + (1 - alpha) * backgroundChannels[index]);
      const values = [luminance(`rgb(${composited.join(",")})`), luminance(background)].sort((a, b) => b - a);
      return (values[0] + 0.05) / (values[1] + 0.05);
    });
  });
  for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test("English overview copy and units follow the requested locale", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: "تغيير اللغة" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(".metric-card").first()).toContainText("Compared with the previous period");
  await expect(page.locator(".metric-card").filter({ hasText: "Monthly recurring revenue" })).toContainText("SAR");
  await expect(page.locator(".metric-card, .chart-card .legend, .chart-card .sr-only").filter({ hasText: /[\u0600-\u06ff]/ })).toHaveCount(0);
  await expect(page.getByText("Customers · current period versus previous", { exact: true })).toBeVisible();
});
