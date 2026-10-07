export type MetricSection = "comercial" | "operacional";

export type Metric = {
  id: number;
  section: MetricSection;
  key: string;
  dimension: string | null;
  value: number;
  date: string;
  createdAt: string;
};

export type MetricSeriesPoint = { label: string; value: number };

export type CreativeStage = "briefing" | "producao" | "revisao" | "aprovado" | "publicado";

export type Creative = {
  id: number;
  title: string;
  account: string;
  format: string;
  owner: string;
  stage: CreativeStage;
  hasImage: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateCreativeInput = Pick<Creative, "title" | "account" | "format" | "owner"> & {
  stage?: CreativeStage;
};

export type UpdateCreativeInput = Partial<Pick<Creative, "title" | "account" | "format" | "owner" | "stage">>;

export type User = {
  id: number;
  name: string;
  email: string;
  createdAt: string;
};

export type AuthSession = { token: string; user: User };

export type ImportLineError = { line: number; message: string };

export class ApiError extends Error {
  status: number;
  errors: ImportLineError[];

  constructor(message: string, status: number, errors: ImportLineError[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

export type CreateMetricInput = {
  section: MetricSection;
  key: string;
  dimension?: string;
  value: number;
  date: string;
};

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

async function apiResponse(path: string, init?: RequestInit, authenticated = false): Promise<Response> {
  const headers = new Headers(init?.headers);
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  if (init?.body && !isFormData) headers.set("Content-Type", "application/json");

  if (authenticated) {
    const { getStoredToken } = await import("@/lib/auth-storage");
    const token = getStoredToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch {
    throw new Error("Não foi possível conectar à API. Verifique se o backend está ativo.");
  }

  if (!response.ok) {
    let message = "A API não conseguiu concluir a solicitação.";
    let errors: ImportLineError[] = [];
    try {
      const body = (await response.json()) as { message?: string; errors?: ImportLineError[] };
      if (body.message) message = body.message;
      if (Array.isArray(body.errors)) errors = body.errors;
    } catch {
      // The default message is clearer than an invalid response body.
    }

    if (response.status === 401 && authenticated) {
      const { clearStoredSession } = await import("@/lib/auth-storage");
      clearStoredSession();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    throw new ApiError(message, response.status, errors);
  }
  return response;
}

async function apiRequest<T>(path: string, init?: RequestInit, authenticated = false): Promise<T> {
  const response = await apiResponse(path, init, authenticated);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function register(input: { name: string; email: string; password: string }) {
  return apiRequest<AuthSession>("/auth/register", { method: "POST", body: JSON.stringify(input) });
}

export function login(input: { email: string; password: string }) {
  return apiRequest<AuthSession>("/auth/login", { method: "POST", body: JSON.stringify(input) });
}

export function getCurrentUser() {
  return apiRequest<User>("/auth/me", undefined, true);
}

export function getMetrics(section: MetricSection) {
  return apiRequest<Metric[]>(`/metrics?section=${section}`, undefined, true);
}

export function getSeries(section: MetricSection, key: string, groupBy: "date" | "dimension" = "date") {
  const params = new URLSearchParams({ section, key, groupBy });
  return apiRequest<MetricSeriesPoint[]>(`/metrics/series?${params.toString()}`, undefined, true);
}

export function createMetric(input: CreateMetricInput) {
  return apiRequest<Metric>("/metrics", { method: "POST", body: JSON.stringify(input) }, true);
}

export function importMetrics(file: File) {
  const body = new FormData();
  body.append("file", file);
  return apiRequest<{ imported: number }>("/metrics/import", { method: "POST", body }, true);
}

export function getCreatives() {
  return apiRequest<Creative[]>("/creatives", undefined, true);
}

export function createCreative(input: CreateCreativeInput) {
  return apiRequest<Creative>("/creatives", { method: "POST", body: JSON.stringify(input) }, true);
}

export function updateCreative(id: number, input: UpdateCreativeInput) {
  return apiRequest<Creative>(`/creatives/${id}`, { method: "PATCH", body: JSON.stringify(input) }, true);
}

export function deleteCreative(id: number) {
  return apiRequest<void>(`/creatives/${id}`, { method: "DELETE" }, true);
}

export function uploadCreativeImage(id: number, file: File) {
  const body = new FormData();
  body.append("file", file);
  return apiRequest<Creative>(`/creatives/${id}/image`, { method: "PUT", body }, true);
}

export function removeCreativeImage(id: number) {
  return apiRequest<Creative>(`/creatives/${id}/image`, { method: "DELETE" }, true);
}

export async function getCreativeImage(id: number) {
  const response = await apiResponse(`/creatives/${id}/image`, undefined, true);
  return response.blob();
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

// Resposta em texto puro via streaming: onText recebe cada pedaço assim que chega.
export async function chatAssistant(messages: ChatMessage[], onText: (text: string) => void) {
  const response = await apiResponse("/assistant/chat", { method: "POST", body: JSON.stringify({ messages }) }, true);
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
  for (let r = await reader.read(); !r.done; r = await reader.read()) onText(r.value);
}

export type OpenAIConfig = { configured: boolean; keyHint: string | null; model: string | null };

export function getOpenAIConfig() {
  return apiRequest<OpenAIConfig>("/integrations/openai", undefined, true);
}

// Sem apiKey, lista os modelos da chave já salva.
export function listOpenAIModels(apiKey?: string) {
  return apiRequest<string[]>("/integrations/openai/models", { method: "POST", body: JSON.stringify({ apiKey }) }, true);
}

export function saveOpenAIConfig(input: { apiKey?: string; model: string }) {
  return apiRequest<OpenAIConfig>("/integrations/openai", { method: "PUT", body: JSON.stringify(input) }, true);
}

export type MetaConfig = { configured: boolean; businessId: string | null; businessName: string | null };

export type MetaAccount = {
  id: string;
  accountId: string;
  name: string;
  status: "ativa" | "desativada" | "outro";
  currency: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  leads: number;
  purchases: number;
  ctr: number;
  cpc: number;
  cpm: number;
};

export type MetaAccountsReport = {
  business: { id: string; name: string };
  from: string;
  to: string;
  totals: Omit<MetaAccount, "id" | "accountId" | "name" | "status" | "currency">;
  accounts: MetaAccount[];
};

export function getMetaConfig() {
  return apiRequest<MetaConfig>("/integrations/meta", undefined, true);
}

export function saveMetaConfig(input: { accessToken?: string; businessId: string }) {
  return apiRequest<MetaConfig>("/integrations/meta", { method: "PUT", body: JSON.stringify(input) }, true);
}

export function getMetaAccounts(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return apiRequest<MetaAccountsReport>(`/meta/accounts?${params.toString()}`, undefined, true);
}
