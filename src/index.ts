import { Hono } from 'hono'
import { handle } from 'hono/aws-lambda'
import { createClient } from "@openauthjs/openauth/client"
import { bearerAuth } from 'hono/bearer-auth'
import { Resource } from "sst"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime"
import { subjects } from '../auth/subjects'
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, QueryCommandInput, GetCommand } from "@aws-sdk/lib-dynamodb";
import sharp from 'sharp'

const auth = createClient({
  clientID: "hono",
  issuer: Resource.Auth.url,
})

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
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

// Bedrock only supports Titan v2 in us-east-1 and us-west-2
// https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html
const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });
const modelId = 'amazon.titan-image-generator-v2:0'

// Negative prompt to avoid complex images that the model can't handle
const negativePrompt = "realistic face, visible eyes, fingers, photorealism, 3D, fine details, intricate textures, complex clothing, detailed skin, facial expressions, realistic anatomy, soft lighting, shadows, reflections, cluttered background, ornate elements, blur, noise, overexposure, transparent parts, pores, wrinkles, makeup, soft gradients"

const bucket = new S3Client({ region: 'eu-west-3' })

type Variables = {
  user_id: string
}

const app = new Hono<{ Variables: Variables }>()

app.use(
  bearerAuth({
    verifyToken: async (token, c) => {
      console.log(`Verifying token: ${token}`)
      const verified = await auth.verify(subjects, token)
      if (verified.err) {
        console.error("Cannot verify token", verified.err)
        return false
      }
      c.set('user_id', verified.subject.properties.id)
      return true
    },
  })
)

app.post('/image', async (c) => {
  const userId = c.get('user_id')
  if (!userId) {
    return c.text('Unauthorized', 401)
  }
  const body = await c.req.json()
  if (!body || !body.prompt || !body.ratio) {
    return c.text('Missing required fields: prompt, ratio', 400)
  }
  const prompt = body.prompt
  if (typeof prompt !== 'string') {
    return c.text('Prompt must be a string', 400)
  }
  if (prompt.length > 512) {
    return c.text('Prompt is too long', 400)
  }
  const ratio = body.ratio // square, landscape, portrait
  if (typeof ratio !== 'string') {
    return c.text('Ratio must be a string', 400)
  }
  // Set the image size based on the ratio
  let width = 512
  let height = 512
  switch (ratio) {
    case 'square':
      width = 1024
      height = 1024
      break;
    case 'landscape':
      width = 1408
      height = 768
      break;
    case 'portrait':
      width = 896
      height = 1152
      break;
    default:
      return c.text('Invalid ratio. Must be one of: square, landscape, portrait', 400)
  }


  const seed = Math.floor(Math.random() * 858993460)

  const payload = {
    taskType: "TEXT_IMAGE",
    textToImageParams: {
      text: prompt,
      negativeText: negativePrompt,
    },
    imageGenerationConfig: {
      seed,
      quality: "premium",
      width,
      height,
    },
  };

  try {
    const request = {
      modelId,
      body: JSON.stringify(payload),
    };
    console.log(`Invoking model '${modelId}' with payload: ${JSON.stringify(payload)}`);
    const response = await bedrock.send(new InvokeModelCommand(request));

    const decodedResponseBody = new TextDecoder().decode(response.body);
    const responseBody: { images: string[] } = JSON.parse(decodedResponseBody);

    if (responseBody.images.length === 0) {
      return c.text("No images generated", 500);
    }
    const image = responseBody.images[0];
    const imageBuffer = Buffer.from(image, 'base64');
    const smallImageBuffer = await sharp(imageBuffer)
      .resize({ height: 300, fit: 'cover' })
      .toFormat('png')
      .toBuffer();
    const now = (new Date()).toISOString()
    const fileName = `users/${userId}/images/${now}.png`;
    const smallFileName = `users/${userId}/images/${now}-small.png`;
    await bucket.send(new PutObjectCommand({
      Bucket: Resource.Bucket.name,
      Key: fileName,
      Body: imageBuffer,
      ContentType: 'image/png',
    }));
    await bucket.send(new PutObjectCommand({
      Bucket: Resource.Bucket.name,
      Key: smallFileName,
      Body: smallImageBuffer,
      ContentType: 'image/png',
    }));
    console.log(`Images uploaded to S3: ${fileName} and ${smallFileName}`);
    // Save metadata to DynamoDB (userId, fileName, date, prompt, ratio)
    await ddb.send(new PutCommand({
      TableName: Resource.Table.name,
      Item: {
        pk: `user#${userId}`,
        sk: `image#${fileName}`,
        date: now,
        prompt,
        ratio,
        smallFileName,
      },
    }));

    // Generate a signed URL for the uploaded image
    const command = new GetObjectCommand({
      Bucket: Resource.Bucket.name,
      Key: fileName,
    });
    const url = await getSignedUrl(bucket, command, { expiresIn: 3600 }); // 1 hour expiration

    return c.text(url, 200);
  } catch (error: any) {
    console.error(`ERROR: Can't invoke '${modelId}'. Reason: ${error.message}`);
    return c.text("Cannot generate image", 500);
  }
})

app.get('/images', async (c) => {
  const userId = c.get('user_id')
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
})

app.get('/image', async (c) => {
  const userId = c.get('user_id')
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
})


export const handler = handle(app)
