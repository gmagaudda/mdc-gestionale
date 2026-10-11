import { expect, it } from "vitest";
import { parseListQuery, listHref, escapeLike } from "./list";
it("bounds pages and whitelists sorting", () => {
  for (const page of ["0", "-1", "1.5", "Infinity", "100001", "bad"])
    expect(parseListQuery({ page }, ["name"]).page).toBe(1);
  expect(
    parseListQuery(
      { page: "2", sort: "injected", direction: "other", q: ["bad"] },
      ["name"],
    ),
  ).toEqual({ page: 2, size: 25, sort: "name", direction: "asc", q: "" });
  expect(parseListQuery({ q: " x " }, ["name"]).q).toBe("x");
});
it("encodes links and escapes LIKE metacharacters", () => {
  expect(listHref("/brands", parseListQuery({ q: "A&B" }, ["name"]))).toContain(
    "q=A%26B",
  );
  expect(escapeLike("10%_\\")).toBe("10\\%\\_\\\\");
});
