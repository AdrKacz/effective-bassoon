import { Resource } from "sst";
import { handle } from "hono/aws-lambda";
import { issuer } from "@openauthjs/openauth";
import { GoogleProvider } from "@openauthjs/openauth/provider/google";
import { subjects } from "./subjects";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../clients/ddb";
import jwt from "jsonwebtoken";

async function getUser(id: string, args: any = {}) {
    // Send put request to database, only put if user does not exist
    try {
        await ddb.send(new PutCommand({
            TableName: Resource.Table.name,
            Item: {
                pk: `user#${id}`,
                sk: 'metadata',
                remaining_credits: 5, // We give 5 free credits to new users 
                ...args,
            },
            ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
        }));
    } catch (err: any) {
        if (err.name === 'ConditionalCheckFailedException') {
            console.log(`User already exists: ${id}`);
        } else {
            throw err;
        }
    }
    return id;
}

const app = issuer({
    subjects,
    providers: {
        google: GoogleProvider({
            clientID: Resource.GoogleClientID.value,
            clientSecret: Resource.GoogleClientSecret.value,
            pkce: true,
            scopes: ["email"],
        })
    },
    allow: async ({ redirectURI }) => {
        // Domain must end with le-studio-k.fr
        const domain = redirectURI.split("/")[2];
        if (domain.endsWith("le-studio-k.fr")) {
            return true;
        }
        return false;
    },
    // This function is called when the user is authenticated
    success: async (ctx, value) => {
        if (value.provider === "google") {
            const decoded = jwt.decode(value.tokenset.raw.id_token) as any;
            if (!decoded) {
                throw new Error("Invalid ID token");
            }
            const email = decoded.email;
            return ctx.subject("user", {
                id: await getUser(email, {
                    google_email: email,
                    google_client_id: value.clientID,
                }),
            });
        }
        throw new Error("Invalid provider");
    },
});

export const handler = handle(app);