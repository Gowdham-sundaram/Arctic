import { describe, expect, it } from "vitest";
import { calculateIllustrativeRisk, RISK_MODEL_VERSION } from "../src/risk-assessment.ts";

describe("illustrative risk assessment", () => {
  it.each([
    [1, 5, 4, 20, "LOW"],
    [3, 5, 3, 45, "MODERATE"],
    [5, 3, 5, 75, "HIGH"],
    [4, 5, 4, 80, "CRITICAL"],
  ] as const)(
    "calculates score %i × %i × %i as %s",
    (likelihood, consequence, exposure, score, category) => {
      const result = calculateIllustrativeRisk({
        likelihood,
        consequence,
        exposure,
        factors: { note: "synthetic input" },
      });
      expect(result.score).toBe(score);
      expect(result.category).toBe(category);
      expect(result.version).toBe(RISK_MODEL_VERSION);
      expect(result.explanation).toContain("not calibrated or approved");
    },
  );
});
