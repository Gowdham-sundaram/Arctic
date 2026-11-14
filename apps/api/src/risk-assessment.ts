import type { RiskAssessmentInput, RiskAssessmentRecord } from "@arctic/contracts";

export const RISK_MODEL_VERSION = "ARCTIC-ILLUSTRATIVE-1";

export interface CalculatedRisk {
  version: string;
  score: number;
  category: RiskAssessmentRecord["category"];
  explanation: string;
}

export function calculateIllustrativeRisk(input: RiskAssessmentInput): CalculatedRisk {
  const score = input.likelihood * input.consequence * input.exposure;
  const category =
    score <= 20 ? "LOW" : score <= 45 ? "MODERATE" : score <= 75 ? "HIGH" : "CRITICAL";
  return {
    version: RISK_MODEL_VERSION,
    score,
    category,
    explanation: `Illustrative score = likelihood (${input.likelihood}) × consequence (${input.consequence}) × exposure (${input.exposure}) = ${score}/125; category ${category}. This versioned demo method is not calibrated or approved for engineering or safety decisions.`,
  };
}
