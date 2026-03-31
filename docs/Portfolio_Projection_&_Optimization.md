Here is the complete, end-to-end technical specification and implementation plan for the **Portfolio Projection & Optimization** feature.

---

### Phase 1: Product & UX Specification

This defines how the user interacts with the feature and the strict guardrails in place to prevent mathematical errors.

**1. Trigger & Constraints**

***The Button:** Located inside a specific portfolio silo, labeled **"Simulate Scenarios"** (avoids regulatory issues with "Generate Plan").

***Constraint 1 (Minimum Assets):** The button is completely disabled if the silo contains fewer than 2 assets (optimization requires $\ge2$ assets to calculate covariance).

***Constraint 2 (Minimum Age):** If *any* asset in the silo has been publicly traded for less than **3 months**, the button is disabled, and a tooltip explains: *"Simulation requires all assets to have at least 3 months of trading history."*

**2. The Output UI**

***Disclaimer:** Prominently displayed above the results: *"Simulation results are based on historical data and do not guarantee future performance. This tool is for educational purposes and does not constitute financial advice."*

***Results Table:** Displays three rows (strategies). Columns include:

    * Strategy Name

    * Suggested Asset Weights (e.g., AAPL: 40%, TSLA: 60%)

    * Expected 3-Month Return Range (Formatted as:`X.XX% ± Y.YY%`)

    * Action: An**"Apply Weights"** button for each row.

***Interaction:** Clicking "Apply Weights" automatically populates the user's target weight input fields for that silo. The simulation table remains visible after clicking.

***Dynamic Truncation Warning:** If the optimization algorithm was forced to use a timeframe of less than 3 years (36 months) due to a young asset, a prominent warning box must appear directly above or below the Results Table.

    **Format:* ⚠️ *"Note: Because **[limiting_ticker]** only has **[X]** months of trading history, this portfolio projection is limited to an **[X]**-month lookback period. Results may be highly volatile."*

---

### Phase 2: Data Engineering & Caching Architecture

To guarantee fast load times and avoid `yfinance` rate limits, we use a "Stale-While-Revalidate" caching layer in Supabase.

**1. Supabase Schema Setup**

Create a table named `asset_historical_data`:

*`ticker` (String, Primary Key)

*`historical_prices` (JSONB) - Array of objects containing date and closing price.

*`last_updated` (Timestamp)

**2. The Fetching Logic (The "Upsert" Method)**

When the backend requests data for a ticker:

1. Check Supabase for the `ticker`.
2. **Cache Hit:** If it exists AND `last_updated` is less than 24 hours old $\rightarrow$ Return Supabase data instantly.
3. **Cache Miss/Stale:** If it doesn't exist OR is older than 24 hours:

   * Fetch the last **5 years** of daily closing prices via `yfinance` (or max available if the asset is younger than 5 years).

   *`UPSERT` this new 5-year JSON array into Supabase, overwriting the old row and updating `last_updated` to `now()`.

   * Return the fresh data.

---

### Phase 3: The Mathematical Engine (Vercel Python Serverless API)

Your Next.js app will send a POST request with an array of tickers to a Vercel Python function (e.g., `/api/optimize.py`).

**1. Data Pre-Processing & Truncation**

* Convert the JSON price arrays into Pandas DataFrames.

***Dynamic Truncation:** Identify the asset with the shortest time-series data. Truncate the historical data of *all other assets* to match this shortest timeline exactly. This ensures the arrays are identical in length for the covariance matrix.

***Metadata Extraction:** When truncating the dataframes to match the youngest asset, calculate two specific variables:

    1.`limiting_ticker`: The string symbol of the asset that caused the truncation (e.g., "OKLO").

    2.`lookback_months`: The length of the truncated timeframe in months (e.g., 8).

***Modify the API Response:** Instead of just returning the 3 strategies, the Python API must return a structured JSON object that includes this metadata so the frontend can read it.

    **Example JSON Return:*

    ```json

    {

    "strategies": { ... },

    "metadata": {

    "is_truncated_below_3_years": true,

    "limiting_ticker": "OKLO",

    "lookback_months": 8

    }

    }

    ```

**2. Foundational Calculations**

Calculate the daily percentage returns, then annualize them:

***Mean Returns Vector ($\mu$):** The annualized expected return for each asset.

***Covariance Matrix ($\Sigma$):** The annualized risk and correlation between all assets.

**3. Optimization Algorithms (`scipy.optimize`)**

Run three separate optimization bounds, where weights ($w$) must sum to 1, and $0\le w_i \le1$.

***Strategy 1: "Not to Lose" (Global Minimum Volatility)**

    **Objective:* Minimize portfolio variance: $w^T \Sigma w$

    **Output:* The safest mathematical combination of the silo's assets.

***Strategy 2: "Expected" (Maximum Sharpe Ratio)**

    **Objective:* Minimize the negative Sharpe Ratio: $-\frac{w^T \mu - R_f}{\sqrt{w^T \Sigma w}}$

    **(Assume Risk-Free Rate $R_f = 0.04$)*

    **Output:* The optimal risk-adjusted portfolio.

***Strategy 3: "Optimistic" (Target Risk)**

    **Objective:* Maximize return ($w^T \mu$) with a constraint.

    **Constraint:* Portfolio volatility ($\sqrt{w^T \Sigma w}$) must not exceed $1.5\times$ the volatility of the Maximum Sharpe portfolio.

    **Output:* An aggressive, growth-focused allocation that remains diversified.

**4. 3-Month Projection Math**

For each optimized strategy, calculate the 3-month projection for the UI:

* 3-Month Expected Return = $(w^T \mu) \times\frac{3}{12}$
* 3-Month Volatility ($\sigma_{\text{3m}}$) = $\sqrt{w^T \Sigma w} \times\sqrt{\frac{3}{12}}$
* The UI Range String = `[3-Month Return]% ± [2 * 3-Month Volatility]%` (representing the 95% confidence interval).

---

### Phase 4: Frontend State Management (Next.js)

To prevent the user from spamming the backend and wasting compute resources.

**1. State Tracking**

* Use a React `useRef` or state variable to store a sorted, comma-separated string of the currently simulated assets (e.g., `lastSimulatedState = "AAPL,TSLA"`).

**2. Execution Flow**

* User clicks "Simulate Scenarios".
* Generate the current asset string (e.g., `"AAPL,TSLA"`).

***Check:** Does `currentState` === `lastSimulatedState`?

    ***Yes:** Do nothing. Fire a toast notification: *"Asset composition hasn't changed since last simulation."*

    ***No:** Proceed with API call to `/api/optimize`, show a loading spinner, and upon success, update `lastSimulatedState` and render the results table.

---

### Phase 5: Step-by-Step Execution Plan (How to build it)

1. **Step 1: Database Foundation.** Create the `asset_historical_data` table in Supabase.
2. **Step 2: Python API Setup.** Create the `/api/optimize.py` file in Vercel. Write the basic logic to receive a list of tickers and return a dummy JSON response. Ensure Next.js can talk to this endpoint.
3. **Step 3: Data Fetching Script.** Inside the Python API, implement the `yfinance` 5-year fetch and the Supabase `UPSERT` logic. Test it thoroughly to ensure it correctly reads from the cache on the second click.
4. **Step 4: The Math Engine.** Add `scipy` and `pandas`. Implement the truncation logic, calculate $\mu$ and $\Sigma$, and write the three optimization functions. Return the final weights and ranges as JSON.
5. **Step 5: Frontend UI.** Build the "Simulate Scenarios" button, the constraints logic (< 2 assets, < 3 months old), and the React state management to prevent redundant API calls.
6. **Step 6: Integration & Wiring.** Connect the UI table to the real API response. Wire up the "Apply Weights" button to update your existing Rebalancify calculator inputs.

**Addition:* Wire up conditional rendering for the Truncation Warning. Read the `metadata` object from the `/api/optimize` response. If `is_truncated_below_3_years` is true, dynamically inject the `limiting_ticker` and `lookback_months` into the warning banner text and render it on the screen.
