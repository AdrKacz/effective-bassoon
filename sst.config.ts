/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "effective-bassoon",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
      providers: {
        aws: {
          profile: input?.stage === "production" ? "EffectiveBassoonDeveloper" : "EffectiveBassoonDeveloper",
          region: 'eu-west-3',
          defaultTags: {
            tags: {
              "app": "effective-bassoon",
              "stage": input?.stage,
            }
          }
        }
      }
    };
  },
  async run() {
    const domain = "le-studio-k.fr"
    const hostedZone = new sst.Secret('HostedZone')
    const googleClientID = new sst.Secret('GoogleClientID')
    const googleClientSecret = new sst.Secret('GoogleClientSecret')
    const stripeAPIKey = new sst.Secret('StripeAPIKey')
    const stripeEndpointSecret = new sst.Secret('StripeEndpointSecret')

    const stripeDecouvertePaymentLink = new sst.Secret("StripeDecouvertePaymentLink")
    const stripeCreatifPaymentLink = new sst.Secret("StripeCreatifPaymentLink")
    const stripeInspirationPaymentLink = new sst.Secret("StripeInspirationPaymentLink")

    const umamiWebsiteId = new sst.Secret('UmamiWebsiteId')

    const facebookConversionApiToken = new sst.Secret('FacebookConversionApiToken')
    const facebookPixelId = new sst.Secret('FacebookPixelId')

    const bucket = new sst.aws.Bucket("Bucket")

    const table = new sst.aws.Dynamo("Table", {
      fields: { pk: "string", sk: "string" },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
    })

    const auth = new sst.aws.Auth("Auth", {
      issuer: {
        handler: "auth/index.handler",
        link: [table, googleClientID, googleClientSecret, facebookConversionApiToken, facebookPixelId],
      },
      domain: $app.stage === "production" ? `auth.${domain}` : undefined,
    })

    const hono = new sst.aws.Function("Hono", {
      url: {
        cors: {
          allowHeaders: ["Authorization", "Content-Type"],
          allowOrigins: $app.stage === "production" ? [`https://${domain}`] : [`https://local.${domain}`],
        }
      },
      handler: "src/index.handler",
      link: [bucket, table, auth],
      timeout: "1 minute",
      permissions: [
        {
          actions: ["bedrock:InvokeModel"],
          resources: [
            "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-image-generator-v2:0",
            "arn:aws:bedrock:us-east-1::foundation-model/meta.llama3-3-70b-instruct-v1:0",
            "arn:aws:bedrock:us-east-2::foundation-model/meta.llama3-3-70b-instruct-v1:0",
            "arn:aws:bedrock:us-west-2::foundation-model/meta.llama3-3-70b-instruct-v1:0",
            "arn:aws:bedrock:us-east-1:211125769209:inference-profile/us.meta.llama3-3-70b-instruct-v1:0"
          ],
        },
      ]
    })

    const stripe = new sst.aws.Function("Stripe", {
      url: true,
      handler: "stripe/index.handler",
      link: [table, stripeAPIKey, stripeEndpointSecret],
    })

    const web = new sst.aws.StaticSite("Web", {
      build: {
        command: "npm run web:build",
        output: "web/dist",
      },
      dev: {
        command: "npm run web:dev",
      },
      errorPage: "404.html",
      indexPage: "index.html",
      environment: {
        VITE_API_URL: hono.url,
        VITE_AUTH_URL: auth.url,
        VITE_STRIPE_DECOUVERTE_PAYMENT_LINK: stripeDecouvertePaymentLink.value,
        VITE_STRIPE_CREATIF_PAYMENT_LINK: stripeCreatifPaymentLink.value,
        VITE_STRIPE_INSPIRATION_PAYMENT_LINK: stripeInspirationPaymentLink.value,
        VITE_UMAMI_WEBSITE_ID: umamiWebsiteId.value,
      },
      domain: $app.stage === "production" ? {
        name: domain,
        redirects: [`www.${domain}`],
        dns: sst.aws.dns({ zone: hostedZone.value }),
      } : undefined,
    });

    return {
      bucket: bucket.arn,
      hono: hono.url,
      web: web.url,
      auth: auth.url,
      stripe: stripe.url,
    }
  }
});
