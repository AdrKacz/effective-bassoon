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
          profile: input?.stage === "production" ? undefined : "EffectiveBassoonDeveloper",
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
    const bucket = new sst.aws.Bucket("HonoBucket")
    const hono = new sst.aws.Function("Hono", {
      url: true,
      handler: "src/index.handler",
      link: [bucket],
      permissions: [
        {
          actions: ["bedrock:InvokeModel"],
          resources: ["arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-image-generator-v2:0"],
        },
      ]
    })

    const web = new sst.aws.StaticSite("HonoWeb", {
      build: {
        command: "npm run web:build",
        output: "web/dist",
      },
      errorPage: "404.html",
      indexPage: "index.html",
    });

    return {
      bucket: bucket.arn,
      hono: hono.url,
      web: web.url,
    }
  }
});
