import { SSTConfig } from "sst";
import { NextjsSite } from "sst/constructs";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";

export default {
  config(_input) {
    return {
      name: "coin-price-history",
      region: "us-west-2",
    };
  },
  stacks(app) {
    app.stack(function Site({ stack }) {
      const site = new NextjsSite(stack, "site", {
        environment: {
          S3_BUCKET: "garrett-coin-prices",
          S3_CONFIG_BUCKET: "garrett-configs-us-west-2",
          DYNAMODB_TABLE: "CoinPrices",
        },
      });

      // Read-only access to the coin price CSV files written by the scraper
      site.attachPermissions([
        new PolicyStatement({
          actions: ["s3:GetObject"],
          resources: ["arn:aws:s3:::garrett-coin-prices/*"],
        }),
        // Read + write access for the series list cache JSON
        new PolicyStatement({
          actions: ["s3:GetObject", "s3:PutObject"],
          resources: ["arn:aws:s3:::garrett-configs-us-west-2/coin-price-history/*"],
        }),
        // Query and scan the historical price records
        new PolicyStatement({
          actions: ["dynamodb:Query", "dynamodb:Scan"],
          resources: [
            `arn:aws:dynamodb:${stack.region}:${stack.account}:table/CoinPrices`,
          ],
        }),
      ]);

      stack.addOutputs({
        SiteUrl: site.url,
      });
    });
  },
} satisfies SSTConfig;
