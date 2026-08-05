import { type Href, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import { AppScreen, ErrorState, LoadingState } from "@/components/vouch-ui";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{
    code?: string | string[];
    purpose?: string | string[];
    error_description?: string | string[];
  }>();
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  const purpose = Array.isArray(params.purpose)
    ? params.purpose[0]
    : params.purpose;
  const providerError = Array.isArray(params.error_description)
    ? params.error_description[0]
    : params.error_description;
  const immediateError = providerError
    ? providerError
    : !code
      ? "This private sign-in link is incomplete or has expired."
      : "";
  const [exchangeError, setExchangeError] = useState("");
  const errorMessage = immediateError || exchangeError;

  useEffect(() => {
    if (providerError || !code) {
      return;
    }

    let cancelled = false;

    void supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (cancelled) return;
      if (error) {
        setExchangeError(error.message);
        return;
      }

      router.replace(
        (purpose === "recovery" ? "/reset-password" : "/") as Href,
      );
    });

    return () => {
      cancelled = true;
    };
  }, [code, providerError, purpose]);

  return (
    <AppScreen includeBottomInset>
      {errorMessage ? (
        <ErrorState
          body={errorMessage}
          onRetry={() => router.replace("/sign-in")}
          title="This link could not be used"
        />
      ) : (
        <LoadingState label="Securing your Vouch account…" />
      )}
    </AppScreen>
  );
}
