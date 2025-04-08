import { Context } from "hono";
import { User } from '../types'

export async function getUser(c: Context<{ Variables: User }>) {
    const userId = c.get('user_id')
    if (!userId) {
        return c.text('Unauthorized', 401)
    }
    if (typeof c.get('subscription_end_date') !== 'string') {
        return c.text('Unauthorized', 401)
    }
    const subscriptionEndDate = new Date(c.get('subscription_end_date'))
    return c.json({
        email: "test@helzzlo.com",
        remaining_credits: c.get('remaining_credits'),
        is_subscribed: subscriptionEndDate > new Date(),
    })
}