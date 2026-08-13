import { test, expect } from "@playwright/test";
import { pathToFileURL } from "node:url";

// 静的アプリなのでサーバ不要。kojo の visualGate と同じ file:// 方式で開く
const APP_URL = pathToFileURL("public/index.html").href;

test("ページがロードできページエラーが出ない", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  await page.goto(APP_URL);
  await expect(page.locator("body")).toBeVisible();
  expect(errors).toEqual([]);
});

// このスモークは削除しないこと。機能テストは PLAN.md の受け入れ条件ごとに追記する

test("SEO基礎: meta description・JSON-LD WebApplication・使い方/FAQ がある", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  await page.goto(APP_URL);

  const description = page.locator('meta[name="description"]');
  await expect(description).toHaveAttribute("content", /.+/);

  const ldJson = await page.locator('script[type="application/ld+json"]').evaluateAll((nodes) =>
    nodes.map((n) => {
      try {
        return JSON.parse(n.textContent || "");
      } catch {
        return null;
      }
    }),
  );

  const nodes = ldJson.flatMap((parsed) => {
    if (parsed == null) return [];
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed["@graph"])) return parsed["@graph"];
    return [parsed];
  });

  const webApp = nodes.find((n) => {
    const t = n?.["@type"];
    return t === "WebApplication" || (Array.isArray(t) && t.includes("WebApplication"));
  });
  expect(webApp).toBeTruthy();
  expect(typeof webApp.name).toBe("string");
  expect(webApp.name.length).toBeGreaterThan(0);
  expect(typeof webApp.description).toBe("string");
  expect(webApp.description.length).toBeGreaterThan(0);
  expect(typeof webApp.url).toBe("string");
  expect(webApp.url.length).toBeGreaterThan(0);
  expect(typeof webApp.applicationCategory).toBe("string");
  expect(webApp.applicationCategory.length).toBeGreaterThan(0);
  expect(webApp.offers?.price).toBe("0");

  const howTo = page.locator("#how-to, [aria-labelledby='how-to-heading']").first();
  const faq = page.locator("#faq, [aria-labelledby='faq-heading']").first();
  await expect(howTo).toBeVisible();
  await expect(faq).toBeVisible();
  await expect(page.getByRole("heading", { name: "使い方" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "FAQ" })).toBeVisible();

  expect(errors).toEqual([]);
});
