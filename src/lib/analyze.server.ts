import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, NoObjectGeneratedError, Output, streamText } from "ai";
import { analysisOutputSchema, type AnalysisInput, type AnalysisResult } from "./analysis-schema";
import { LEGAL_SOURCES } from "./legal-sources";

const MODEL = "openai/gpt-6-astra";

const INSTRUCTIONS = `You help a private tenant in England understand a tenancy deposit dispute. You are neutral and careful.

Rules:
- Use ONLY the supplied documents and the tenant's answers. Never invent facts, dates, amounts or documents.
- Classify every statement with "kind":
  documented = stated in a supplied document (give sourceRef as "<filename>, <location>");
  user_reported = stated only in the tenant's answers (sourceRef "Your answers");
  allegation = a claim one party makes that is not independently shown (e.g. the landlord says there is damage);
  ai_interpretation = your own inference or reading of the material (sourceRef null or the material it is based on).
- If documents conflict, or something important is missing or unclear, record it in "conflicts", "missingInformation" or "unresolvedQuestions". Ask follow-up questions instead of guessing.
- Events: chronological, ISO date (YYYY-MM-DD) when known, otherwise null.
- procedureNotes: explain the general deposit dispute process ONLY using the verified sources below, referenced by sourceId. Do not cite any statute, case or other source. Do not tell the tenant who will win or what their legal rights are.
- summary: neutral, plain English, 3-5 sentences.
- draftResponse: a polite, factual email from the tenant to the landlord/agent. Include only facts listed above; put [square brackets] where the tenant must fill in or check something.

Verified sources:
${LEGAL_SOURCES.map((s) => `- ${s.id}: ${s.title} — ${s.covers}`).join("\n")}`;

function buildPrompt(input: AnalysisInput) {
  const a = input.answers;
  const docs = input.documents
    .map((d) => d.chunks.map((c) => `<<${d.filename} | ${c.location}>>\n${c.text}`).join("\n\n"))
    .join("\n\n");
  return `TENANT'S ANSWERS (user_reported):
Name: ${a.tenantName}
Landlord/agent: ${a.landlordName}
Address: ${a.address}
Tenancy: ${a.tenancyStart || "unknown"} to ${a.tenancyEnd || "unknown"}
Deposit: £${a.depositAmount}; amount in dispute: £${a.disputedAmount}
Scheme: ${a.scheme}
Deduction reason given: ${a.deductionReason}
Tenant's view: ${a.tenantView}

DOCUMENTS (each block is labelled <<filename | location>>):
${docs || "(no documents supplied)"}`;
}

export async function runAnalysis(input: AnalysisInput, signal?: AbortSignal): Promise<AnalysisResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false, status: 500, message: "The AI service isn't configured." };

  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });

  try {
    const result = streamText({
      model: provider.responses(MODEL),
      system: INSTRUCTIONS,
      messages: [{ role: "user", content: buildPrompt(input) }],
      output: Output.object({ schema: analysisOutputSchema }),
      abortSignal: signal,
      maxRetries: 0,
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "medium",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    const analysis = await result.output;
    return { ok: true, analysis };
  } catch (err) {
    // Log status only — never document contents.
    if (APICallError.isInstance(err)) {
      const status = err.statusCode ?? 500;
      console.error("analysis gateway error", status);
      if (status === 402) return { ok: false, status, message: "AI credits have run out for this workspace. Add credits to keep using analysis." };
      if (status === 429) return { ok: false, status, message: "The AI service is busy. Please wait a minute and try again." };
      if (status === 403) return { ok: false, status, message: "The AI service declined this request." };
      return { ok: false, status, message: "The AI service had a problem. Please try again later." };
    }
    if (NoObjectGeneratedError.isInstance(err)) {
      console.error("analysis returned unreadable output");
      return { ok: false, status: 502, message: "The AI response couldn't be read. Please try again." };
    }
    console.error("analysis failed", err instanceof Error ? err.name : "unknown");
    return { ok: false, status: 500, message: "Something went wrong while analysing your case." };
  }
}
