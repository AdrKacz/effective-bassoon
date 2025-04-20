import { Resource } from "sst"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime"
import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { Jimp } from 'jimp'
import { ddb, bucket } from "../../../clients";
import { Context } from "hono";
import { User } from '../../types'
import { native } from "bun:sqlite";

// Bedrock only supports Titan v2 in us-east-1 and us-west-2
// https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html
const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });
const modelId = 'amazon.titan-image-generator-v2:0'
const llamaModelId = 'us.meta.llama3-3-70b-instruct-v1:0'

// Negative prompt to avoid complex images that the model can't handle
// const negativePrompt = "realistic face, visible eyes, fingers, photorealism, 3D, fine details, intricate textures, complex clothing, detailed skin, facial expressions, realistic anatomy, soft lighting, shadows, reflections, cluttered background, ornate elements, blur, noise, overexposure, transparent parts, pores, wrinkles, makeup, soft gradients"

const llamaPromptTemplate = `<|begin_of_text|><|start_header_id|>user<|end_header_id|>
You will be given a prompt, you will perform the following tasks and return the enhanced prompt only:
{tasks}
Input: {prompt}
<|eot_id|>
<|start_header_id|>assistant<|end_header_id|>
Output:
`

async function enhancePrompt(prompt: string) {

    const tasks = ["Translate the prompt to English if it is not in English."]
    if (prompt.length > 512) {
        tasks.push("Shorten the prompt to 512 characters or less. Keep as much information as possible.")
    }
    tasks.push("Enhance the prompt using best practices for image generation.")

    let tasksString = ""
    for (let i = 0; i < tasks.length; i++) {
        tasksString += `${i + 1}. ${tasks[i]}`
        if (i < tasks.length - 1) {
            tasksString += "\n"
        }
    }

    // https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-runtime_example_bedrock-runtime_InvokeModel_MetaLlama3_section.html
    const request = {
        prompt: llamaPromptTemplate.replace("{tasks}", tasksString).replace("{prompt}", prompt),
        // Optional inference parameters:
        max_gen_len: 512,
        temperature: 0.5,
        top_p: 0.9,
    };

    const response = await bedrock.send(new InvokeModelCommand({
        modelId: llamaModelId,
        body: JSON.stringify(request),
        contentType: 'application/json',
    }));

    const nativeResponse = JSON.parse(new TextDecoder().decode(response.body));

    const responseText = nativeResponse.generation;
    return responseText
}

export async function postImage(c: Context<{ Variables: User }>) {
    const userId = c.get('id')
    if (!userId) {
        return c.text('Unauthorized', 401)
    }
    const remainingCredits = c.get('remaining_credits')
    if (typeof remainingCredits !== 'number' || remainingCredits <= 0) {
        return c.text('Not enough credits', 402)
    }

    const body = await c.req.json()
    if (!body || !body.prompt || !body.ratio) {
        return c.text('Missing required fields: prompt, ratio', 400)
    }
    const prompt = body.prompt
    if (typeof prompt !== 'string') {
        return c.text('Prompt must be a string', 400)
    }

    const enhancedPrompt = await enhancePrompt(prompt)
    console.log(`Enhanced prompt: ${enhancedPrompt}`)
    if (enhancedPrompt.length > 512) {
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
            text: enhancedPrompt,
            // negativeText: negativePrompt,
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
        const smallImage = await Jimp.fromBuffer(imageBuffer)
        smallImage.cover({ h: 300, w: 300 })
        const smallImageBuffer = await smallImage.getBuffer("image/png")
        const now = (new Date()).toISOString()
        const fileName = `users/${userId}/images/${now}.png`;
        const smallFileName = `users/${userId}/images/${now}-small.png`;

        await Promise.all([
            bucket.send(new PutObjectCommand({
                Bucket: Resource.Bucket.name,
                Key: fileName,
                Body: imageBuffer,
                ContentType: 'image/png',
            })),
            bucket.send(new PutObjectCommand({
                Bucket: Resource.Bucket.name,
                Key: smallFileName,
                Body: smallImageBuffer,
                ContentType: 'image/png',
            }))
        ])
        console.log(`Images uploaded to S3: ${fileName} and ${smallFileName}`);

        const outputs = await Promise.all([
            // Save metadata to DynamoDB (userId, fileName, date, prompt, ratio)
            ddb.send(new PutCommand({
                TableName: Resource.Table.name,
                Item: {
                    pk: `user#${userId}`,
                    sk: `image#${fileName}`,
                    date: now,
                    prompt,
                    ratio,
                    smallFileName,
                },
            })),
            // Generate a signed URL for the uploaded image
            getSignedUrl(bucket, new GetObjectCommand({
                Bucket: Resource.Bucket.name,
                Key: fileName,
            }), { expiresIn: 3600 }), // 1 hour expiration
            // Remove 1 to remaining credits
            ddb.send(new UpdateCommand({
                TableName: Resource.Table.name,
                Key: {
                    pk: `user#${userId}`,
                    sk: 'metadata',
                },
                UpdateExpression: 'ADD #remaining_credits :credits',
                ExpressionAttributeNames: {
                    '#remaining_credits': 'remaining_credits',
                },
                ExpressionAttributeValues: {
                    ':credits': -1,
                },
                ReturnValues: 'ALL_NEW',
            }))
        ]);
        const url = outputs[1]
        console.log(`Signed URL: ${url}`);

        // Remove 1 to remaining credits
        const user = outputs[2]
        console.log(`Remaining credits for user ${userId}: ${user.Attributes?.remaining_credits?.value}`);

        return c.json({
            remaining_credits: user.Attributes?.remaining_credits?.value,
            url,
            prompt: prompt,
            ratio,
            date: now,
        });
    } catch (error: any) {
        console.error(`ERROR: Can't invoke '${modelId}'. Reason: ${error.message}`);
        if (error.message.includes('AUP or AWS Responsible AI Policy')) {
            return c.text("This prompt violates our terms of service.", 400);
        }
        return c.text("Cannot generate image", 500);
    }
}