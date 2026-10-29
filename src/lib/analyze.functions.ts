import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { analysisInputSchema, UPLOAD_LIMITS, type AnalysisResult } from "./analysis-schema";
import { runAnalysis } from "./analyze.server";

export const analyseCase = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => analysisInputSchema.parse(data))
  .handler(async ({ data }): Promise<AnalysisResult> => {
    const total = data.documents.reduce((n, d) => n + d.chunks.reduce((m, c) => m + c.text.length, 0), 0);
    if (total > UPLOAD_LIMITS.maxTotalChars)
      return { ok: false, status: 413, message: "Your documents contain too much text. Remove a file and try again." };
    return runAnalysis(data, getRequest().signal);
  });
