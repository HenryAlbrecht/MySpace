const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createServer } = require("../../server.cjs");

(async () => {
  const web = createServer();
  let browser;
  try {
    await new Promise((resolve) => web.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    const context = await browser.newContext();
    await context.route("https://**/*", (route) => route.abort());
    await context.addInitScript(() => {
      if (localStorage.getItem("myspace-extras-v1")) return;
      localStorage.setItem(
        "myspace-extras-v1",
        JSON.stringify({
          version: 1,
          items: [
            {
              id: "book",
              kind: "book",
              title: "Featured book",
              status: "planned",
              featured: true,
            },
          ],
          favorites: [
            { id: "one", name: "One", url: "" },
            { id: "two", name: "Two", url: "" },
          ],
          badges: [
            {
              id: "badge",
              name: "Badge",
              background: "#202b45",
              color: "#c0adff",
            },
          ],
          blocks: [{ id: "block", title: "Block", text: "Original text" }],
          photos: [],
          tracks: [],
          featuredVideo: {
            localId: "profile-video",
            fileName: "fixture.webm",
            title: "Local video",
          },
        }),
      );
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:" + web.address().port + "/#perfil", {
      waitUntil: "load",
    });
    await page.evaluate(() =>
      MediaStorage.put("profile-video", new Blob(["local fixture"], { type: "video/webm" })),
    );
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector("#featuredVideo video");
    assert.equal(await page.locator("#favorites .favorite-name").first().textContent(), "One");
    assert.equal(await page.locator("#badges .web-badge").textContent(), "Badge");
    assert.equal(await page.locator("#customBlocks .block-body").textContent(), "Original text");
    assert.equal(await page.locator("#featuredCollection strong").textContent(), "Featured book");
    const edit = (selector) =>
      page
        .locator(selector + " .mini-actions button")
        .filter({ hasText: "editar" })
        .first()
        .click();
    const save = async () => {
      await page.locator('#resourceEditor button[type="submit"]').click();
      await page.waitForFunction(() => !document.querySelector("#resourceEditor").open);
    };
    await page.getByRole("button", { name: "▧ APARÊNCIA", exact: true }).click();
    await page.getByRole("tab", { name: "// XMB", exact: true }).click();
    const gamePresentation = page.locator('#resourceEditor [name="xmbGamePresentation"]');
    const artworkBorder = page.locator('#resourceEditor [name="xmbArtworkBorder"]');
    const roundedArtwork = page.locator('#resourceEditor [name="xmbRoundedArtwork"]');
    assert.equal(await gamePresentation.inputValue(), "vertical");
    await gamePresentation.selectOption("pill");
    assert.equal(await artworkBorder.inputValue(), "on");
    await artworkBorder.selectOption("off");
    assert.equal(await roundedArtwork.inputValue(), "off");
    await roundedArtwork.selectOption("on");
    await save();
    assert.equal(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("myspace-extras-v1")).appearance.xmb.gamePresentation,
      ),
      "pill",
    );
    assert.equal(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("myspace-extras-v1")).appearance.xmb.artworkBorder,
      ),
      false,
    );
    assert.equal(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("myspace-extras-v1")).appearance.xmb.roundedArtwork,
      ),
      true,
    );
    await page.reload({ waitUntil: "load" });
    await page.getByRole("button", { name: "▧ APARÊNCIA", exact: true }).click();
    await page.getByRole("tab", { name: "// XMB", exact: true }).click();
    assert.equal(
      await page.locator('#resourceEditor [name="xmbGamePresentation"]').inputValue(),
      "pill",
    );
    assert.equal(await page.locator('#resourceEditor [name="xmbArtworkBorder"]').inputValue(), "off");
    assert.equal(await page.locator('#resourceEditor [name="xmbRoundedArtwork"]').inputValue(), "on");
    await page.locator('#resourceEditor button[type="button"]').filter({ hasText: /^fechar$/ }).click();
    await edit("#favorites");
    await page.locator('#resourceEditor [name="name"]').fill("Updated favorite");
    await save();
    await page.locator("#favorites .mini-actions button").filter({ hasText: "→" }).first().click();
    assert.equal(await page.locator("#favorites .favorite-name").first().textContent(), "Two");
    await edit("#badges");
    await page.locator('#resourceEditor [name="name"]').fill("Updated badge");
    await save();
    await edit("#customBlocks");
    await page.locator('#resourceEditor [name="title"]').fill("Updated block");
    await page.locator('#resourceEditor [name="text"]').fill("Updated text");
    await save();
    await page.locator("#featuredVideo .section-head button").click();
    await page.locator('#resourceEditor [name="title"]').fill("Updated local caption");
    await save();
    assert.equal(
      await page.locator("#featuredVideo .video-caption").textContent(),
      "Updated local caption",
    );
    await page.locator(".section-manager").click();
    await page.locator('[data-section-key="favorites"] input').uncheck();
    assert.equal(await page.locator("#favorites").isVisible(), false);
    await page.locator('[data-section-key="video"] .section-order-controls button').first().click();
    await page
      .locator("#resourceEditor button")
      .filter({ hasText: /^fechar$/ })
      .click();
    const stored = await page.evaluate(async () => ({
      extras: JSON.parse(localStorage.getItem("myspace-extras-v1")),
      video: await (await MediaStorage.get("profile-video")).text(),
      order: document.querySelector("#featuredVideo").style.order,
    }));
    assert.deepEqual(
      stored.extras.favorites.map((row) => row.name),
      ["Two", "Updated favorite"],
    );
    assert.equal(stored.extras.badges[0].name, "Updated badge");
    assert.equal(stored.extras.blocks[0].text, "Updated text");
    assert.equal(stored.extras.featuredVideo.localId, "profile-video");
    assert.equal(stored.video, "local fixture");
    assert.equal(stored.extras.visibility.favorites, false);
    assert.equal(stored.order, String(stored.extras.sectionOrder.main.indexOf("video")));
    await page.reload({ waitUntil: "load" });
    assert.equal(await page.locator("#favorites").isVisible(), false);
    assert.equal(await page.locator("#badges .web-badge").textContent(), "Updated badge");
    assert.equal(await page.locator("#customBlocks h3").textContent(), "Updated block");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: profile extras render/edit/reorder, visibility/order, featured collection, local-video caption/media retention and reload.",
    );
  } finally {
    await browser?.close();
    await new Promise((resolve) => web.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
