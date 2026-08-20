# Bitcoin Bottom Derby v46

## Live market-data repair

This production-safe update repairs the BTC widgets without changing the Supabase/Discord voting backend or any existing vote records.

- The header BTC price refreshes from the live public feed every minute.
- The percentage now shows the true trailing 24-hour BTC change instead of the change since the previous one-minute refresh.
- The mini chart is drawn from real recent hourly BTC prices instead of a decorative fixed line.
- The Depth Meter pointer now tracks the current BTC price in both directions.
- The official contest low remains separately locked and continues to control the Derby winner calculation.
- Coinbase remains the primary feed, with CoinGecko price and history fallbacks when Coinbase returns an outage page, invalid response, timeout, or other error.
- Browser caching is bypassed for the repaired app script so the update loads after deployment.

## Unchanged

- Contest ID: `bitcoin-bottom-derby-2026`
- Supabase schema and tables
- Discord authentication and membership verification
- Locked picks and public vote totals
- Racer artwork, animation frames, crowd, track, and approved visual package
