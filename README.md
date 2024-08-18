
## Coin Pricing

This series of applications allows us to price coins in our inventory. It does this via four sub-projects:

* `priceCoin` An application that uses Puppeteer to get some information from coin pricing websites, saving the results in a CSV
* `scraper` An application that can read a spreadsheet (CSV file) of coins in inventory and provide current pricing information based on a last-known scrape
* `priceMigrate` application that shuffles saved CSV files from S3 into a DynamoDB instance to allow for quicker historic price retrieval.
* `priceHistory` A NextJS application that provides a price history of an individual coin based on historical cached data

To use these, you will need to set the following environment variables:

* S3_BUCKET: The S3 bucket used to store raw coin pricing details
* S3_CONFIG_BUCKET: The S3 bucket used to store series information (configurations for the scraper)
* DYNAMODB_TABLE: The table to save coin pricing information to Dynamo
* COINURL: The website used by the `scraper` program to find coin prices
* PROOFSETURL: The website used by the `scraper` program to find proof coin set prices
