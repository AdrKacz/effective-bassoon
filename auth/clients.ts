import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";


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