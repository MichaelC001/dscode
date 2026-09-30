import { describe, expect, it } from "vitest";
import { AUTH_PROMPT_CANCEL_VALUE } from "../../shared/types";
import { isAgentSessionClosedError, isAuthPromptCancelledError, isModelConfigurationError } from "./errors";

describe("isAgentSessionClosedError", () => {
  it("recognizes the direct AgentHost cancellation", () => {
    expect(isAgentSessionClosedError(new Error("Agent session closed"))).toBe(true);
  });

  it("recognizes the cancellation after Electron wraps it", () => {
    expect(isAgentSessionClosedError(
      "Error invoking remote method 'agent:command': Error: Agent session closed",
    )).toBe(true);
  });

  it("keeps real Agent failures visible", () => {
    expect(isAgentSessionClosedError(new Error("Agent stopped (code 1)"))).toBe(false);
  });
});

describe("isAuthPromptCancelledError", () => {
  it("recognizes cancellation handled by the current main process", () => {
    expect(isAuthPromptCancelledError(new Error("Login prompt cancelled"))).toBe(true);
  });

  it("recognizes the cancellation marker when an older main process treats it as a login method", () => {
    expect(isAuthPromptCancelledError(
      `Error: Unknown OpenAI Codex login method: ${AUTH_PROMPT_CANCEL_VALUE}`,
    )).toBe(true);
  });

  it("keeps real authentication failures visible", () => {
    expect(isAuthPromptCancelledError(new Error("OpenAI Codex token exchange failed"))).toBe(false);
  });
});

describe("isModelConfigurationError", () => {
  it("recognizes provider authentication failures", () => {
    expect(isModelConfigurationError(
      'OpenAI API error (401): {"message":"Authentication Fails","type":"authentication_error"}',
    )).toBe(true);
    expect(isModelConfigurationError("DeepSeek API key is invalid or expired")).toBe(true);
    expect(isModelConfigurationError("Provider is not configured")).toBe(true);
  });

  it("does not collapse unrelated runtime failures into model configuration", () => {
    expect(isModelConfigurationError("Agent stopped (code 1)\nWorker process crashed")).toBe(false);
    expect(isModelConfigurationError("Tool execution timed out after 45 seconds")).toBe(false);
  });
});
