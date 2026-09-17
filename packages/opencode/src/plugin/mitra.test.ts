import { describe, expect, test } from "bun:test"
import { createMitraAuthHooks } from "./mitra"

describe("MitraAuthPlugin", () => {
  test("loader returns apiKey from stored auth", async () => {
    const hooks = createMitraAuthHooks(fetch, "https://mitra-dev.softclub.by")
    expect(hooks.auth).toBeDefined()
    expect(hooks.auth!.provider).toBe("mitra")
    const options = await hooks.auth!.loader!(async () => ({ type: "api" as const, key: "test-jwt" }), {} as any)
    expect(options.apiKey).toBe("test-jwt")
  })

  test("authorize exchanges login/password for JWT", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const request = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      calls.push({ url: String(input), init: init ?? {} })
      return new Response("jwt-token-abc", { status: 200 })
    }
    const hooks = createMitraAuthHooks(request, "https://mitra-dev.softclub.by")
    const method = hooks.auth!.methods[0]
    const result = await method.authorize({ login: "admin", password: "admin" })
    expect(result.type).toBe("success")
    if (result.type === "success") {
      expect(result.key).toBe("jwt-token-abc")
    }
    expect(calls[0].url).toBe("https://mitra-dev.softclub.by/api/ai/auth/authenticate")
    const body = JSON.parse(String(calls[0].init.body))
    expect(body).toEqual({ login: "admin", password: "admin" })
  })

  test("authorize throws on failed auth", async () => {
    const request = async (): Promise<Response> => new Response("error", { status: 401 })
    const hooks = createMitraAuthHooks(request, "https://mitra-dev.softclub.by")
    const method = hooks.auth!.methods[0]
    expect(async () => await method.authorize({ login: "admin", password: "wrong" })).toThrow()
  })

  test("loader fetch adds Bearer token", async () => {
    const seen: Array<{ headers: Headers }> = []
    const request = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      seen.push({ headers: new Headers(init?.headers ?? {}) })
      return new Response("ok", { status: 200 })
    }
    const hooks = createMitraAuthHooks(request, "https://mitra-dev.softclub.by")
    const options = await hooks.auth!.loader!(async () => ({ type: "api" as const, key: "my-jwt" }), {} as any)
    await options.fetch("https://mitra-dev.softclub.by/api/ai/v1/chat/completions", {
      headers: { "Content-Type": "application/json" },
    })
    expect(seen[0].headers.get("authorization")).toBe("Bearer my-jwt")
  })
})
