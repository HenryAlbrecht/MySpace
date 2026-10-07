const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateItem, filterItems } = require("../dist/collection.js");
const base = {
  title: "Teste",
  kind: "game",
  status: "planned",
  progress: 0,
  total: 0,
  score: "",
};
test("Notas em branco ficam sem avaliação; zero é uma nota válida", () => {
  assert.equal(validateItem(base).score, null);
  assert.equal(validateItem({ ...base, score: "0" }).score, 0);
});
test("Progresso não ultrapassa o total e aceita total desconhecido", () => {
  assert.throws(() => validateItem({ ...base, progress: 13, total: 12 }));
  assert.equal(validateItem({ ...base, progress: 13, total: 0 }).progress, 13);
});
test("Rejeita valores negativos, infinitos e notas fora da escala", () => {
  for (const patch of [{ progress: -1 }, { total: Infinity }, { score: 11 }, { score: "texto" }])
    assert.throws(() => validateItem({ ...base, ...patch }));
});
test("Tipos de mídia e status são obrigatórios", () => {
  assert.throws(() => validateItem({ ...base, kind: "invalid" }));
  assert.throws(() => validateItem({ ...base, status: "invalid" }));
  assert.equal(validateItem({ ...base, kind: "manga", status: "active" }).kind, "manga");
});
test("Busca ignora acentos e combina categoria e status", () => {
  const items = [
    validateItem({ ...base, title: "Pokémon", kind: "game", status: "active" }),
    validateItem({
      ...base,
      title: "Pokémon",
      kind: "anime",
      status: "planned",
    }),
  ];
  assert.equal(filterItems(items, { query: "pokemon", kind: "game", status: "active" }).length, 1);
  assert.equal(filterItems(items, { query: "pokemon", kind: "manga" }).length, 0);
});
test("Ordenar por nota deixa itens sem avaliação no fim", () => {
  const items = [
    validateItem({ ...base, title: "A" }),
    validateItem({ ...base, title: "B", score: 0 }),
    validateItem({ ...base, title: "C", score: 9 }),
  ];
  assert.deepEqual(
    filterItems(items, { sort: "score" }).map((i) => i.title),
    ["C", "B", "A"],
  );
});
