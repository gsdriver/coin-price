
## Coin Pricing

This series of applications allows us to price coins in our inventory. It does this via four sub-projects:

* `priceCoin` An application that uses Puppeteer to get some information from coin pricing websites, saving the results in a CSV
* `scraper` An application that can read a spreadsheet (CSV file) of coins in inventory and provide current pricing information based on a last-known scrape
* `priceMigrate` application that shuffles saved CSV files from S3 into a DynamoDB instance to allow for quicker historic price retrieval.
* `priceHistory` A NextJS application that provides a price history of an individual coin based on historical cached data
