import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { OAUTH_DUMMY_KEY } from "../auth"

const MITRA_BASE_URL = process.env.MITRA_BASE_URL ?? "https://mitra-dev.softclub.by"

export async function MitraAuthPlugin(_input: PluginInput): Promise<Hooks> {
  return createMitraAuthHooks(fetch, MITRA_BASE_URL)
}

export function createMitraAuthHooks(
  request: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  baseUrl: string,
): Hooks {
  return {
    auth: {
      provider: "mitra",
      async loader(getAuth) {
        const auth = await getAuth()
        if (auth.type !== "api") return {}
        return {
          apiKey: auth.key,
          async fetch(input: RequestInfo | URL, init?: RequestInit) {
            const headers = new Headers(input instanceof Request ? input.headers : undefined)
            new Headers(init?.headers).forEach((value, key) => headers.set(key, value))
            headers.delete("api-key")
            headers.delete("x-api-key")
            // Mitra /v1 proxy expects the JWT (or shared API key) in Authorization.
            headers.set("authorization", `Bearer ${auth.key}`)
            return request(input, { ...init, headers })
          },
        }
      },
      methods: [
        {
          type: "api",
          label: "Mitra account (login/password)",
          prompts: [
            {
              type: "text",
              key: "login",
              message: "Mitra login",
              placeholder: "e.g. hetsevich",
            },
            {
              type: "text",
              key: "password",
              message: "Mitra password",
            },
          ],
          async authorize(inputs) {
            const login = inputs?.login
            const password = inputs?.password
            if (!login || !password) throw new Error("Login and password are required")

            const response = await request(`${baseUrl}/api/ai/auth/authenticate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ login, password }),
            })
            if (!response.ok) {
              throw new Error(`Mitra authentication failed (${response.status})`)
            }
            const jwt = (await response.text()).trim()
            if (!jwt) throw new Error("Mitra authentication returned an empty token")

            return {
              type: "success",
              key: jwt,
              metadata: { login },
            }
          },
        },
      ],
    },
  }
}
