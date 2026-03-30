# Modern Portfolio Theory

## Overview

Modern Portfolio Theory (MPT) is a mathematical framework for constructing investment portfolios that seeks to maximize expected return for a given level of risk, or equivalently to minimize risk for a given expected return. Developed by Harry Markowitz in 1952, MPT introduced a rigorous approach to diversification that fundamentally changed how investors think about portfolio construction.

The central insight of MPT is that the risk of a portfolio is not simply the weighted average of the individual asset risks. Because assets are not perfectly correlated with one another, combining them in a portfolio can reduce overall volatility below what any single asset achieves. This reduction in risk without a proportional reduction in return is the mathematical basis for diversification.

## Core Concepts

**Expected Return:** The anticipated return of a portfolio is the weighted average of the expected returns of its constituent assets. If an asset represents 30% of a portfolio and has an expected return of 10%, it contributes 3% to the total expected return.

**Variance and Standard Deviation:** MPT measures risk as the statistical variance (or its square root, standard deviation) of portfolio returns. A portfolio with higher variance has wider fluctuations in returns over time, meaning its actual outcomes are less predictable.

**Covariance and Correlation:** The covariance between two assets measures how their returns move together. A positive covariance means both assets tend to rise and fall at the same time. A negative covariance means they tend to move in opposite directions. Correlation normalises this into a value between -1 and +1, where -1 is perfect inverse movement and +1 is perfect co-movement. Assets with low or negative correlation provide the greatest diversification benefit.

**The Portfolio Variance Formula:** For a two-asset portfolio with weights w1 and w2, expected returns r1 and r2, standard deviations σ1 and σ2, and correlation ρ12, the portfolio variance is:

σ²_p = w1²σ1² + w2²σ2² + 2·w1·w2·σ1·σ2·ρ12

When ρ12 is less than 1, the portfolio variance is less than the weighted average of the individual variances. This is the mathematical proof of diversification's benefit.

## The Efficient Frontier

The efficient frontier is a curve on a risk-return graph that represents the set of portfolios offering the highest expected return for each level of risk. Portfolios that fall below the efficient frontier are said to be inefficient — they could be improved by either increasing return or decreasing risk without sacrificing the other. Portfolios above the efficient frontier are theoretically unattainable.

Constructing the efficient frontier requires knowing (or estimating) three inputs for each asset: expected return, standard deviation, and pairwise correlations with every other asset. In practice, these inputs are estimated from historical data, introducing significant estimation error.

## The Role of the Risk-Free Asset

When a risk-free asset (such as short-term government bonds) is added to the analysis, the efficient frontier extends into a straight line called the Capital Market Line (CML). Every investor, regardless of risk preference, should hold the same risky portfolio — the market portfolio — combined in varying proportions with the risk-free asset. More risk-tolerant investors hold more of the market portfolio; more cautious investors hold more of the risk-free asset.

This result is the origin of the recommendation to hold broad market index funds. Under MPT's assumptions, the market portfolio represents the optimal bundle of risky assets for all investors.

## Capital Asset Pricing Model Connection

The Capital Asset Pricing Model (CAPM) builds directly on MPT. It defines beta (β) as a measure of an asset's systematic risk relative to the market portfolio. An asset with β = 1 moves in line with the market; β > 1 implies amplified movements; β < 1 implies dampened movements.

Under CAPM, the expected return of any asset is:

Expected Return = Risk-Free Rate + β × (Market Return − Risk-Free Rate)

The term in parentheses is the equity risk premium — the additional return demanded by investors for bearing market risk. CAPM implies that only systematic (undiversifiable) risk is compensated, while idiosyncratic (company-specific) risk can be eliminated by holding a diversified portfolio.

## Criticisms and Limitations

MPT has been extensively criticised despite its theoretical elegance. Key limitations include:

- **Mean-variance assumptions:** MPT assumes that risk is fully captured by variance. In reality, investors also care about skewness (asymmetry of returns) and kurtosis (fat tails — the frequency of extreme outcomes).
- **Correlation instability:** Correlations between assets are not stable over time. During market crises, correlations typically spike toward 1.0, eliminating much of the diversification benefit precisely when it is most needed.
- **Estimation error:** Small errors in estimated expected returns can produce large changes in the optimal portfolio weights. This makes the efficient frontier highly sensitive to input assumptions.
- **Normal distribution assumption:** MPT assumes returns are normally distributed. Empirical evidence shows that asset returns have fat tails — large losses occur more frequently than the normal distribution would predict.
- **No transaction costs or taxes:** The model assumes frictionless markets. In practice, trading costs and tax consequences affect the optimal rebalancing strategy.

Despite these criticisms, MPT remains the conceptual foundation of modern institutional portfolio management and is the starting point for all more sophisticated portfolio construction frameworks.

## Practical Implications for Portfolio Construction

For a retail investor building a rebalanced portfolio, MPT offers several actionable principles:

- Diversify across asset classes with low mutual correlation (equities, bonds, real assets, cash equivalents).
- Focus on the risk-return trade-off of the whole portfolio, not on individual asset performance in isolation.
- Recognise that adding a volatile asset to a portfolio can reduce overall portfolio volatility if that asset is sufficiently uncorrelated with existing holdings.
- Use historical correlations as a starting point, but do not treat them as fixed — stress-test the portfolio under scenarios of elevated correlation.

## Sources

- Markowitz, H. (1952). Portfolio Selection. *Journal of Finance*, 7(1), 77–91.
- Sharpe, W. F. (1964). Capital Asset Prices: A Theory of Market Equilibrium Under Conditions of Risk. *Journal of Finance*, 19(3), 425–442.
- Merton, R. C. (1972). An Analytic Derivation of the Efficient Portfolio Frontier. *Journal of Financial and Quantitative Analysis*, 7(4), 1851–1872.
- Bodie, Z., Kane, A., & Marcus, A. J. (2023). *Investments* (13th ed.). McGraw-Hill.
