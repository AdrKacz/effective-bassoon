import { Resource } from "sst"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, bucket } from "../../../clients";
import { Context } from "hono";
import { User } from '../../types'

export async function getImage(c: Context<{ Variables: User }>) {
    const userId = c.get('id')
    if (!userId) {
        return c.text('Unauthorized', 401)
    }
    const filename = c.req.query('filename')
    if (!filename) {
        return c.text('Missing required fields: filename', 400)
    }
    // Verify image belongs to user
    const userIdFromFilename = filename.split('/')[1]
    if (userId !== userIdFromFilename) {
        return c.text('Unauthorized', 401)
    }
    const metadata = await ddb.send(new GetCommand({
        TableName: Resource.Table.name,
        Key: {
            pk: `user#${userId}`,
            sk: `image#${filename}`,
        },
    }))
    if (!metadata.Item) {
        return c.text('Image not found', 404)
    }
    const command = new GetObjectCommand({
        Bucket: Resource.Bucket.name,
        Key: filename,
    })
    const url = await getSignedUrl(bucket, command, { expiresIn: 3600 }) // 1 hour expiration
    return c.json({
        date: metadata.Item.date,
        prompt: metadata.Item.prompt,
        ratio: metadata.Item.ratio,
        url,
    })
}