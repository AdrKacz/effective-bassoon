import { Resource } from "sst"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import { QueryCommand, QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import { ddb, bucket } from "../../../clients";
import { Context } from "hono";
import { User } from '../../types'

export async function getImages(c: Context<{ Variables: User }>) {
    const userId = c.get('id')
    if (!userId) {
        return c.text('Unauthorized', 401)
    }
    const params = c.req.query()
    if (!params || !params.limit) {
        return c.text('Missing required fields: limit', 400)
    }
    const limit = parseInt(params.limit)
    if (isNaN(limit) || limit < 1 || limit > 25) {
        return c.text('Limit must be a number between 1 and 25', 400)
    }
    const start = params.start ? params.start : null
    const startKey = start ? JSON.parse(start) : null
    const query: QueryCommandInput = {
        TableName: Resource.Table.name,
        KeyConditionExpression: '#pk=:pk and begins_with(#sk, :sk)',
        ExpressionAttributeNames: {
            '#pk': 'pk',
            '#sk': 'sk',
        },
        ExpressionAttributeValues: {
            ':pk': `user#${userId}`,
            ':sk': 'image#',
        },
        Limit: limit,
    }
    if (startKey) {
        query.ExclusiveStartKey = startKey
    }
    try {
        console.log(`Querying DynamoDB with params: ${JSON.stringify(query)}`)
        const data = await ddb.send(new QueryCommand(query))
        console.log(`Query result: ${JSON.stringify(data)}`)
        if (data.Items) {
            const promises = data.Items.map(async (item) => {
                const smallFileName = item.smallFileName
                if (!smallFileName) {
                    console.error(`ERROR: No smallFileName found for item: ${JSON.stringify(item)}`)
                    return null
                }
                const command = new GetObjectCommand({
                    Bucket: Resource.Bucket.name,
                    Key: smallFileName,
                })
                const url = await getSignedUrl(bucket, command, { expiresIn: 3600 }) // 1 hour expiration
                return {
                    date: item.date,
                    prompt: item.prompt,
                    ratio: item.ratio,
                    filename: item.sk.split('#')[1],
                    url,
                }
            })
            const items = await Promise.all(promises)
            console.log(`Items: ${JSON.stringify(items)}`)
            return c.json({
                items: items.filter((item) => item !== null),
                next: data.LastEvaluatedKey ? JSON.stringify(data.LastEvaluatedKey) : null,
            })
        } else {
            return c.json({
                items: [],
                next: null,
            })
        }
    } catch (error: any) {
        console.error(`ERROR: Can't query DynamoDB. Reason: ${error.message}`);
        return c.text("Cannot query images", 500);
    }
}