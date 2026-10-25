import "server-only";
import { notFound, redirect } from "next/navigation";
import { ServiceError } from "@/lib/server/service-error";

export async function privateRead<T>(read: () => Promise<T>) {
  try {
    return await read();
  } catch (error) {
    if (error instanceof ServiceError && error.status === 401)
      redirect("/sign-in");
    if (error instanceof ServiceError && error.status === 404) notFound();
    // Do not pass driver error/connection details to Next's error boundary/logs.
    throw new Error("Portfolio data could not be loaded.");
  }
}
