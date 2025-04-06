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
    new sst.aws.Function("Hono", {
      url: true,
      handler: "src/index.handler",
    })
  },
});
