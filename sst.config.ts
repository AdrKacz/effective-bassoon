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

    const bucket = new sst.aws.Bucket("Bucket")

    const table = new sst.aws.Dynamo("Table", {
      fields: { pk: "string", sk: "string" },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
    })

    const auth = new sst.aws.Auth("Auth", {
      issuer: {
        handler: "auth/index.handler",
        link: [googleClientID, googleClientSecret],
      },
      domain: $app.stage === "production" ? `auth.${domain}` : undefined,
    })

    const hono = new sst.aws.Function("Hono", {
      url: true,
      handler: "src/index.handler",
      link: [bucket, auth, table],
      permissions: [
        {
          actions: ["bedrock:InvokeModel"],
          resources: ["arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-image-generator-v2:0"],
        },
      ]
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
    }
  }
});
