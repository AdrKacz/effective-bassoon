import { Resource } from "sst";
import { handle } from "hono/aws-lambda";
import { issuer } from "@openauthjs/openauth";
import { GoogleProvider } from "@openauthjs/openauth/provider/google";
import { subjects } from "./subjects";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../clients/ddb";
import jwt from "jsonwebtoken";
import business from "facebook-nodejs-business-sdk";

business.FacebookAdsApi.init(Resource.FacebookConversionApiToken.value);
const UserData = business.UserData;
const ServerEvent = business.ServerEvent;
const EventRequest = business.EventRequest;

type TrackingData = {
    userAgent: string | null;
    ip: string | null;
    cid: string | undefined;
    url: string;
}

async function getUser(id: string, args: any = {}, trackingData: TrackingData) {
    // Send put request to database, only put if user does not exist
    try {
        await ddb.send(new PutCommand({
            TableName: Resource.Table.name,
            Item: {
                pk: `user#${id}`,
                sk: 'metadata',
                remaining_credits: 5, // We give 5 free credits to new users (this only runs for the first login, see the condition expression below)
                ...args,
            },
            ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
        }));
        console.log(`User created: ${id}`);

        // Send event to Facebook Conversion API (this only runs for the first login, see the condition expression above)
        const userData = (new UserData()).setEmail(id)
        if (trackingData.ip) userData.setClientIpAddress(trackingData.ip);
        if (trackingData.userAgent) userData.setClientUserAgent(trackingData.userAgent);
        if (trackingData.cid) userData.setFbc(trackingData.cid);

        const now = Math.floor(Date.now() / 1000);
        const serverEvent = (new ServerEvent())
            .setEventName('CompleteRegistration')
            .setEventTime(now)
            .setUserData(userData)
            .setEventSourceUrl(trackingData.url)
            .setActionSource('website')
            .setEventId(`${now}.${id}`);

        const eventsData = [serverEvent];
        const eventRequest = (new EventRequest(Resource.FacebookConversionApiToken.value, Resource.FacebookPixelId.value))
            .setEvents(eventsData)

        try {
            const response = await eventRequest.execute()
            console.log("Response from Facebook Conversion API: ", response)
        } catch (error) {
            console.error("Error sending event to Facebook Conversion API: ", error)
        }
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
    success: async (ctx, value, req) => {
        // Get redirect URI
        const userAgent = req.headers.get("user-agent");
        console.log("User-Agent: ", userAgent);
        const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
        console.log("IP: ", ip);
        const state = req.url.split("?")[1]?.split("&").find((param) => param.startsWith("state="))?.split("=")[1];
        let cid;
        try {
            const decoded = JSON.parse(atob(state || ""))
            cid = decoded.cid;
        } catch (error) {
            console.log("Cannot parse CID from state: we assume the user didn't come from a Facebook ad");
        }
        console.log("CID: ", cid);

        if (value.provider === "google") {
            const decoded = jwt.decode(value.tokenset.raw.id_token) as any;
            if (!decoded) {
                throw new Error("Invalid ID token");
            }
            const email = decoded.email;
            return ctx.subject("user", {
                id: await getUser(email,
                    {
                        google_email: email,
                        google_client_id: value.clientID,
                    }, { userAgent, ip, cid, url: req.url }),
            });
        }
        throw new Error("Invalid provider");
    },
});

export const handler = handle(app);