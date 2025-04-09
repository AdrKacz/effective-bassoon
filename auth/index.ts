import { Resource } from "sst";
import { handle } from "hono/aws-lambda";
import { issuer } from "@openauthjs/openauth";
import { GoogleProvider } from "@openauthjs/openauth/provider/google";
import { subjects } from "./subjects";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./clients";

async function getUser(clientID: string, args: any = {}) {
    // Send put request to database, only put if user does not exist
    try {
        await ddb.send(new PutCommand({
            TableName: Resource.Table.name,
            Item: {
                pk: `user#${clientID}`,
                sk: 'metadata',
                ...args,
            },
            ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
        }));
    } catch (err: any) {
        if (err.name === 'ConditionalCheckFailedException') {
            console.log(`User already exists: ${clientID}`);
        } else {
            throw err;
        }
    }
    return clientID;
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
    success: async (ctx, value) => {
        if (value.provider === "google") {
            console.log("Google user", value)
            return ctx.subject("user", {
                id: await getUser(value.clientID, {
                    google_client_id: value.clientID
                }),
            });
        }
        throw new Error("Invalid provider");
    },
});

export const handler = handle(app);