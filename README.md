# PowerOptima — Commercial Campus Energy & Cost Optimization Dashboard

PowerOptima is a general-purpose, web-based analytical application built for commercial buildings and multi-facility campuses (educational institutions, offices, research hospitals, and industrial parks). It processes electricity consumption intervals, analyzes diurnal demand patterns, forecasts future requirements using machine learning, estimates Time-of-Use (ToU) electricity expenditures, and generates practical, constrained load-shifting recommendations to achieve tangible cost reductions.

---

## 1. System Architecture & Features

### Core Modules
1. **Executive Overview (Page 1):** Holistic status of energy consumption (kWh), electricity spend (₹), blended average cost per kWh, next-day ML predicted volume, budget variance tracking, and building share distribution.
2. **Consumption Analysis (Page 2):** Diurnal hourly load profiles, weekday vs weekend comparisons, 7-day $\times$ 24-hour heatmaps, meter-level stacked distributions, peak demand ranking, box plots, and statistical anomaly alerts.
3. **Tariff and Cost Analysis (Page 3):** Visual 24-hour ToU schedule timelines (Peak, Normal, Off-Peak), cost disparity charts, current vs optimized bill comparisons, and rate sensitivity curves ($\pm 10\%, \pm 20\%, \pm 30\%$, and flat commercial tariffs).
4. **Energy Forecasting & Model Reliability (Page 4):** Next 24-hour and 7-day predictive trajectories with shaded 90% prediction intervals, chronological holdout evaluation (preventing temporal leakage), benchmark baseline comparison, predicted vs actual scatter ($y = x$), residuals vs predicted plot, residual histograms, and hourly error diagnostics.
5. **Weather, Occupancy & Equipment (Page 5):** Thermal cooling response scatter plots ($^{\circ}\text{C}$ vs kWh), headcount density correlations, Pearson correlation heatmaps, Energy Use Intensity ($\text{kWh}/\text{m}^2$), equipment runtime inventories, and feature importance bar plots.
6. **Optimization Recommendations (Page 6):** Constrained load shifting minimizing $\sum E_t R_t$, respecting rated power (kW), required runtime, and allowable operating windows. Includes baseline vs optimized load profiles, cost before & after, savings waterfall chart, equipment scheduling Gantt, and prioritized action tables.
7. **Data Ingestion & Quality Validation:** Mode A standardized CSV/Excel ingestion, interval detection, duplicate rejection, cumulative reading guards, and validation reporting.
8. **Google Account & Cloud History:** Google OAuth authentication via Firebase Auth and persistent cloud history and custom tariff configurations via Firestore.

---

## 2. Mathematical Formulas & Indicators

### Tariff Objective Function
$$\min \sum_{t=1}^{T} E_t R_t$$
Where:
- $E_t$: Electricity consumed in interval $t$ ($\text{kWh}$).
- $R_t$: Applicable electricity tariff in interval $t$ ($\text{₹}/\text{kWh}$).
- $T$: Number of intervals in planning horizon.

### Evaluation Metrics (Evaluated on Chronological Holdout)
- **Mean Absolute Error (MAE):** $\text{MAE} = \frac{1}{N} \sum_{i=1}^N |y_i - \hat{y}_i|$
- **Root Mean Squared Error (RMSE):** $\text{RMSE} = \sqrt{\frac{1}{N} \sum_{i=1}^N (y_i - \hat{y}_i)^2}$
- **Weighted Absolute Percentage Error (WAPE):** $\text{WAPE} = \frac{\sum |y_i - \hat{y}_i|}{\sum y_i} \times 100\%$
- **Goodness of Fit ($R^2$):** $R^2 = 1 - \frac{\sum (y_i - \hat{y}_i)^2}{\sum (y_i - \bar{y})^2}$

### Historical Forecast Reliability Score
$$S = 100 \times \max\left(0, 1 - \frac{\text{MAE}}{\bar{y}}\right) \times \text{penalty}(N)$$
*Note:* The dashboard labels this as a historical reliability indicator, not a guaranteed probability of future individual predictions.

### Prediction Intervals (90%)
Estimated from holdout residual quantiles $e_{0.05}$ and $e_{0.95}$:
$$[\hat{y} + e_{0.05}, \; \hat{y} + e_{0.95}]$$

---

## 3. Visualization Inventory

| Page | Visualization / Chart | Chart Type | Analytical Purpose |
|---|---|---|---|
| **Page 1** | Actual vs Forecasted Demand | Line Chart + Shaded Band | Compares recent consumption with 24h predictive horizon & 90% confidence envelope |
| **Page 1** | Daily Consumption & Spend | Dual-Axis Grouped Bar & Line | Tracks daily kWh demand paired with daily electricity bill in ₹ |
| **Page 1** | Building Energy Share | Donut Chart | Shows proportional energy consumption across campus facilities |
| **Page 1** | Budget vs Actual Cost | Progress Gauge & Variance | Monitors actual burn against monthly financial threshold |
| **Page 2** | Hourly Load Profile | Line Chart + Area Fill | Mean vs peak hourly load curves across the 24-hour cycle |
| **Page 2** | Weekday vs Weekend Profile | Dual Line Chart | Contrast between academic/business days and weekend baselines |
| **Page 2** | Day-of-Week vs Hour Heatmap | 7x24 Matrix Heatmap | Visualizes high-intensity energy demand times |
| **Page 2** | Building & Meter Distribution | Stacked Bar Chart | Incomer (HVAC) vs plug loads vs auxiliary meter allocations |
| **Page 2** | Distribution Histogram & Box Plot | Dual Histogram & Box Plot | Evaluates variance, skew, median, and IQR distribution |
| **Page 2** | Top Peak Demand Spikes | Ranked Interval Cards | Highlights peak demand intervals driving demand charges |
| **Page 2** | Anomaly Alerts Timeline | Event Timeline Cards | Flags statistical surges (> 2.6 Z-score) |
| **Page 3** | ToU Tariff Schedule Timeline | 24h Colored Segment Matrix | Visualizes Peak, Normal, and Off-Peak tariff windows |
| **Page 3** | Consumption vs Cost Disparity | Grouped Bar Chart | Highlights disproportionate cost weight during peak periods |
| **Page 3** | Current vs Optimized Cost | Comparative Bar Chart | Displays projected financial savings from load shifting |
| **Page 3** | Tariff Sensitivity Analysis | Dual Line Chart | Simulates cost across rate changes ($\pm 30\%$) and flat rate comparison |
| **Page 4** | 24h & 7d Predictive Horizon | Line Chart + Shaded Band | Future energy trajectory with 90% prediction intervals |
| **Page 4** | Holdout ML vs Baseline | Triple Line Chart | Compares ML model against naive previous-day baseline |
| **Page 4** | Predicted vs Actual Scatter | Scatter Plot + $y=x$ Reference | Tests calibration alignment along the 45-degree parity line |
| **Page 4** | Residuals vs Predicted | Scatter Plot | Evaluates homoscedasticity and zero-mean error |
| **Page 4** | Residual Error Histogram | Histogram | Confirms error symmetry and normal distribution |
| **Page 4** | Error by Hour of Day | Bar Chart | Discloses diurnal periods with higher forecasting error |
| **Page 5** | Temperature vs Consumption | Scatter Plot (Colored by °C) | Demonstrates non-linear HVAC cooling surge above 28°C |
| **Page 5** | Occupancy vs Consumption | Scatter Plot | Demonstrates relationship with building headcount |
| **Page 5** | Pearson Correlation Matrix | Heatmap | Quantifies relationships between energy, weather, and occupancy |
| **Page 5** | Specific Energy Use Intensity | Bar Chart | Normalized $\text{kWh}/\text{m}^2$ across campus buildings |
| **Page 5** | Equipment Inventory & Runtime | Grouped Bar & Dot Chart | Flexible vs critical assets, rated power (kW), and runtimes |
| **Page 5** | ML Feature Importance | Horizontal Bar Chart | Ranks features by weight in regression prediction |
| **Page 6** | Baseline vs Optimized Load | Shaded Area Comparison | Demonstrates peak shaving (09-12 & 18-22) and off-peak valley filling |
| **Page 6** | Before & After Cost Chart | Bar Chart | Visualizes monthly expenditure reduction in ₹ |
| **Page 6** | Savings Waterfall Chart | Waterfall Chart | Asset-by-asset contributions to bill reduction |
| **Page 6** | Equipment Scheduling Shifts | Timeline Cards | Current vs recommended operational windows |
| **Page 6** | Actionable Recommendation Table | Data Table with Badges | Full breakdown with constraints, priority, and feasibility |

---

## 4. Standard Input Schemas (Mode A)

### A. Electricity Meter Data (Mandatory)
```csv
timestamp,building_id,meter_id,energy_kwh,average_power_kw,meter_status
2026-11-01T09:00:00+05:30,B001,M001,42.5,42.5,normal
2026-11-01T10:00:00+05:30,B001,M001,48.2,48.2,normal
```

### B. Weather Data (Optional)
```csv
timestamp,location_id,temperature_c,humidity_pct,weather_condition
2026-11-01T09:00:00+05:30,LOC-CAMPUS-01,28.5,65,Sunny
```

### C. Occupancy Data (Optional)
```csv
timestamp,building_id,occupancy_count,occupancy_source
2026-11-01T09:00:00+05:30,B001,420,Access Turnstiles
```

### D. Equipment Data (Optional)
```csv
equipment_id,building_id,equipment_type,rated_power_kw,flexible_load,earliest_start_time,latest_end_time,required_runtime_minutes,operating_constraints
EQ-PUMP-01,B001,Booster Pump,45,true,00:00,23:59,240,Overhead tank target min 85%
```

---

## 5. Local Execution Instructions

To run the application locally:
```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev

# The web dashboard is available at http://localhost:3000
```

---

## 6. Vercel Deployment Instructions

This project is fully configured for zero-config deployment on Vercel (`vercel.json` included with SPA routing rewrites).

### Method A: Deploy via GitHub / Vercel Dashboard (Recommended)
1. Push this repository to GitHub or GitLab.
2. In the [Vercel Dashboard](https://vercel.com/new), click **Add New Project** and import the repository.
3. Framework Preset: **Vite** (auto-detected).
4. Build Command: `npm run build` (auto-detected).
5. Output Directory: `dist` (auto-detected).
6. Click **Deploy**.

### Authorizing Google Login on Vercel
After your app is deployed to Vercel (e.g. `https://your-project.vercel.app`):
1. Open the [Firebase Console](https://console.firebase.google.com).
2. Select your Firebase project.
3. Navigate to **Authentication** &rarr; **Settings** &rarr; **Authorized domains**.
4. Click **Add domain** and enter your Vercel deployment domain (e.g., `your-project.vercel.app`).
5. Now users can sign in with their Google account directly on your live Vercel URL!
*Note: If authorized domains are not configured yet, the app gracefully offers a 1-click **Guest / Demo Mode** with persistent browser storage so all features remain testable.*

### Optional: Vercel Environment Variables
If you wish to override the project's default Firebase credentials, you can add these in **Vercel Project Settings > Environment Variables**:
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_FIRESTORE_DATABASE_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`

### Method B: Deploy via Vercel CLI
```bash
# 1. Install Vercel CLI globally
npm i -g vercel

# 2. Deploy directly from repository root
vercel

# 3. For production release
vercel --prod
```
