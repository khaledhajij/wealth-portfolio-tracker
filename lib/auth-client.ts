"use client";
import { createAuthClient } from "better-auth/react";
// Same-origin calls; no server credentials/configuration are imported here.
export const authClient = createAuthClient();
