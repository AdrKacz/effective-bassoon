import { createClient } from "@openauthjs/openauth/client"
import { Resource } from "sst"

export const auth = createClient({
    clientID: "hono",
    issuer: Resource.Auth.url,
})