"use client";

import { useEffect } from "react";
import { claim } from "./client";

export function PrepClaim({ token }: { token: string }) {
  useEffect(() => {
    void claim(token);
  }, [token]);
  return null;
}
