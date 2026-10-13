export function securityHeaders({
  supabaseUrl,
  appUrl,
  development,
}: {
  supabaseUrl?: string;
  appUrl?: string;
  development: boolean;
}) {
  const origins: string[] = [];
  if (supabaseUrl) {
    const url = new URL(supabaseUrl);
    if (!["http:", "https:"].includes(url.protocol))
      throw Error("Invalid Supabase origin");
    origins.push(
      url.origin,
      `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}`,
    );
  }
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${origins.join(" ")}${development ? " ws: wss:" : ""}`,
    `img-src 'self' data: blob: ${origins[0] ?? ""}`,
    "font-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  const secure = appUrl?.startsWith("https://");
  if (secure) csp.push("upgrade-insecure-requests");
  return [
    { key: "Content-Security-Policy", value: csp.join("; ") },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=()",
    },
    ...(secure
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ]
      : []),
  ];
}
