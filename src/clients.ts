import { createClient } from "@openauthjs/openauth/client"
import { Resource } from "sst"
import { S3Client } from "@aws-sdk/client-s3"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export const auth = createClient({
    clientID: "hono",
    issuer: Resource.Auth.url,
})

export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: {
        convertEmptyValues: true,
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
        convertTopLevelContainer: true,
        allowImpreciseNumbers: false
    },
    unmarshallOptions: {
        wrapNumbers: true,
        convertWithoutMapWrapper: true
    }
})

export const bucket = new S3Client({ region: 'eu-west-3' })