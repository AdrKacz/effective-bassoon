import { Resource } from "sst";
import { handle } from "hono/aws-lambda";
import { issuer } from "@openauthjs/openauth";
import { GoogleProvider } from "@openauthjs/openauth/provider/google";
import { subjects } from "./subjects";

async function getUser(email: string) {
    // Get user from database and return user ID
    return "123";
}

const app = issuer({
    subjects,
    // Remove after setting custom domain
    allow: async () => true,
    providers: {
        google: GoogleProvider({
            clientID: Resource.GoogleClientID.value,
            clientSecret: Resource.GoogleClientSecret.value,
            pkce: true,
            scopes: ["email"],
        })
    },
    success: async (ctx, value) => {
        if (value.provider === "google") {
            console.log("Google user", value)
            return ctx.subject("user", {
                id: await getUser(value.clientID),
            });
        }
        throw new Error("Invalid provider");
    },
});

export const handler = handle(app);