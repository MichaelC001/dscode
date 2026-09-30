import { AUTH_PROMPT_CANCEL_VALUE } from "../../shared/types";

export function isAgentSessionClosedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\bAgent session closed\b/i.test(message);
}

export function isAuthPromptCancelledError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes(AUTH_PROMPT_CANCEL_VALUE) || /\bLogin prompt cancelled\b/i.test(message);
}

export function isModelConfigurationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b401\b|authentication[_\s-]*(?:error|fail(?:ed|s|ure)?)|invalid[_\s-]*(?:api[_\s-]*)?key|(?:api[_\s-]*key|credential).{0,80}(?:invalid|expired|missing|required|not configured)|(?:invalid|expired|missing|required|no).{0,40}(?:api[_\s-]*key|credential)|(?:model|provider).{0,40}not configured/i.test(message);
}
