import "server-only";

export function authSettings(
  env: Record<string, string | undefined> = process.env,
) {
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error(
      "Configure BETTER_AUTH_SECRET with at least 32 random characters.",
    );
  let url: URL;
  try {
    url = new URL(env.BETTER_AUTH_URL ?? "");
  } catch {
    throw new Error(
      "Configure BETTER_AUTH_URL with the application's exact origin.",
    );
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
  ) {
    throw new Error(
      "BETTER_AUTH_URL requires HTTPS except for local loopback development.",
    );
  }
  return { secret, baseURL: url.origin, secure: url.protocol === "https:" };
}
