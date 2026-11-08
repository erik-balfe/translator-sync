import { describe, expect, test } from "bun:test";
import {
  buildPluralInstruction,
  groupPluralKeys,
  hasIcuPlural,
  missingCategories,
  normaliseLanguage,
  pluralCategoriesFor,
  sortCategories,
  splitPluralKey,
} from "../../../src/utils/plural";

describe("splitPluralKey", () => {
  test("splits an i18next plural key", () => {
    expect(splitPluralKey("cart.items_one")).toEqual({ base: "cart.items", category: "one" });
    expect(splitPluralKey("files_few")).toEqual({ base: "files", category: "few" });
  });

  test("leaves ordinary keys alone", () => {
    expect(splitPluralKey("cart.items")).toBeNull();
    expect(splitPluralKey("some_other_name")).toBeNull();
    expect(splitPluralKey("key_ones")).toBeNull();
  });
});

describe("groupPluralKeys", () => {
  test("groups siblings and drops lone categories", () => {
    const groups = groupPluralKeys([
      "items_one",
      "items_other",
      "items_few",
      "lone_one",
      "plain",
    ]);

    expect(groups.size).toBe(1);
    expect([...(groups.get("items")?.keys() ?? [])]).toEqual(["one", "other", "few"]);
    expect(groups.has("lone")).toBe(false);
  });
});

describe("ICU detection", () => {
  test("recognises a plural block", () => {
    expect(hasIcuPlural("{count, plural, one {# item} other {# items}}")).toBe(true);
    expect(hasIcuPlural("{count, plural,one{a}other{b}}")).toBe(true);
  });

  test("ignores plain interpolation and select", () => {
    expect(hasIcuPlural("Hello {name}")).toBe(false);
    expect(hasIcuPlural("{gender, select, male {he} other {they}}")).toBe(false);
  });
});

describe("CLDR categories", () => {
  test("knows the languages this project actually ships", () => {
    expect(pluralCategoriesFor("en")).toEqual(["one", "other"]);
    expect(pluralCategoriesFor("ru")).toEqual(["one", "few", "many", "other"]);
    expect(pluralCategoriesFor("ja")).toEqual(["other"]);
    expect(pluralCategoriesFor("ar")).toEqual(["zero", "one", "two", "few", "many", "other"]);
  });

  test("normalises locale tags and falls back safely", () => {
    expect(normaliseLanguage("ru-RU")).toBe("ru");
    expect(normaliseLanguage("pt_BR")).toBe("pt");
    expect(pluralCategoriesFor("xx-YY")).toEqual(["other"]);
  });
});

describe("missingCategories", () => {
  test("flags forms a source language never needed", () => {
    // English source has one/other; Russian needs few and many as well.
    expect(missingCategories("ru", ["one", "other"])).toEqual(["few", "many"]);
    expect(missingCategories("ja", ["one", "other"])).toEqual([]);
    expect(missingCategories("en", ["one", "other"])).toEqual([]);
  });
});

describe("buildPluralInstruction", () => {
  test("names the target categories and the key convention", () => {
    const text = buildPluralInstruction("Russian", false);
    expect(text).toContain("one, few, many, other");
    expect(text).toContain("_zero/_one/_two/_few/_many/_other");
    expect(text).not.toContain("ICU");
  });

  test("adds ICU guidance only when needed", () => {
    const text = buildPluralInstruction("ru", true);
    expect(text).toContain("ICU syntax");
    expect(text).toContain("EXACTLY");
  });
});

describe("sortCategories", () => {
  test("orders by CLDR, not alphabetically", () => {
    expect(sortCategories(["other", "one", "many", "few"])).toEqual([
      "one",
      "few",
      "many",
      "other",
    ]);
  });
});
