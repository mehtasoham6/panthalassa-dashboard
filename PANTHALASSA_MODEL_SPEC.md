---
title: "Panthalassa Wave-Powered Data-Center Model"
subtitle: "Human-readable calculation guide with an exact coding-agent implementation reference"
date: "July 2026"
---

# Implementation scope for the coding agent

Implement the mathematical and functional model exactly as specified in this document. The equations, assumptions, constants, slider definitions, units, calculation order, failure rules, service rules, boundary conditions, and required outputs are fixed. Do not omit, reinterpret, simplify, or replace any part of the model, and do not introduce alternative approximations. The implementation must reproduce the worked examples and regression checks within the stated tolerances.

Discretion is limited to the user interface: layout, styling, visual hierarchy, charts, controls, responsive behavior, and how the specified outputs are presented. Every specified slider and user-facing input must be included. The principal capacity, fleet-size, cost, and performance outputs must be displayed prominently.

# How to read this document

This document describes the same model as the earlier explicit specification, but in the order a person would naturally calculate it. The main body follows one node from port, through transit and operation, through failures and service, and finally into fleet sizing and cost.

For every important calculation, the document gives:

1. a plain-English explanation;
2. a human-readable equation in LaTeX-style mathematical notation; and
3. the exact implementation expression using the code-variable names.

The human equation and the implementation expression describe the same calculation. The code expression is included so that the coding agent does not have to translate descriptive symbols into new variables.

The production model is **analytical and deterministic**. It does not use hourly or daily simulation and does not use Monte Carlo draws. Numerical quadrature is used only to evaluate a few one-dimensional chip-failure integrals.

# 1. The model in six steps

The model answers six ordinary questions:

| Step | Question | Main result |
| --- | --- | --- |
| 1 | How much compute output does one node produce during transit, sea-park operation, and planned service? | Scheduled output from one operating node slot |
| 2 | How much output is lost to chip failures and other node failures? | Expected delivered output from one operating node slot |
| 3 | How many operating node slots are needed to meet the target? | Operating fleet size |
| 4 | How many physical nodes and replacement components must be purchased? | Planned purchases and replacement quantities |
| 5 | What do the nodes, compute, service, failures, and replacements cost? | Undiscounted lifecycle cost |
| 6 | What are the present-value and unit-cost outputs? | PV cost, cost per watt, and levelized cost |

The calculation flows in one direction:

> Slider values -> one node's scheduled output -> expected failure losses -> delivered output per node slot -> required fleet -> purchases and costs -> dashboard results.

An **operating node slot** means one place in the required fleet. A physical node may temporarily leave that slot for service or may be replaced, but the model asks how much output that continuously required slot delivers over the full analysis period.

# 2. Inputs that control the result

The dashboard exposes fifteen sliders. The main physical defaults are a 200 kW compute payload, a 20 m hull, a sea park 1,500 km from port, annual payload service, a 1% annual chip-failure hazard per 2 kW block, and a 1.9% annual aggregate rate for other node failures.

The complete slider table is reproduced in Appendix A.1. The calculation below uses descriptive symbols, while the implementation boxes use the exact slider names.

## 2.1 The few derived quantities used repeatedly

### Best-effort and guaranteed capacity

The hot-spare share does not add hardware. It divides the fixed installed payload into a guaranteed share and a best-effort share. Healthy best-effort hardware still produces useful output; it simply absorbs failures before guaranteed capacity is affected.

$$
\text{Best-effort capacity}
=
\text{Installed payload}
\times
\text{Hot-spare share}
$$

```python
best_effort_capacity_kw = hot_spare_fraction * payload_rating_kw
```

$$
\text{Guaranteed capacity}
=
\text{Installed payload}
-
\text{Best-effort capacity}
$$

```python
guaranteed_capacity_kw = payload_rating_kw - best_effort_capacity_kw
```

### Capture-width ratio

The public model estimates capture-width ratio from hull diameter using Babarit's fitted relationship for a heaving device.

$$
\text{Capture-width ratio}
=
\frac{1.3\times \text{Hull diameter}+5.6}{100}
$$

```python
capture_width_ratio = (1.3 * hull_diameter_m + 5.6) / 100
```

At the 20 m default, the result is 31.6%.

### Transit distances and times

The tug handles the first 50 km. The node self-propels the remaining distance.

$$
\text{Self-propelled distance}
=
\max(0,\text{Sea-park distance}-50\text{ km})
$$

```python
self_propulsion_distance_km = max(0, sea_park_distance_km - tug_distance_km)
```

$$
\text{Travel time}
=
\frac{\text{Distance}}{\text{Speed}}
$$

```python
one_way_tug_days = tug_distance_km / tug_speed_km_per_day
one_way_self_propulsion_days = self_propulsion_distance_km / self_propulsion_speed_km_per_day
```

At the default distance, the tug leg lasts 0.167 days, the self-propelled leg lasts 30.208 days, and the complete one-way journey lasts 30.375 days.

# 3. How much output does one node produce?

## 3.1 Follow the actual journey

A normal deployment or service cycle contains five physical stages:

1. Tug from port to the deep-water transfer point.
2. Self-propel from the transfer point to the sea park.
3. Operate at the sea park.
4. Self-propel back to the transfer point.
5. Tug from the transfer point into port.

The representative wave-flux profile is:

| Journey state | Duration formula | Representative wave flux | Output treatment |
| --- | --- | --- | --- |
| Dockside service | 1 day payload-only; 7 days full maintenance | 0 kW/m | Zero output. |
| Tug to deep water | tug_distance_km / tug_speed_km_per_day | 0 -> 40 kW/m | Integrate the capped output over the linear wave-flux ramp. |
| Outbound self-propulsion | self_propulsion_distance_km / self_propulsion_speed_km_per_day | 40 -> 75 kW/m | Integrate by leg; often at the payload cap for the entire leg. |
| Sea-park operation | Time remaining between events | 100 kW/m | Constant output at the applicable cap. |
| Return self-propulsion | Same as outbound self-propulsion | 75 -> 40 kW/m | Use the reverse profile when the node remains productive; some failure modes set output to zero. |
| Tug from deep water to port | Same as outbound tug leg | 40 -> 0 kW/m | Use the reverse profile when productive; set to zero when the event disables compute. |

The model calculates the energy generated during each stage and adds the stages together. It does not create a row for every hour or day.

## 3.2 Convert wave conditions into usable compute power

At any point on a journey, captured wave power depends on wave flux, hull diameter, capture-width ratio, and the 85% end-to-end efficiency.

$$
\text{Wave-derived power}
=
\text{Wave flux}
\times
\text{Hull diameter}
\times
\text{Capture-width ratio}
\times
\text{Efficiency}
$$

```python
wave_power_kw = wave_flux_kw_per_m * hull_diameter_m * capture_width_ratio * end_to_end_efficiency
```

The node cannot send more power to servers than either its compute payload or its PTO can accept.

$$
\text{Compute power}
=
\min\left(
\text{Installed payload},
\text{PTO rating},
\text{Wave-derived power}
\right)
$$

```python
scheduled_power_kw = min(payload_rating_kw, pto_rating_kw, wave_power_kw)
```

The PTO is sized at 1.5 times the compute payload, so the compute payload is normally the binding equipment cap.

$$
\text{PTO rating}
=
1.5\times \text{Installed payload}
$$

```python
pto_rating_kw = pto_payload_multiplier * payload_rating_kw
```

It is useful to calculate the wave flux at which the node first reaches full compute output.

$$
\text{Full-output wave flux}
=
\frac{\text{Power cap}}
{\text{Hull diameter}\times\text{Capture-width ratio}\times\text{Efficiency}}
$$

```python
power_cap_kw = min(payload_rating_kw, pto_rating_kw)
full_output_flux_kw_per_m = power_cap_kw / (
    hull_diameter_m * capture_width_ratio * end_to_end_efficiency
)
```

At the defaults, full 200 kW output is reached at about 37.23 kW/m. Because self-propulsion begins around 40 kW/m, the entire self-propelled leg and sea-park period run at the full 200 kW cap. Only the short tug ramp is partly below the cap.

## 3.3 Calculate energy during each journey stage

Energy is power multiplied by time.

$$
\text{Energy during a stage}
=
\text{Average compute power during the stage}
\times
\text{Stage duration}
$$

When power is constant:

$$
E_{\text{stage}}
=
P_{\text{stage}}
\times
T_{\text{stage}}
\times
24
$$

```python
leg_energy_kwh = power_kw * duration_days * 24
```

When wave flux rises linearly and the whole stage remains below the cap, average power is simply the average of the beginning and ending wave-derived power:

$$
E_{\text{stage}}
=
24\times
\left(
\text{Hull diameter}\times\text{CWR}\times\text{Efficiency}
\right)
\times
T
\times
\frac{F_0+F_1}{2}
$$

```python
capture_coefficient = hull_diameter_m * capture_width_ratio * end_to_end_efficiency
leg_energy_kwh = (
    24 * capture_coefficient * duration_days
    * (flux_start_kw_per_m + flux_end_kw_per_m) / 2
)
```

When a linear ramp crosses the compute cap, split the stage once: integrate the below-cap portion, then add constant full output for the remainder.

$$
\begin{aligned}
a &= \frac{F_{\text{full}}-F_0}{F_1-F_0},\\[3pt]
E_{\text{stage}}
&=
24\left[
A(aT)\frac{F_0+F_{\text{full}}}{2}
+
P_{\text{cap}}(1-a)T
\right],
\end{aligned}
$$

where $A=\text{Hull diameter}\times\text{CWR}\times\text{Efficiency}$.

```python
below_cap_fraction = (
    full_output_flux_kw_per_m - flux_start_kw_per_m
) / (flux_end_kw_per_m - flux_start_kw_per_m)
below_cap_days = below_cap_fraction * duration_days
capped_days = duration_days - below_cap_days
leg_energy_kwh = 24 * (
    capture_coefficient * below_cap_days
    * (flux_start_kw_per_m + full_output_flux_kw_per_m) / 2
    + power_cap_kw * capped_days
)
```

For the default outbound tug leg, this method finds the small shortfall relative to running at 200 kW for the whole tug period. The self-propelled leg and sea-park period use the much simpler constant-power equation.

## 3.4 Add all stages over the analysis period

The no-failure scheduled output is simply the energy from every deployment, operating period, return, dock visit, and redeployment in the planned service calendar.

$$
\text{Scheduled output}
=
\sum_{\text{all planned stages}}
E_{\text{stage}}
$$

```python
baseline_scheduled_energy_kwh = sum(
    leg_energy_kwh for every planned journey and operating interval
)
```

This is easier to interpret as a full-output benchmark minus the output missed during trips and dock work:

$$
\text{Scheduled output}
=
\text{Full-output energy over the period}
-
\text{Output missed during planned journeys and service}
$$

That second equation is an interpretation, not a separate implementation formula.

## 3.5 Place planned service on the calendar

A payload swap is due no later than the selected payload-service interval after the payload was last restored. Full node maintenance remains fixed every five years. Whichever comes first determines the next planned payload-capable visit.

$$
\text{Next payload deadline}
=
\text{Last payload restoration}
+
\text{Payload-service interval}
$$

```python
next_payload_restoration_time = (
    last_payload_restoration_time + payload_swap_interval_years
)
```

$$
\text{Next planned payload-capable visit}
=
\min(
\text{Next payload deadline},
\text{Next fixed node-maintenance date}
)
$$

```python
next_planned_restoration_time = min(
    next_payload_restoration_time,
    next_node_maintenance_time,
)
```

The node begins returning early enough to finish the return journey and dock work at that date.

$$
\text{Return-start time}
=
\text{Planned restoration time}
-
\text{Return duration}
-
\text{Dock duration}
$$

```python
return_start_time = (
    next_planned_restoration_time
    - return_duration_days
    - dock_duration_days
)
```

A payload swap or surprise chip service restarts the payload clock. It does **not** move the fixed five-year node-maintenance calendar.

# 4. How much output is lost to failures?

The model treats ordinary chip failures separately from four rarer whole-node failure modes.

## 4.1 Chip failures: the intuitive story

The 200 kW default payload is represented as 100 equal blocks of 2 kW. Blocks fail independently. Failed blocks remain unavailable until the payload is serviced.

The first failures consume the best-effort margin. Output still falls from the first failure because healthy best-effort blocks would otherwise have produced revenue, but guaranteed output is protected until the spare margin is exhausted.

### Number of blocks

$$
\text{Number of blocks}
=
\frac{\text{Installed payload}}{\text{Block size}}
$$

```python
failure_block_count = payload_rating_kw / failure_block_kw
```

### Number of failures that triggers the early-service test

The model waits until failures consume the best-effort margin and create an additional 10% shortfall in guaranteed capacity.

$$
\text{Triggering failed blocks}
=
\operatorname{ceil}\left(
\frac{\text{Best-effort capacity}+
\text{Allowed guaranteed shortfall}}
{\text{Block size}}
\right)
$$

```python
surprise_service_threshold_kw = (
    surprise_service_threshold_fraction * guaranteed_capacity_kw
)
surprise_trigger_failed_blocks = math.ceil(
    (best_effort_capacity_kw + surprise_service_threshold_kw)
    / failure_block_kw
)
```

At the defaults, 19 failed blocks trigger the timing test.

### Probability that one block has failed by time $t$

$$
q(t)=1-e^{-\lambda t}
$$

```python
block_failure_probability = 1 - math.exp(
    -chip_failure_rate_annual * elapsed_years
)
```

With $n$ independent blocks, the number failed by time $t$ follows a binomial distribution:

$$
N_{\text{failed}}(t)
\sim
\operatorname{Binomial}(n,q(t))
$$

The exact expected-loss calculation is given in Appendix A.4. Conceptually, it does three things:

1. subtracts the output of failed blocks while the node remains in service;
2. calculates the probability and timing of an early service trip; and
3. restarts the payload clock after any payload restoration.

### Early trip versus waiting for planned service

An early trip is taken only when the threshold is reached early enough to complete a return, one dock day, and redeployment before the next planned payload-capable visit. If the threshold is reached inside that final journey-sized window, the node continues at reduced output and waits for the planned visit.

$$
\Pr(\text{separate early trip})
=
\Pr(T_k<\tau-W)
$$

where $T_k$ is the time of the $k$th block failure, $\tau$ is the time to the next planned visit, and $W$ is one complete payload-service journey.

```python
actionable_trip_probability = threshold_crossing_cdf_at(
    next_planned_service_years - late_surprise_merge_window_years
)
```

The final chip-adjusted output is the probability-weighted average across the possible service histories:

$$
\text{Chip-adjusted output}
=
\sum_b
\Pr(b)
\times
\text{Output under service history }b
$$

```python
chip_adjusted_energy_kwh = sum(
    branch_probability * branch_delivered_energy_kwh
    for each renewal branch
)
```

This is a deterministic expected-value calculation. Numerical quadrature evaluates the one-dimensional timing integrals; Monte Carlo is not part of the production model.

## 4.2 Other node failures: expected events times loss per event

The aggregate non-chip node-failure slider is divided among four operational consequences:

| Mode | Fixed share | Operational consequence |
| --- | --- | --- |
| 2 | 0.7896 | Compute disabled; node retains self-propulsion and returns under its own power. |
| 3 | 0.1961 | Loss of control; tug dispatch and retrieval required. |
| 4 | 0.01415 | Unrecoverable deep-water loss; ready replacement deploys. |
| 5 | 0.00014 | Catastrophic shallow-water loss; Mode 4 availability treatment plus additional salvage cost. |

For each mode, calculate its annual rate and expected number of events over the analysis period.

$$
\text{Mode }i\text{ annual rate}
=
\text{Aggregate node-failure rate}
\times
\text{Mode }i\text{ share}
$$

```python
mode_i_rate_annual = node_failure_rate_annual * mode_i_weight
```

$$
\text{Expected Mode }i\text{ events}
=
\text{Analysis years}
\times
\text{Mode }i\text{ annual rate}
$$

```python
expected_mode_i_events_per_position = (
    analysis_period_years * mode_i_rate_annual
)
```

Then multiply expected events by the output lost per event.

$$
\text{Expected Mode }i\text{ output loss}
=
\text{Expected Mode }i\text{ events}
\times
\text{Loss per event}
$$

```python
mode_i_loss_kwh = (
    expected_mode_i_events_per_position
    * mode_i_loss_per_event_kwh
)
```

### Mode 2: compute disabled, node returns under its own power

The lost output covers return, repair, and redeployment, minus whatever compute energy is still produced on the outbound redeployment leg.

$$
L_2
=
24P_{\text{cap}}
(T_{\text{return}}+T_{\text{repair}}+T_{\text{out}})
-
E_{\text{outbound}}
$$

```python
mode_2_loss_per_event_kwh = (
    24 * power_cap_kw * (return_days + repair_days + outbound_days)
    - outbound_energy_kwh
)
```

### Mode 3: loss of control, tug retrieval required

$$
L_3
=
24P_{\text{cap}}
(T_{\text{dispatch}}+T_{\text{tow}}+T_{\text{repair}}+T_{\text{out}})
-
E_{\text{outbound}}
$$

```python
mode_3_loss_per_event_kwh = (
    24 * power_cap_kw
    * (tug_dispatch_days + tow_back_days + repair_days + outbound_days)
    - outbound_energy_kwh
)
```

### Modes 4 and 5: total node loss

A ready replacement is assumed. The output loss is therefore the full-output energy during replacement deployment minus the energy produced during the outbound journey.

$$
L_4=L_5
=
24P_{\text{cap}}T_{\text{out}}
-
E_{\text{outbound}}
$$

```python
mode_4_loss_per_event_kwh = (
    24 * power_cap_kw * outbound_days - outbound_energy_kwh
)
mode_5_loss_per_event_kwh = mode_4_loss_per_event_kwh
```

# 5. How many nodes are needed?

First subtract expected Modes 2-5 losses from chip-adjusted output.

$$
\text{Delivered output from one operating slot}
=
\text{Chip-adjusted output}
-
\sum_{i=2}^5 \text{Expected Mode }i\text{ loss}
$$

```python
delivered_energy_kwh = (
    chip_adjusted_energy_kwh
    - mode_2_loss_kwh
    - mode_3_loss_kwh
    - mode_4_loss_kwh
    - mode_5_loss_kwh
)
```

Convert one slot's delivered output from kWh to MW-years.

$$
\text{Delivered MW-years per slot}
=
\frac{\text{Delivered kWh per slot}}{1{,}000\times8{,}760}
$$

```python
expected_delivered_energy_per_position_mw_years = (
    delivered_energy_kwh / (1_000 * 8_760)
)
```

The target is the selected average GW multiplied by the number of years.

$$
\text{Target MW-years}
=
1{,}000
\times
\text{Target GW}
\times
\text{Analysis years}
$$

```python
target_energy_mw_years = (
    1_000 * target_capacity_gw * analysis_period_years
)
```

Finally, divide the target by the output from one operating slot and round up.

$$
\text{Required operating fleet}
=
\operatorname{ceil}\left(
\frac{\text{Target MW-years}}
{\text{Delivered MW-years per slot}}
\right)
$$

```python
N_fleet = math.ceil(
    target_energy_mw_years
    / expected_delivered_energy_per_position_mw_years
)
```

This is the only fleet-sizing equation. Every later fleet-level cost uses this same whole-number value.

# 6. How many nodes and components are purchased?

If the analysis extends beyond one node lifetime, a new generation is purchased before the old generation retires.

$$
\text{Node generations}
=
\operatorname{ceil}\left(
\frac{\text{Analysis years}}{\text{Node lifetime}}
\right)
$$

```python
node_generations = math.ceil(
    analysis_period_years / node_lifetime_years
)
```

$$
\text{Planned node purchases}
=
\text{Required operating fleet}
\times
\text{Node generations}
$$

```python
planned_node_purchases = N_fleet * node_generations
```

The planned-purchase count is used for capital cost. The operating fleet remains $N_{\text{fleet}}$.

# 7. What does the system cost?

## 7.1 Cost of one newly built node

### Finished hull

The public proxy scales the 150-tonne reference hull linearly with diameter.

$$
\text{Hull mass}
=
150\text{ tonnes}
\times
\frac{\text{Selected diameter}}{20\text{ m}}
$$

```python
hull_steel_mass_tonnes = (
    reference_hull_steel_mass_tonnes
    * hull_diameter_m / reference_hull_diameter_m
)
```

$$
\text{Hull cost}
=
\text{Hull mass}
\times
\text{Finished-hull cost per tonne}
$$

```python
hull_cost_usd = (
    hull_steel_mass_tonnes
    * finished_hull_cost_usd_per_tonne
)
```

### PTO

$$
\text{PTO cost}
=
\text{PTO rating}
\times
\text{PTO cost per kW}
$$

```python
pto_cost_usd = pto_rating_kw * pto_cost_usd_per_kw
```

### Battery

$$
\text{Battery capacity}
=
\text{Payload kW}
\times
\text{Battery hours}
$$

```python
battery_capacity_kwh = payload_rating_kw * battery_duration_hours
```

$$
\begin{aligned}
\text{Battery-system cost}
={}&
\text{Battery capacity}
\times
\text{Pack cost per kWh}\\
&+
\text{Payload kW}
\times
\text{Battery power-system cost per kW}
\end{aligned}
$$

```python
battery_cost_usd = (
    battery_capacity_kwh * battery_pack_cost_usd_per_kwh
    + payload_rating_kw * battery_power_system_cost_usd_per_kw
)
```

### Compute and onboard systems

$$
\text{Compute-hardware cost}
=
\text{Installed payload}
\times
\text{Compute cost per kW}
$$

```python
compute_hardware_cost_usd = (
    payload_rating_kw * compute_hardware_cost_usd_per_kw
)
```

The fixed onboard communications and control allowance is added once per node.

```python
onboard_systems_cost_usd = onboard_systems_cost_usd_per_node
```

### Total physical node cost

$$
\begin{aligned}
\text{Physical node cost}
={}&
\text{Hull}+
\text{PTO}+
\text{Battery}\\
&+
\text{Onboard systems}+
\text{Compute hardware}
\end{aligned}
$$

```python
physical_node_cost_usd = (
    hull_cost_usd
    + pto_cost_usd
    + battery_cost_usd
    + onboard_systems_cost_usd
    + compute_hardware_cost_usd
)
non_compute_node_cost_usd = (
    physical_node_cost_usd - compute_hardware_cost_usd
)
```

The total planned physical fleet cost is:

$$
\text{Planned physical fleet cost}
=
\text{Physical node cost}
\times
\text{Operating fleet}
\times
\text{Node generations}
$$

```python
total_planned_physical_node_cost_usd = (
    physical_node_cost_usd * N_fleet * node_generations
)
```

## 7.2 Compute replacement

Failed blocks are replaced at payload service.

$$
\begin{aligned}
\text{Failed-block replacement cost}
={}&
\text{Expected blocks replaced per slot}\\
&\times\text{Block kW}
\times\text{Compute cost per kW}
\times\text{Operating fleet}
\end{aligned}
$$

```python
fleet_block_replacement_cost_usd = (
    expected_failed_blocks_replaced_per_position
    * failure_block_kw
    * compute_hardware_cost_usd_per_kw
    * N_fleet
)
```

Modes 4 and 5 require complete payload replacement.

$$
\text{Complete-payload replacement cost}
=
\text{Expected fleet total-loss events}
\times
\text{Compute cost per node}
$$

```python
expected_total_loss_events_fleet = (
    N_fleet * analysis_period_years
    * (mode_4_rate_annual + mode_5_rate_annual)
)
fleet_complete_payload_replacement_cost_usd = (
    expected_total_loss_events_fleet
    * compute_hardware_cost_usd
)
```

$$
\text{Total compute replacement}
=
\text{Failed-block replacement}
+
\text{Complete-payload replacement}
$$

```python
total_compute_replacement_cost_usd = (
    fleet_block_replacement_cost_usd
    + fleet_complete_payload_replacement_cost_usd
)
```

## 7.3 Non-compute maintenance and failure costs

The model adds planned tug operations, fixed five-year maintenance, unexpected tug operations, repairs, non-compute replacement after total losses, catastrophic cleanup, and retirement processing.

The cost of one 50 km tug leg is:

$$
\text{One tug-leg cost}
=
\text{Tug day rate}
\times
\text{One-way tug days}
$$

```python
tug_50km_leg_cost_usd = (
    tug_cost_usd_per_day * one_way_tug_days
)
```

Planned tug cost includes one outbound tug leg for each purchased node generation and two tug legs for every planned payload or full-maintenance visit.

$$
\begin{aligned}
\text{Planned tug cost}
={}&
\text{One tug-leg cost}
\times N_{\text{fleet}}\\
&\times\left[
\text{Node generations}
+2(\text{Planned payload visits}+
\text{Full-maintenance visits})
\right]
\end{aligned}
$$

```python
normal_tug_cost_usd = (
    tug_50km_leg_cost_usd * N_fleet
    * (
        node_generations
        + 2 * (
            expected_scheduled_payload_only_event_count_per_position
            + scheduled_node_maintenance_event_count_per_position
        )
    )
)
```

The exact unexpected-tug and repair equations are listed in Appendix A.5. Their total is:

$$
\begin{aligned}
\text{Total non-compute maintenance and failure cost}
={}&
\text{Planned tug}+
\text{Fixed maintenance}+
\text{Unexpected tug}\\
&+
\text{Non-compute replacements}+
\text{Mechanical repairs}\\
&+
\text{Catastrophic cleanup}+
\text{Retirement processing}
\end{aligned}
$$

```python
total_non_compute_maintenance_failure_cost_usd = (
    normal_tug_cost_usd
    + scheduled_node_maintenance_cost_usd
    + unexpected_tug_cost_usd
    + mode_4_5_non_compute_replacement_cost_usd
    + unexpected_mechanical_repair_cost_usd
    + mode_5_catastrophic_cost_usd_total
    + node_retirement_cost_usd_total
)
```

## 7.4 Total undiscounted lifecycle cost

$$
\begin{aligned}
\text{Total lifecycle cost}
={}&
\text{Planned physical fleet cost}\\
&+
\text{Compute replacement cost}\\
&+
\text{Non-compute maintenance and failure cost}
\end{aligned}
$$

```python
total_node_fleet_cost_usd = (
    total_planned_physical_node_cost_usd
    + total_compute_replacement_cost_usd
    + total_non_compute_maintenance_failure_cost_usd
)
```

# 8. Present value and unit-cost outputs

Costs are assigned to the year in which they occur. A service completed exactly at year 1 belongs to cost year 1. An event completed exactly at the five-year horizon is outside a five-year example and is excluded.

$$
\text{Present value}
=
\sum_{t=0}^T
\frac{C_t}{(1+r)^t}
$$

```python
present_value_total_node_fleet_cost_usd = sum(
    node_fleet_cost_usd_in_year_t[t]
    / ((1 + real_discount_rate) ** t)
    for t in cost_years
)
```

$$
\text{Lifecycle cost per target watt}
=
\frac{\text{Total lifecycle cost}}
{\text{Target GW}\times10^9}
$$

```python
lifecycle_cost_per_target_watt_usd = (
    total_node_fleet_cost_usd
    / (target_capacity_gw * 1_000_000_000)
)
```

The levelized delivered-compute cost discounts both cost and delivered energy on the same annual schedule.

$$
\text{Levelized compute cost}
=
\frac{\sum_t C_t/(1+r)^t}
{\sum_t E_t/(1+r)^t}
$$

```python
levelized_cost_of_delivered_compute_energy_usd_per_mwh = (
    discounted_cost_usd / discounted_delivered_energy_mwh
)
```

# 9. Worked example A: all slider defaults

## 9.1 Inputs

| Exact slider variable | Example A value | Display interpretation |
| --- | --- | --- |
| target_capacity_gw | 1 | 1 GW average delivered-compute target |
| analysis_period_years | 5 | Five-year analysis |
| real_discount_rate | 0.06 | 6% real discount rate |
| payload_rating_kw | 200 | 200 kW installed compute payload |
| battery_duration_hours | 0.5 | 30 minutes of storage |
| hull_diameter_m | 20 | 20 m hull diameter |
| sea_park_distance_km | 1,500 | Port-to-sea-park distance |
| payload_swap_interval_years | 1 | Maximum one year between planned payload services |
| node_lifetime_years | 20 | 20-year node life |
| chip_failure_rate_annual | 0.01 | 1% annual hazard per 2 kW block |
| hot_spare_fraction | 0.10 | 10% best-effort/hot-spare share |
| node_failure_rate_annual | 0.019 | 1.9% aggregate annual rate for Modes 2-5 |
| finished_hull_cost_usd_per_tonne | $2,000 | Finished fabricated hull cost |
| pto_cost_usd_per_kw | $200 | PTO cost per rated kW |
| compute_hardware_cost_usd_per_kw | $15,000 | Inference compute hardware cost |

The exact-year boundary convention excludes a service completed exactly at the five-year endpoint. The example therefore includes four annual payload services and no completed five-year maintenance visit.

## 9.2 Scheduled output from one node slot

At the 20 m default:

$$
\text{CWR}
=
\frac{1.3(20)+5.6}{100}
=
0.316
$$

The full-output threshold is:

$$
F_{\text{full}}
=
\frac{200}{20(0.316)(0.85)}
=
37.23\text{ kW/m}
$$

The one-way journey is:

$$
T_{\text{one-way}}
=
\frac{50}{300}
+
\frac{1{,}450}{48}
=
30.375\text{ days}
$$

Full 200 kW operation for five years would produce 8,760,000 kWh. The initial tug ramp and four planned return-service-redeployment cycles reduce this to:

$$
\text{Scheduled output}
=
8{,}737{,}449.293\text{ kWh}
$$

```python
baseline_scheduled_energy_kwh = 8_737_449.293
```

## 9.3 Chip failures

The 200 kW payload contains 100 blocks. The 20 kW best-effort margin plus an 18 kW allowed guaranteed-capacity shortfall means the nineteenth failed block triggers the early-service timing test.

$$
n=200/2=100
$$

$$
k=\operatorname{ceil}\left(\frac{20+18}{2}\right)=19
$$

At a 1% annual block hazard, the probability of reaching 19 failures within one year is negligible:

$$
\Pr(T_{19}\le1)=5.58\times10^{-19}
$$

Surprise service therefore contributes essentially nothing, but ordinary failed blocks still reduce output. Four annual services replace an expected 3.9801 failed blocks per operating slot.

$$
\text{Chip-adjusted output}
=
8{,}694{,}014.975\text{ kWh}
$$

$$
\text{Net chip-failure loss}
=
8{,}737{,}449.293
-
8{,}694{,}014.975
=
43{,}434.318\text{ kWh}
$$

## 9.4 Other node failures

| Mode | Annual rate | Expected events in 5 years | Loss per event (kWh) | Expected loss (kWh) |
| --- | --- | --- | --- | --- |
| 2 - self-return machinery failure | 0.0150024 | 0.0750120 | 179,772.301 | 13,485.080 |
| 3 - tug retrieval | 0.0037259 | 0.0186295 | 81,972.301 | 1,527.103 |
| 4 - total node loss | 0.00026885 | 0.00134425 | 372.301 | 0.500 |
| 5 - catastrophic total loss | 0.00000266 | 0.00001330 | 372.301 | 0.005 |
| Total | - | 0.09499905 | - | 15,012.688 |

Total expected Modes 2-5 loss is 15,012.688 kWh.

## 9.5 Delivered output and required fleet

$$
\text{Delivered output}
=
8{,}694{,}014.975
-
15{,}012.688
=
8{,}679{,}002.287\text{ kWh}
$$

$$
\text{Delivered output per slot}
=
\frac{8{,}679{,}002.287}{1{,}000\times8{,}760}
=
0.990753686\text{ MW-years}
$$

The 1 GW five-year target is 5,000 MW-years.

$$
N_{\text{fleet}}
=
\operatorname{ceil}\left(
\frac{5{,}000}{0.990753686}
\right)
=
5{,}047
$$

## 9.6 Cost of one node and the fleet

| Per-node physical component | Calculation | Cost |
| --- | --- | --- |
| Finished hull | 150 tonnes * $2,000/tonne | $300,000 |
| PTO | 300 kW * $200/kW | $60,000 |
| Battery | 100 kWh * $100/kWh + 200 kW * $75/kW | $25,000 |
| Onboard communications and controls | Fixed constant | $25,000 |
| Compute hardware | 200 kW * $15,000/kW | $3,000,000 |
| physical_node_cost_usd | Sum of all components | $3,410,000 |
| non_compute_node_cost_usd | Physical node less compute | $410,000 |

Because the 20-year node life exceeds the five-year analysis period, the model purchases one generation of 5,047 nodes.

$$
\text{Planned physical fleet cost}
=
5{,}047\times\$3.41\text{ million}
=
\$17.21027\text{ billion}
$$

Compute replacement totals $623.177 million. Non-compute maintenance and failure totals $113.111 million.

| Non-compute maintenance/failure component | Cost |
| --- | --- |
| Normal deployment and planned-service tug cost | $75,705,000 |
| Fixed five-year node-maintenance work | $0 |
| Unexpected tug cost | $10,832,385 |
| Modes 4-5 non-compute replacement | $2,809,137 |
| Modes 2-3 mechanical repair | $23,630,433 |
| Additional Mode 5 catastrophic cost | $134,250 |
| Planned retirement | $0 |
| total_non_compute_maintenance_failure_cost_usd | $113,111,205 |

The three dashboard cost buckets are:

| Dashboard cost bucket | Amount | Share of total |
| --- | --- | --- |
| Compute hardware plus compute replacement | $15.764 billion | 87.84% |
| Initial physical non-compute hardware | $2.069 billion | 11.53% |
| Non-compute maintenance and failure | $0.113 billion | 0.63% |
| Total | $17.947 billion | 100.00% |

Therefore:

$$
\boxed{
\text{Default total cost}
=
\$17.947\text{ billion undiscounted}
}
$$

The annual cost schedule is:

| Cost year | node_fleet_cost_usd_in_year_t | Reason for major cost |
| --- | --- | --- |
| 0 | $17,218,681,667 | Initial physical fleet plus initial 50 km tug deployment |
| 1 | $179,070,974 | Year-1 service, block replacement, and annual failure costs |
| 2 | $179,070,974 | Year-2 service, block replacement, and annual failure costs |
| 3 | $179,070,974 | Year-3 service, block replacement, and annual failure costs |
| 4 | $179,070,974 | Year-4 service, block replacement, and annual failure costs |
| 5 | $11,592,174 | Annual non-chip failure costs; no service at the horizon |

At a 6% real discount rate:

$$
\boxed{
\text{Default present-value cost}
=
\$17.848\text{ billion}
}
$$

The levelized delivered-compute cost is approximately $483.68/MWh.

# 10. Worked example B: high chip failure and a two-year payload interval

## 10.1 Changed sliders

| Exact slider variable | Example A | Example B | Change |
| --- | --- | --- | --- |
| chip_failure_rate_annual | 0.01 | 0.10 | Tenfold annual block-failure hazard |
| payload_swap_interval_years | 1 | 2 | Planned payload deadline extended to two years |
| All other sliders | Defaults | Same defaults | No change |

Everything else remains at the default. This is not a pure chip-failure sensitivity because the planned payload interval also changes; it is a combined high-failure, extended-service-interval case.

## 10.2 Scheduled output before chip failures

Only two planned payload services occur before the five-year boundary, so the no-failure scheduled output is slightly higher than in Example A:

$$
\text{Scheduled output}
=
8{,}748{,}538.496\text{ kWh}
$$

## 10.3 Chip-failure and service result

During the first two-year service interval:

$$
\Pr(T_{19}\le2)=0.450572
$$

$$
\Pr(\text{separate early trip})=0.309602
$$

$$
\Pr(\text{late crossing handled at planned service})=0.140970
$$

Across the full five-year expected-value calculation:

| Mode 1 output | Five-year expected value |
| --- | --- |
| expected_mode_1_surprise_service_event_count_per_position | 0.66512 |
| expected_scheduled_payload_only_event_count_per_position | 1.39095 |
| expected_failed_blocks_replaced_per_position | 35.19786 blocks |
| chip_adjusted_energy_kwh | 7,970,372.146 kWh |
| mode_1_net_loss_kwh | 778,166.350 kWh |

The yearly chip calculation is shown below as a regression target, not as a daily simulation:

| Year | Chip-adjusted energy (kWh) | Expected surprise services | Expected planned payload services | Expected blocks replaced |
| --- | --- | --- | --- | --- |
| 1 | 1,666,735.459 | 0.00102 | 0.00000 | 0.01938 |
| 2 | 1,503,980.404 | 0.30678 | 0.69220 | 17.05666 |
| 3 | 1,648,473.657 | 0.01379 | 0.00073 | 0.27384 |
| 4 | 1,520,092.561 | 0.29750 | 0.68819 | 16.81550 |
| 5 | 1,631,090.065 | 0.04603 | 0.00983 | 1.03248 |
| Total | 7,970,372.146 | 0.66512 | 1.39095 | 35.19786 |

## 10.4 Delivered output and required fleet

Modes 2-5 losses remain 15,012.688 kWh per operating slot because those sliders did not change.

$$
\text{Delivered output}
=
7{,}970{,}372.146
-
15{,}012.688
=
7{,}955{,}359.458\text{ kWh}
$$

$$
\text{Delivered output per slot}
=
0.908146057\text{ MW-years}
$$

$$
N_{\text{fleet}}
=
\operatorname{ceil}\left(
\frac{5{,}000}{0.908146057}
\right)
=
5{,}506
$$

The lower output per operating slot requires 459 more nodes than the default.

## 10.5 Cost result

The unchanged $3.41 million per-node physical cost applied to 5,506 nodes gives:

$$
\text{Planned physical fleet cost}
=
5{,}506\times\$3.41\text{ million}
=
\$18.77546\text{ billion}
$$

Compute replacement increases to $5.83641 billion, principally because 35.20 failed blocks are replaced per operating slot in expectation.

Non-compute maintenance and failure falls to $87.72 million because the two-year payload interval substantially reduces planned service trips. Failure-related costs rise, but the reduction in planned tug trips is larger.

| Non-compute maintenance/failure component | Example B cost | Change from Example A |
| --- | --- | --- |
| Normal deployment and planned-service tug cost | $34,705,236 | -$40,999,764 |
| Fixed five-year node-maintenance work | $0 | $0 |
| Unexpected tug cost | $24,024,707 | +$13,192,322 |
| Modes 4-5 non-compute replacement | $3,064,615 | +$255,477 |
| Modes 2-3 mechanical repair | $25,779,505 | +$2,149,072 |
| Additional Mode 5 catastrophic cost | $146,460 | +$12,209 |
| Planned retirement | $0 | $0 |
| total_non_compute_maintenance_failure_cost_usd | $87,720,522 | -$25,390,684 |

| Dashboard cost bucket | Amount | Share of total |
| --- | --- | --- |
| Compute hardware plus compute replacement | $22.354 billion | 90.51% |
| Initial physical non-compute hardware | $2.257 billion | 9.14% |
| Non-compute maintenance and failure | $0.088 billion | 0.36% |
| Total | $24.700 billion | 100.00% |

Therefore:

$$
\boxed{
\text{High-failure / two-year-service total}
=
\$24.700\text{ billion undiscounted}
}
$$

The annual schedule is:

| Cost year | node_fleet_cost_usd_in_year_t | Reason for major cost |
| --- | --- | --- |
| 0 | $18,784,636,667 | Initial physical fleet plus initial 50 km tug deployment |
| 1 | $15,866,334 | Annual failures; almost no Mode 1 service yet |
| 2 | $2,848,400,137 | First major wave of planned/surprise service and block replacement |
| 3 | $58,145,807 | Low expected Mode 1 service activity |
| 4 | $2,808,321,413 | Second major wave of planned/surprise service and block replacement |
| 5 | $184,216,689 | Late surprise/planned service activity plus annual failure costs |

At a 6% real discount rate:

$$
\boxed{
\text{High-failure / two-year-service PV cost}
=
\$23.746\text{ billion}
}
$$

The levelized delivered-compute cost is approximately $643.18/MWh.

## 10.6 Side-by-side interpretation

| Headline output | Example A - defaults | Example B - high chip failure / 2-year interval |
| --- | --- | --- |
| Operating fleet | 5,047 nodes | 5,506 nodes |
| Delivered output per position | 0.990754 MW-years | 0.908146 MW-years |
| Undiscounted total cost | $17.947 billion | $24.700 billion |
| Present-value total cost | $17.848 billion | $23.746 billion |
| Total compute cost | $15.764 billion | $22.354 billion |
| Initial physical non-compute cost | $2.069 billion | $2.257 billion |
| Non-compute maintenance/failure cost | $0.113 billion | $0.088 billion |
| Compute share of total | 87.84% | 90.51% |

Example B costs about $6.75 billion more than the default. Almost all of the increase comes from compute: the lower output per operating slot requires more initial compute payloads, and the high chip-failure rate creates roughly $5.81 billion of failed-block replacement cost.

# Appendix A. Exact implementation reference for the coding agent

The main body explains the model in physical and economic order. This appendix contains the exact variable schema, the chip-failure integration details, edge cases, and regression checks needed to implement it without inventing new model logic.

## A.1 User-controlled sliders

| Dashboard label | Code variable | Unit | Range | Initial default | Step |
| --- | --- | --- | --- | --- | --- |
| Target total saleable compute capacity | target_capacity_gw | GW | 0.1-100 | 1 | 0.1 |
| Analysis period | analysis_period_years | years | 3-15 | 5 | 1 |
| Discount rate | real_discount_rate | % | 2%-10% | 6% | 0.5 percentage points |
| Total installed compute payload per node | payload_rating_kw | kW | 100-300 | 200 | 10 |
| Battery duration | battery_duration_hours | hours | 0.25-4 | 0.5 | 0.25 |
| Hull diameter | hull_diameter_m | m | 10-20 | 20 | 1 |
| Distance from port to sea park | sea_park_distance_km | km | 500-4,000 | 1,500 | 100 |
| Payload swap interval | payload_swap_interval_years | years | 0.5-5 | 1 | 0.5 |
| Node lifetime | node_lifetime_years | years | 5-30 | 20 | 1 |
| Chip degradation rate | chip_failure_rate_annual | % per server-year | 0.5%-10% | 1% | 0.5 pp |
| Best-effort / hot-spare share | hot_spare_fraction | % of installed payload | 0%-20% | 10% | 2.5 pp |
| Unexpected node failure rate | node_failure_rate_annual | % per node-year | 0.5%-10% | 1.9% | 0.5 pp |
| Finished hull cost | finished_hull_cost_usd_per_tonne | USD / structural-steel tonne | $1,500-$10,000 | $2,000 | $500 |
| PTO cost | pto_cost_usd_per_kw | USD / rated PTO kW | $50-$500 | $200 | $25 |
| Compute hardware cost | compute_hardware_cost_usd_per_kw | USD / installed compute kW | $10,000-$30,000 | $15,000 | $1,000 |

Only these variables should be bound to public dashboard controls. Displayed percentages must be converted to decimal fractions before calculation.

## A.2 Fixed configuration values

| Code variable | Value | Unit / type | Meaning |
| --- | --- | --- | --- |
| tug_distance_km | 50 | km | Fixed distance from port to the deep-water point where self-propulsion begins. |
| tug_speed_km_per_day | 300 | km/day | Representative tug speed converted to daily units from the midpoint of Ivar's stated range. |
| self_propulsion_speed_km_per_day | 48 | km/day | Node speed during independent transit, expressed in daily units. |
| payload_swap_dock_days | 1 | days | Conservative fixed pier time for a scheduled payload-only swap; Ivar says it may take only a few hours. |
| node_maintenance_interval_years | 5 | years | Fixed interval for full preventative node maintenance. |
| node_maintenance_dock_days | 7 | days | Fixed dock duration for full node maintenance; this visit also includes a payload swap. |
| end_to_end_efficiency | 0.85 | fraction | Net captured-wave-to-server efficiency, including the losses already encompassed by Ivar's 85% assumption. |
| pto_payload_multiplier | 1.5 | multiplier | PTO rating is derived as 1.5 times payload rating. |
| failure_block_kw | 2 | kW | Compute capacity represented by one failed server or failure block. |
| surprise_service_threshold_fraction | 0.10 | fraction of guaranteed capacity | Guaranteed-capacity shortfall that triggers an unscheduled payload-service trip. |
| wave_route_profile | 0 -> 40 -> 75 -> 100 | kW/m | Fixed representative progression from dock, to deep-water transfer, to late transit, to sea park. |
| mode_2_weight | 0.7896 | fraction | Share of aggregate node failures that are non-chip machinery failures which disable useful output but preserve self-propulsion and control. |
| mode_3_weight | 0.1961 | fraction | Share of aggregate node failures that require tug retrieval. |
| mode_4_weight | 0.01415 | fraction | Share of aggregate node failures that are unrecoverable deep-water losses. |
| mode_5_weight | 0.00014 | fraction | Share of aggregate node failures that are catastrophic shallow-water losses. |
| mode_2_repair_days | 7 | days | Conservative fixed repair duration after a non-chip machinery failure that allows self-return. |
| mode_3_repair_days | 7 | days | Conservative fixed repair duration after tug retrieval. |
| planned_replacement_policy | overlapping | category | End-of-life replacements are deployed before retiring nodes leave service. |
| reference_hull_length_m | 85 | m | Fixed length of the public full-scale production-node reference used for hull-mass scaling. |
| reference_hull_diameter_m | 20 | m | Reference diameter assigned to the modeled 150-tonne structural-hull mass. |
| reference_hull_steel_mass_tonnes | 150 | tonnes | Modeled structural hull mass for the simple 85 m-long, 20 m-diameter reference node; transparent public-model proxy based on flat-deck barge lightship comparables and Panthalassa statements that nodes are far lighter than barges. |
| battery_pack_cost_usd_per_kwh | 100 | USD/kWh | Battery pack and module cost assumption; duration is now user controlled. |
| battery_power_system_cost_usd_per_kw | 75 | USD/kW | Incremental battery-side power electronics, management/protection, thermal/fire controls, and marine integration; excludes shared generator-side and common payload power equipment. |
| onboard_systems_cost_usd_per_node | 25,000 | USD/node | Flat hardware allowance for communications, tracking, navigation, telemetry, and supporting electronics. |
| tug_cost_usd_per_day | 10,000 | USD/tug-day | Representative fleet-scale tug charter rate, prorated by modeled trip duration. |
| scheduled_node_maintenance_cost_fraction | 0.03 | fraction of non-compute node cost/event | Non-compute labor, parts, inspection, coating, and dock work during each five-year maintenance visit. |
| disabling_mechanical_repair_cost_usd | 50,000 | USD/Mode 2 or 3 event | Non-compute repair parts and labor after a disabling failure; excludes tug, compute, and lost output. |
| mode_5_catastrophic_cost_usd | 2,000,000 | USD/Mode 5 event | Additional shallow-water wreck removal, salvage, remediation, and channel-clearance allowance. |
| node_retirement_processing_cost_fraction | 0.01 | fraction of non-compute node cost/retirement | Gross decommissioning and recycling-processing allowance; excludes tug cost and assumes no scrap-value credit. |
| chip_failure_quadrature_points | 48 | integer | Number of integration points used to evaluate the threshold-time distribution within each service interval; not a time-step simulation. |
| renewal_probability_cutoff | 1e-8 | probability | Stop expanding an additional surprise-service branch when its remaining probability mass is below this value. |
| chip_failure_quadrature_relative_tolerance | 1e-6 | fraction | Double the quadrature points until key Mode 1 outputs change by less than this relative tolerance. |

## A.3 Pre-calculation derived variables

| Exact code variable | Authoritative coding expression | Purpose / next use |
| --- | --- | --- |
| capture_width_ratio | (1.3 * hull_diameter_m + 5.6) / 100 | Feeds wave_power_kw in Section 3.6. |
| best_effort_capacity_kw | hot_spare_fraction * payload_rating_kw | Defines best-effort output and the chip-failure buffer. |
| guaranteed_capacity_kw | payload_rating_kw - best_effort_capacity_kw | Defines guaranteed-output reporting and service threshold. |
| self_propulsion_distance_km | max(0, sea_park_distance_km - tug_distance_km) | Feeds one_way_self_propulsion_days. |
| one_way_tug_days | tug_distance_km / tug_speed_km_per_day | Feeds journey duration and tug cost. |
| one_way_self_propulsion_days | self_propulsion_distance_km / self_propulsion_speed_km_per_day | Feeds journey duration and failure-event loss. |
| surprise_service_threshold_kw | surprise_service_threshold_fraction * guaranteed_capacity_kw | Feeds surprise_trigger_failed_blocks in Section 4.2. |
| analysis_period_hours | 8_760 * analysis_period_years | Used for full-period unit conversion and exposure. |
| payload_service_trip_days | 2 * (one_way_tug_days + one_way_self_propulsion_days) + payload_swap_dock_days | Feeds the late-trip merge window. |
| late_surprise_merge_window_years | payload_service_trip_days / 365 | Separates actionable from suppressed late threshold crossings. |

## A.4 Exact chip-failure calculation

### A.4.1 Failure distribution

For $n$ independent 2 kW blocks with annual hazard $\lambda$, the probability that a block has failed by elapsed time $t$ is:

$$
q(t)=1-e^{-\lambda t}
$$

The failed-block count is:

$$
N_{\text{failed}}(t)\sim\operatorname{Binomial}(n,q(t))
$$

The probability that the $k$th failure has occurred is:

$$
\Pr(T_k\le t)
=
\Pr(N_{\text{failed}}(t)\ge k)
$$

```python
threshold_crossing_cdf = 1 - binomial_cdf(
    surprise_trigger_failed_blocks - 1,
    failure_block_count,
    block_failure_probability,
)
```

The density of the $k$th failure time is:

$$
f_k(t)
=
\frac{n!}{(k-1)!(n-k)!}
q(t)^{k-1}
[1-q(t)]^{n-k}
\lambda e^{-\lambda t}
$$

```python
threshold_crossing_density = kth_failure_time_density(
    elapsed_years,
    failure_block_count,
    surprise_trigger_failed_blocks,
    chip_failure_rate_annual,
)
```

### A.4.2 Degradation before an early-service threshold

The expected number of failed blocks while the count remains below $k$ is:

$$
\mathbb{E}[N_{\text{failed}}(t);N_{\text{failed}}(t)<k]
=
\sum_{j=0}^{k-1}
j\Pr(N_{\text{failed}}(t)=j)
$$

```python
expected_failed_blocks_below_threshold = sum(
    j * binomial_pmf(
        j, failure_block_count, block_failure_probability
    )
    for j in range(surprise_trigger_failed_blocks)
)
```

The corresponding expected output loss is:

$$
E_{\text{degradation loss}}
=
8{,}760\times
\text{Block kW}
\int
\mathbb{E}[N_{\text{failed}}(t);N_{\text{failed}}(t)<k]dt
$$

```python
gross_mode_1_degradation_loss_kwh = (
    8_760 * failure_block_kw
    * integrate_expected_failed_blocks_below_threshold()
)
```

### A.4.3 Late crossing handled at planned service

Let $\tau$ be the next planned payload-capable visit and $W$ the journey-sized merge window. Set $c=\max(0,\tau-W)$. For $u$ years inside the late window, the unconditional expected failed blocks on branches that had not already triggered a separate trip are:

$$
\mathbb{E}[N_{\text{late}}(u)]
=
\sum_{j=0}^{k-1}
\Pr(N_{\text{failed}}(c)=j)
\left[
 j+(n-j)(1-e^{-\lambda u})
\right]
$$

Evaluate this expression at planned service to obtain the expected failed blocks replaced on the no-early-trip branch. Integrate it over the late window to obtain late-window output loss.

### A.4.4 Early-trip loss and renewal

For an actionable threshold crossing at time $t$, calculate return, one dock day, and redeployment with the same journey-stage equations used in the main body. The expected trip loss is:

$$
E_{\text{trip loss}}
=
\int_0^{\tau-W}
L_{\text{trip}}(t)f_k(t)dt
$$

After a completed early payload service:

- restore failed capacity to zero;
- restart the payload-service clock when the refreshed payload leaves dock;
- do not move the fixed five-year node-maintenance date; and
- repeat the same calculation over the remaining analysis time.

The expected output and expected event counts are probability-weighted sums over these renewal branches. Stop expanding a branch when its probability mass falls below `renewal_probability_cutoff`.

Use 48-point quadrature initially. Double the number of points until the key Mode 1 outputs change by less than `chip_failure_quadrature_relative_tolerance`. Split integration intervals at journey-stage boundaries so quadrature never spans a discontinuity in the power function.

No Monte Carlo draw belongs in production code.

### A.4.5 Required Mode 1 outputs

The chip routine must return:

- `chip_adjusted_energy_kwh`
- `expected_mode_1_surprise_service_event_count_per_position`
- `expected_scheduled_payload_only_event_count_per_position`
- `expected_failed_blocks_replaced_per_position`
- `gross_mode_1_degradation_loss_kwh`
- `gross_surprise_trip_loss_kwh`

For reporting:

$$
\text{Net Mode 1 loss}
=
\text{Scheduled output}-
\text{Chip-adjusted output}
$$

```python
mode_1_net_loss_kwh = (
    baseline_scheduled_energy_kwh - chip_adjusted_energy_kwh
)
```

The service-rescheduling credit reconciles gross degradation and trip loss to net Mode 1 loss:

$$
\text{Service-rescheduling credit}
=
\text{Gross degradation loss}
+
\text{Gross early-trip loss}
-
\text{Net Mode 1 loss}
$$

```python
service_rescheduling_credit_kwh = (
    gross_mode_1_degradation_loss_kwh
    + gross_surprise_trip_loss_kwh
    - mode_1_net_loss_kwh
)
```

## A.5 Exact non-compute operating-cost equations

### Fixed five-year node-maintenance work

```python
scheduled_node_maintenance_cost_usd = (
    N_fleet
    * scheduled_node_maintenance_event_count_per_position
    * scheduled_node_maintenance_cost_fraction
    * non_compute_node_cost_usd
)
```

### Unexpected tug operations

```python
mode_1_2_tug_cost_usd = (
    2 * tug_50km_leg_cost_usd * N_fleet
    * (
        expected_mode_1_surprise_service_event_count_per_position
        + analysis_period_years * mode_2_rate_annual
    )
)

mode_3_tug_cost_usd = (
    N_fleet * analysis_period_years * mode_3_rate_annual
    * tug_cost_usd_per_day
    * ((2 * sea_park_distance_km / tug_speed_km_per_day)
       + one_way_tug_days)
)

replacement_deployment_tug_cost_usd = (
    expected_total_loss_events_fleet * tug_50km_leg_cost_usd
)

unexpected_tug_cost_usd = (
    mode_1_2_tug_cost_usd
    + mode_3_tug_cost_usd
    + replacement_deployment_tug_cost_usd
)
```

### Replacement, repair, cleanup, and retirement

```python
mode_4_5_non_compute_replacement_cost_usd = (
    expected_total_loss_events_fleet * non_compute_node_cost_usd
)

unexpected_mechanical_repair_cost_usd = (
    disabling_mechanical_repair_cost_usd
    * N_fleet * analysis_period_years
    * (mode_2_rate_annual + mode_3_rate_annual)
)

mode_5_catastrophic_cost_usd_total = (
    mode_5_catastrophic_cost_usd
    * N_fleet * analysis_period_years * mode_5_rate_annual
)

node_retirement_cost_usd_total = (
    N_fleet
    * math.floor(analysis_period_years / node_lifetime_years)
    * node_retirement_processing_cost_fraction
    * non_compute_node_cost_usd
)
```

## A.6 Calendar and boundary rules

- At $t=0$, a new node begins initial deployment. No service is due.
- Payload service is a rolling maximum interval measured from the latest payload restoration.
- Fixed node maintenance remains anchored at 5, 10, 15, ... years from deployment.
- A full-maintenance visit also restores the payload.
- A completed surprise payload service restarts only the payload clock.
- If a threshold is reached inside the final journey-sized merge window before a planned payload-capable visit, suppress the separate trip and wait for the planned visit.
- If surprise service would overlap fixed node maintenance, perform one combined visit.
- Truncate journeys and service intervals at the analysis boundary.
- An event exactly at an interior year boundary belongs to the year just completed; an event exactly at the final analysis endpoint is excluded.
- Treat all annual failure inputs as rates, not full-period probabilities.

## A.7 Required regression checks

- Default inputs: `N_fleet == 5047` and rounded total cost equals $17.95 billion.
- High-failure/two-year-service inputs: `N_fleet == 5506` and rounded total cost equals $24.70 billion.
- In each example, compute cost + initial non-compute physical cost + non-compute maintenance/failure cost must equal total lifecycle cost using unrounded values.
- The fleet-size minimality check must pass:

$$
(N_{\text{fleet}}-1)E_{\text{slot}}
<
E_{\text{target}}
\le
N_{\text{fleet}}E_{\text{slot}}
$$

```python
assert (
    (N_fleet - 1)
    * expected_delivered_energy_per_position_mw_years
    < target_energy_mw_years
    <= N_fleet
    * expected_delivered_energy_per_position_mw_years
)
```

# Appendix B. Assumptions, evidence limitations, and sources

## B.1 Cost and engineering assumptions

**Finished hull.** Ivar's high-level technoeconomic estimate uses $2,000 per finished-hull tonne as the central case and $1,500 per tonne as an aggressive lower case. The dashboard therefore uses a $2,000/tonne default and a $1,500-$10,000/tonne range. These values price a finished fabricated hull, not raw steel.

**PTO.** Ivar's July 7, 2026 email recommends Tesla motor and low-end wind-turbine generator comparables. Public 100-300 kW low-speed wind/hydro generator quotes are roughly $40-$150/kW. The $200/kW default adds an allowance for the water-turbine runner, shaft, bearings, and low-volume marine construction; $50-$500/kW is the sensitivity range.

**Compute hardware.** Panthalassa nodes are modeled for inference, reinforcement-learning support, and other distributed workloads rather than frontier-model training. A June 2026 four-GPU Intel Arc Pro B70 inference workstation costs nearly $18,000. Four 230 W accelerators plus roughly 300 W of host capacity imply about 1.22 kW of installed IT power, or approximately $14,750 per installed kW. The dashboard therefore uses a rounded $15,000/kW default, a $10,000/kW aggressive commodity-hardware case, and a $30,000/kW enterprise-hardware stress case.

**Reference hull.** The public model uses 150 metric tonnes of structural hull mass for the fixed 85 m-long, 20 m-diameter reference node. Official specifications for simple flat-deck barges provide the order-of-magnitude benchmark, while Panthalassa describes its node as much lighter than a barge and structurally simple. The 150-tonne value is a transparent low-cost engineering proxy, not a Panthalassa mass estimate.

**Battery.** Battery duration is user-controlled because energy capacity and power-rated equipment scale differently. The model uses $100/kWh for marine-grade battery modules and a separate $75/kW allowance for the battery-specific bidirectional interface, management and protection equipment, thermal and fire controls, and marine integration.

**Onboard systems.** The $25,000/node allowance covers communications, tracking, navigation, telemetry, switching, antennas, control computers, power supplies, and backup tracking. Service subscriptions are excluded.

**Service intervals.** Ivar states that a payload-only swap may take less than a day, while ship-style preventative maintenance is typically performed about every five years and may take as long as a week. The model uses one day for payload-only dock work and seven days for fixed five-year full maintenance.

**Tug, repair, catastrophic loss, and retirement.** The model uses $10,000/tug-day, 3% of non-compute node cost for each five-year maintenance visit, $50,000 for a disabling Mode 2 or 3 repair, a provisional $2 million Mode 5 cleanup allowance, and a 1% gross retirement-processing allowance with no scrap-value credit.

## B.2 Failure-model limitations requiring Panthalassa review

- Independent, identical block failures omit common-cause failures, workload effects, manufacturing batches, and age-dependent hazards.
- The late-trip merge rule is an operating-policy approximation. Panthalassa should confirm how close to planned service it would tolerate degraded output rather than initiate another trip.
- Failed blocks are assumed to remain failed until physical service, and compute is assumed shut down after an actionable threshold crossing.
- Modes 2-5 rely on broad maritime and wave-energy proxies rather than Panthalassa fleet data.
- Ready replacement and immediate tug availability remove mobilization delays and may be optimistic.

## B.3 Failure-model source list

- Ivar Thorson, email to Soham Mehta, July 7, 2026: five failure modes, compute-degradation blocks, maintenance, cost, and transit assumptions.
- K. V. Vishwanath and N. Nagappan, “Characterizing Cloud Computing Hardware Reliability,” ACM Symposium on Cloud Computing, 2010.
- Microsoft Project Natick, Phase 2 reliability results, 2020.
- Allianz Commercial, *Safety and Shipping Review 2025*, using Lloyd's List Intelligence casualty statistics.
- Kamidelivand et al., “Failure Consequence Cost Analysis of Wave Energy Converters,” *Journal of Marine Science and Engineering*, 2024.
