"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { SignInDialog } from "./SignInDialog";

interface SignInPromptApi {
  promptSignIn: () => void;
}

const SignInPromptContext = createContext<SignInPromptApi | null>(null);

export function useSignInPrompt(): SignInPromptApi {
  const ctx = useContext(SignInPromptContext);
  if (!ctx) {
    throw new Error(
      "useSignInPrompt must be used within <SignInPromptProvider>",
    );
  }
  return ctx;
}

/**
 * One shared sign-in prompt for the whole tree. Guest-gated controls call
 * promptSignIn(); the single dialog instance lives here. Mounted for every
 * visitor — authenticated components simply never call it.
 */
export function SignInPromptProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const promptSignIn = useCallback(() => setOpen(true), []);

  return (
    <SignInPromptContext.Provider value={{ promptSignIn }}>
      {children}
      <SignInDialog open={open} onClose={() => setOpen(false)} />
    </SignInPromptContext.Provider>
  );
}
