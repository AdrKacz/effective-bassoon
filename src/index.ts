import { Resource } from "sst"
import { Hono } from 'hono'
import { handle } from 'hono/aws-lambda'
import { bearerAuth } from 'hono/bearer-auth'
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { subjects } from '../auth/subjects'
import { auth, ddb } from '../clients'
import { postImage } from './post/subscribed/image'
import { getImages } from './get/subscribed/images'
import { getImage } from './get/subscribed/image'
import { getUser } from './get/user'
import { User } from './types'
import { logger } from 'hono/logger'

export const customLogger = (message: string, ...rest: string[]) => {
  console.log(message, ...rest)
}

const app = new Hono<{ Variables: User }>()

app.use(logger(customLogger))

app.use(
  bearerAuth({
    verifyToken: async (token, c) => {
      customLogger(`Verifying token: ${token}`)
      const verified = await auth.verify(subjects, token)
      if (verified.err) {
        customLogger("Cannot verify token", JSON.stringify(verified.err))
        return false
      }
      c.set('id', verified.subject.properties.id)

      const user = await ddb.send(new GetCommand({
        TableName: Resource.Table.name,
        Key: {
          pk: `user#${verified.subject.properties.id}`,
          sk: 'metadata',
        },
      }))

      if (!user.Item) {
        customLogger(`ERROR: User not found: ${verified.subject.properties.id}`)
        return false
      }

      console.log("User: ", user.Item)
      if (typeof user.Item['subscription_end_date'] === 'string') {
        c.set('subscription_end_date', user.Item['subscription_end_date'])
      }

      try {
        c.set('remaining_credits', parseInt(user.Item['remaining_credits']?.value))
      } catch (error: any) {
        console.log(`ERROR: Cannot parse remaining_credits: ${error.message}`)
      }

      const email = user.Item['google_email'] // add other providers here
      if (typeof email === 'string') {
        c.set('email', email)
      }
      return true
    },
  })
)

app.use(
  '/subscribed/*',
  async (c, next) => {
    const subscriptionEndDate = new Date(c.get('subscription_end_date'))
    const now = new Date()
    if (subscriptionEndDate < now) {
      customLogger(`ERROR: User subscription has expired: ${c.get('id')}`)
      return c.text('Unauthorized', 401)
    }
    return next()
  },
)

app.post('/subscribed/image', postImage)
app.get('/subscribed/images', getImages)
app.get('/subscribed/image', getImage)
app.get('/user', getUser)

export const handler = handle(app)
