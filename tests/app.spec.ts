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

test("初期サンプルと案内が表の確認をこのアプリ内で完結させる", async ({ page }) => {
  await page.goto(APP_URL);
  const preview = page.locator("#preview");
  await expect(preview.locator("table")).toHaveCount(1);
  await expect(preview.locator("thead tr th")).toHaveCount(2);
  await expect(preview.locator("tbody tr")).toHaveCount(2);
  await expect(page.locator("#how-to")).toContainText("コードブロック・表");
  await expect(page.locator("#faq dd").nth(2)).toContainText("表");
});

test("GFM表: 見出し・区切り・本文2行が table/thead/tbody になりセル内の太字とコードも描画される", async ({ page }) => {
  await page.goto(APP_URL);
  const markdown = [
    "| 項目 | 値 |",
    "| --- | --- |",
    "| **A** | `1` |",
    "| B | 2 |",
  ].join("\n");

  await page.locator("#editor").fill(markdown);

  const preview = page.locator("#preview");
  await expect(preview.locator("table")).toHaveCount(1);
  await expect(preview.locator("thead tr th")).toHaveCount(2);
  await expect(preview.locator("tbody tr")).toHaveCount(2);
  await expect(preview).not.toContainText("---");
  await expect(preview.locator("tbody tr").nth(0).locator("strong")).toHaveText("A");
  await expect(preview.locator("tbody tr").nth(0).locator("code")).toHaveText("1");
});

test("GFM表: 列揃えクラスを付け、列不足は空tdで補い列超過は描画せずセル本文を属性に入れない", async ({ page }) => {
  await page.goto(APP_URL);
  const markdown = [
    "| left | center | right |",
    "| :--- | :---: | ---: |",
    "| a | b |",
    "| w | x | y | z |",
  ].join("\n");

  await page.locator("#editor").fill(markdown);

  const preview = page.locator("#preview");
  const headerCells = preview.locator("thead th");
  await expect(headerCells).toHaveCount(3);
  await expect(headerCells.nth(0)).toHaveClass("table-align-left");
  await expect(headerCells.nth(1)).toHaveClass("table-align-center");
  await expect(headerCells.nth(2)).toHaveClass("table-align-right");

  const firstBody = preview.locator("tbody tr").nth(0).locator("td");
  await expect(firstBody).toHaveCount(3);
  await expect(firstBody.nth(0)).toHaveClass("table-align-left");
  await expect(firstBody.nth(1)).toHaveClass("table-align-center");
  await expect(firstBody.nth(2)).toHaveClass("table-align-right");
  await expect(firstBody.nth(2)).toHaveText("");

  const secondBody = preview.locator("tbody tr").nth(1).locator("td");
  await expect(secondBody).toHaveCount(3);
  await expect(secondBody.nth(0)).toHaveClass("table-align-left");
  await expect(secondBody.nth(1)).toHaveClass("table-align-center");
  await expect(secondBody.nth(2)).toHaveClass("table-align-right");
  await expect(preview.locator("tbody tr").nth(1)).not.toContainText("z");

  const attrLeak = await preview.locator("th, td").evaluateAll((cells) =>
    cells.some((el) =>
      [...el.attributes].some((attr) => attr.name !== "class" || el.textContent === attr.value),
    ),
  );
  expect(attrLeak).toBe(false);
});

test("縦棒行・フェンス内の表・セル内HTMLは表やscriptにならない", async ({ page }) => {
  await page.goto(APP_URL);

  await page.locator("#editor").fill("| これは表ではない |");
  const preview = page.locator("#preview");
  await expect(preview.locator("table")).toHaveCount(0);
  await expect(preview.locator("p")).toContainText("これは表ではない");

  const fenced = ["```", "| a | b |", "| --- | --- |", "| c | d |", "```"].join("\n");
  await page.locator("#editor").fill(fenced);
  await expect(preview.locator("table")).toHaveCount(0);
  await expect(preview.locator("pre > code")).toContainText("| a | b |");
  await expect(preview.locator("pre > code")).toContainText("| --- | --- |");

  const xss = [
    "| 項目 | 値 |",
    "| --- | --- |",
    "| x | <script>alert(1)</script> |",
  ].join("\n");
  await page.locator("#editor").fill(xss);
  await expect(preview.locator("table")).toHaveCount(1);
  await expect(preview.locator("script")).toHaveCount(0);
  await expect(preview.locator("tbody td").nth(1)).toHaveText("<script>alert(1)</script>");
});
