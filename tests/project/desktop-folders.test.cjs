const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const window = {};
vm.runInNewContext(fs.readFileSync("dist/desktop/desktop-folders.js", "utf8"), { window });

function backend() {
  let saved = [];
  let selected = true;
  let failure = false;
  let counter = 0;
  const calls = [];
  return {
    calls,
    cancel() { selected = false; },
    fail(value) { failure = value; },
    unavailable() { saved.forEach((folder) => { folder.state = "unavailable"; }); },
    options: {
      listFolders: async () => {
        if (failure) throw new Error("registry denied");
        return saved.map((folder) => ({ ...folder }));
      },
      authorizeFolders: async (category) => {
        calls.push(["authorize", category]);
        if (failure) throw new Error("save denied");
        if (!selected) return null;
        if (saved.some((folder) => folder.category === category)) return 0;
        saved.push({ id: "id-" + ++counter, category, path: "C:\\SteamLibrary", state: "available" });
        return 1;
      },
      revokeFolder: async (id) => {
        if (failure) throw new Error("revoke denied");
        calls.push(["revoke", id]);
        saved = saved.filter((folder) => folder.id !== id);
      },
      discoverSteam: async (id) => {
        calls.push(["discover", id]);
        return { source: "Steam", state: "complete", games: [], errors: [] };
      },
    },
  };
}

test("native registry persists across owners, separates categories and revokes by ID", async () => {
  const native = backend();
  const owner = window.DesktopFolders.create(native.options);
  assert.equal((await owner.add("music")).added, 1);
  assert.equal((await owner.add("games")).added, 1);
  assert.equal((await owner.add("games")).added, 0);
  const restarted = window.DesktopFolders.create(native.options);
  await restarted.refresh();
  assert.equal(restarted.getState().music.length, 1);
  const id = restarted.getState().games[0].id;
  await restarted.discover(id);
  assert.deepEqual(native.calls.at(-1), ["discover", id]);
  await assert.rejects(restarted.discover("C:\\arbitrary"), /não autorizada/);
  await assert.rejects(restarted.discover(restarted.getState().music[0].id), /não autorizada/);
  await restarted.remove("games", id);
  await assert.rejects(restarted.discover(id), /não autorizada/);
  await owner.refresh();
  assert.equal(owner.getState().games.length, 0);
  assert.equal(owner.getState().music.length, 1);
});

test("cancel, errors and unavailable roots preserve native references", async () => {
  const native = backend();
  const owner = window.DesktopFolders.create(native.options);
  await owner.add("games");
  const id = owner.getState().games[0].id;
  native.unavailable();
  await owner.refresh();
  assert.equal(owner.getState().games[0].state, "unavailable");
  native.cancel();
  assert.equal((await owner.add("games")).cancelled, true);
  native.fail(true);
  await assert.rejects(owner.add("games"), /save denied/);
  await assert.rejects(owner.remove("games", id), /revoke denied/);
  await assert.rejects(owner.refresh(), /registry denied/);
  assert.equal(owner.getState().games[0].id, id);
  native.fail(false);
  await owner.refresh();
  assert.equal(owner.getState().error, "");
  await owner.remove("games", id);
});

test("frontend storage never authorizes or persists a grant", async () => {
  const native = backend();
  const owner = window.DesktopFolders.create({ ...native.options, storage: { getItem() { throw new Error("must not read localStorage"); } } });
  await owner.refresh();
  assert.equal(owner.getState().games.length, 0);
  await assert.rejects(owner.discover("fake-id"), /não autorizada/);
  assert.equal(native.calls.length, 0);
});
