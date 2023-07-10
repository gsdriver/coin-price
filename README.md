
## Coin Pricing

This series of applications allows us to price coins in our inventory. It does this via three sub-projects:

* An application that uses Puppeteer to get some information from coin pricing websites, saving the results in a CSV
* An application that can read a spreadsheet (CSV file) of coins in inventory and provide current pricing information based on a last-known scrape
* A NextJS application that provides a price history of an individual coin based on historical cached data
