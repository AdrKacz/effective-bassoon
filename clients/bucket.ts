import { S3Client } from "@aws-sdk/client-s3"

export const bucket = new S3Client({ region: 'eu-west-3' })