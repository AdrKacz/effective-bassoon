import { Resource } from "sst";
import { Hono } from 'hono'
import { handle } from 'hono/aws-lambda'
import { ddb } from '../clients/ddb'
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import Stripe from 'stripe'

const updateExpression = `SET #stripe_subscription = :subscription,
#remaining_credits = :remaining_credits,
#subscription_end_date = :subscription_end_date,
#stripe_customer = :stripe_customer,
#stripe_customer_email = :stripe_customer_email,
#stripe_customer_name = :stripe_customer_name`

const stripe = new Stripe(Resource.StripeAPIKey.value)
const endpointSecret = Resource.StripeEndpointSecret.value

const app = new Hono()

app.post('/webhook', async (c) => {
    let event: Stripe.Event
    // Only verify the event if you have an endpoint secret defined.
    // Otherwise use the basic event deserialized with JSON.parse
    if (endpointSecret) {
        const signature = c.req.header('stripe-signature')!
        const buffer = await c.req.arrayBuffer()
        const rawBody = Buffer.from(buffer).toString()
        try {
            console.log(`A. Verifying webhook signature: ${signature}`)
            console.log("B. Raw body: ", rawBody)
            event = stripe.webhooks.constructEvent(rawBody, signature, endpointSecret)
        } catch (err: any) {
            console.log(`⚠️  Webhook signature verification failed.`, err.message)
            return c.text('Webhook Error', 400)
        }
    } else {
        return c.text('Missing endpoint', 400)
    }

    // Handle the event
    switch (event.type) {
        case 'invoice.payment_succeeded':
            console.log('Payment succeeded')
            console.log(JSON.stringify(event))
            const invoice = event.data.object as Stripe.Invoice

            const customer = invoice.customer as string
            const customerEmail = invoice.customer_email as string
            const customerName = invoice.customer_name as string
            const customerPhone = invoice.customer_phone as string | undefined
            // const invoiceDocument = invoice.invoice_pdf as string // TODO: Send this document by email to the user
            const status = invoice.status as string
            if (status !== 'paid') {
                console.log(`Invoice is not paid: ${status}`)
                return c.text('Invoice is not paid', 400)
            }
            const total = invoice.total as number
            const currency = invoice.currency as string

            if (currency !== 'eur') {
                console.log(`Currency is not EUR: ${currency}`)
                return c.text('Currency is not EUR', 400)
            }


            const subscription = invoice.parent?.subscription_details?.subscription as string | undefined
            const paidAt = invoice.status_transitions?.paid_at as number | undefined

            if (typeof subscription !== 'string' || typeof paidAt !== 'number') {
                console.log(`Subscription or paidAt is not a string or number`)
                return c.text('Invalid subscription or paidAt', 400)
            }

            const user = await ddb.send(new GetCommand({
                TableName: Resource.Table.name,
                Key: {
                    pk: `user#${customerEmail}`,
                    sk: 'metadata',
                },
            }))
            if (!user.Item) {
                console.log(`User not found: ${customerEmail}`)
                return c.text('User not found', 404)
            }

            // If stripe_subscription is empty, we consider it's a first time subscription
            // If it's a first time subscription and the total paid is 0 eur, we consider it's a free trial
            // We add 10 to remaining_credits and set subscription_end_date to paidAtDate + 8 days (extra days in case of delay)
            if (total === 0 && typeof user.Item.stripe_subscription === 'undefined') {
                console.log(`${customerEmail} is a new user and paid 0 eur: adding 10 credits for free trial`)
                const subscriptionEndDate = new Date(paidAt * 1000 + 8 * 24 * 60 * 60 * 1000).toISOString()
                const expressionAttributeNames: any = {
                    '#stripe_subscription': 'stripe_subscription',
                    '#remaining_credits': 'remaining_credits',
                    '#subscription_end_date': 'subscription_end_date',
                    '#stripe_customer': 'stripe_customer',
                    '#stripe_customer_email': 'stripe_customer_email',
                    '#stripe_customer_name': 'stripe_customer_name',
                }
                const expressionAttributeValues: any = {
                    ':subscription': subscription,
                    ':remaining_credits': 10,
                    ':subscription_end_date': subscriptionEndDate,
                    ':stripe_customer': customer,
                    ':stripe_customer_email': customerEmail,
                    ':stripe_customer_name': customerName,
                }
                if (typeof customerPhone === 'string') {
                    expressionAttributeNames['#stripe_customer_phone'] = 'stripe_customer_phone'
                    expressionAttributeValues[':stripe_customer_phone'] = customerPhone
                }
                await ddb.send(new UpdateCommand({
                    TableName: Resource.Table.name,
                    Key: {
                        pk: `user#${customerEmail}`,
                        sk: 'metadata',
                    },
                    UpdateExpression: updateExpression,
                    ExpressionAttributeNames: expressionAttributeNames,
                    ExpressionAttributeValues: expressionAttributeValues,
                }))
            } else if (total === 1000) { // Else, if the total paid is 10 eur, we add 100 to remaining_credits and set subscription_end_date to paidAtDate + 32 days (extra days in case of delay)
                console.log(`${customerEmail} paid 10 eur: adding 100 credits`)
                const subscriptionEndDate = new Date(paidAt * 1000 + 32 * 24 * 60 * 60 * 1000).toISOString()
                await ddb.send(new UpdateCommand({
                    TableName: Resource.Table.name,
                    Key: {
                        pk: `user#${customerEmail}`,
                        sk: 'metadata',
                    },
                    UpdateExpression: 'SET #subscription_end_date = :end_date ADD #remaining_credits :credits',
                    ExpressionAttributeNames: {
                        '#subscription_end_date': 'subscription_end_date',
                        '#remaining_credits': 'remaining_credits',
                    },
                    ExpressionAttributeValues: {
                        ':end_date': subscriptionEndDate,
                        ':credits': 100,
                    },
                }))
            } else if (total === 2000) { // Else, if the total paid is 20 eur, we add 300 to remaining_credits and set subscription_end_date to paidAtDate + 32 days (extra days in case of delay)
                console.log(`${customerEmail} paid 20 eur: adding 300 credits`)
                const subscriptionEndDate = new Date(paidAt * 1000 + 32 * 24 * 60 * 60 * 1000).toISOString()
                await ddb.send(new UpdateCommand({
                    TableName: Resource.Table.name,
                    Key: {
                        pk: `user#${customerEmail}`,
                        sk: 'metadata',
                    },
                    UpdateExpression: 'SET #subscription_end_date = :end_date ADD #remaining_credits :credits',
                    ExpressionAttributeNames: {
                        '#subscription_end_date': 'subscription_end_date',
                        '#remaining_credits': 'remaining_credits',
                    },
                    ExpressionAttributeValues: {
                        ':end_date': subscriptionEndDate,
                        ':credits': 300,
                    },
                }))
            } else {
                console.log(`Unknown amount paid: ${total} eur`)
                return c.text('Unknown amount paid', 400)
            }
            break
        default:
            console.log(`Unhandled event type ${event.type}`)
    }
    // Return a 200 response to acknowledge receipt of the event
    return c.text('Webhook received', 200)
})

export const handler = handle(app)