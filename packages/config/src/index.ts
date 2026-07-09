export interface ApiConfig {
  port: number;
  databaseUrl: string;
}

export function readApiConfig(env: Record<string, string | undefined>): ApiConfig {
  const port = Number(env.API_PORT ?? 3000);
  const databaseUrl =
    env.DATABASE_URL ?? "postgresql://kaklen:kaklen@localhost:5432/kaklen?schema=public";

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("API_PORT must be a positive integer");
  }

  return {
    port,
    databaseUrl
  };
}
