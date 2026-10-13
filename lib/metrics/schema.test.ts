import { describe, expect, it } from "vitest";
import { metricChange } from "./schema";
describe("metric changes", () => {
  it("handles zero and negative baselines without infinity", () => {
    expect(metricChange("100", "0")).toBeNull();
    expect(metricChange("0", "0")).toBe("0");
    expect(metricChange("100", "-100")).toBeNull();
  });
  it("rounds changes and keeps signs and Italian decimals", () => {
    expect(metricChange("12345", "10000")).toBe("+23,5");
    expect(metricChange("7655", "10000")).toBe("−23,5");
    expect(metricChange("0", "100")).toBe("−100");
    expect(metricChange("100", "100")).toBe("0");
  });
  it("preserves exact totals beyond Number safe integers", () => {
    expect(metricChange("20000000000000000000", "10000000000000000000")).toBe(
      "+100",
    );
    expect(metricChange("10000000000000000000", "1")).toBe(
      "+999.999.999.999.999.999.900",
    );
  });
});
