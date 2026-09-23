# Appendix

Open a section to see how a calculation works, why its assumptions were chosen, and where the evidence comes from. The model calculates expected output and costs analytically; it does not simulate individual nodes or randomly draw failures. Defaults below refer to the September 2026 reference scenario.


## How wave energy becomes electrical power

Wave flux measures the power passing through each metre of wavefront. The model converts that resource into electrical power using hull diameter, capture width ratio, and end-to-end efficiency:

$$
P_{\mathrm{wave}}(t)=F(t)\,D\,c(D)\,\eta,
\qquad c(D)=\frac{1.3(D/\mathrm{m})+5.6}{100}.
$$

Here, $t$ is time; $P_{\mathrm{wave}}(t)$ is wave-derived electrical power before equipment limits, in kW; $F(t)$ is incident wave flux in kW/m; $D$ is hull diameter; $c(D)$ is the dimensionless capture width ratio at that diameter; and $\eta$ is the dimensionless end-to-end efficiency. In the fitted relationship, $D/\mathrm{m}$ means the numerical diameter in metres, and 1.3 and 5.6 are fitted coefficients; dividing by 100 converts the fitted percentage into a fraction. Capture width ratio describes how much power the device absorbs relative to the waves crossing a span as wide as its hull. The fitted relationship comes from [Babarit’s database of wave-energy converters](https://doi.org/10.1016/j.renene.2015.02.049). The default 20 m hull and 85% efficiency describe the reference design; the efficiency is a Panthalassa engineering estimate, not an independently measured fleet result.

Electrical power supplied directly to computing is limited by both the generator and the installed computing payload:

$$
P_{\mathrm{cap}}=\min(P,P_{\mathrm{PTO}}),
\qquad
P_{\mathrm{direct}}(t)=\min\!\left(P_{\mathrm{wave}}(t),P_{\mathrm{cap}}\right).
$$

$P$ is installed rated compute power; $P_{\mathrm{PTO}}$ is the power take-off rating, set to $1.5P$; $P_{\mathrm{cap}}$ is their binding upper limit; and $P_{\mathrm{direct}}(t)$ is power supplied directly to computing before battery support. All four are in kW. This leaves generating headroom above the compute requirement. The wave flux needed to reach the compute cap, $F_{\mathrm{full}}$ in kW/m, is

$$
F_{\mathrm{full}}=\frac{P_{\mathrm{cap}}}{D\,c(D)\,\eta}.
$$

**Where the waves come from.** At sea park, the model uses [Copernicus WAVERYS](https://data.marine.copernicus.eu/product/GLOBAL_MULTIYEAR_WAV_001_032/description), with three-hourly observations from 1980–2025 at 53.6°S, 133.6°E. Significant wave height $H_s$ and energy period $T_e$ are converted into deep-water wave flux using

$$
F\approx0.49H_s^2T_e,
$$

Here, $H_s$ is significant wave height in metres, $T_e$ is energy period in seconds, and $F$ is flux in kW/m. The approximate coefficient 0.49 combines seawater density, gravity, and unit conversion in the deep-water wave-power relation. The model converts each historical observation into usable power; it does not assume the average wave resource is continuously available. The distance slider changes the travel scenario, not this resource location.

## How travel and maintenance become scheduled output

Scheduled output is the energy a node supplies to computing under its planned operating calendar, before unexpected failures. The calculation adds the area under the compute-power curve for each stage:

$$
E_{j,\mathrm{direct}}=
\int_0^{T_j}\min\!\left(P_{\mathrm{wave},j}(t),P_{\mathrm{cap}}\right)\,dt,
\qquad
E_{\mathrm{scheduled}}=\sum_j E_{j,\mathrm{adjusted}}.
$$

$j$ labels a stage in the planned calendar; $T_j$ is its duration in hours; $t$ is elapsed time within that stage; and $dt$ denotes the small time intervals accumulated by the integral. $P_{\mathrm{wave},j}(t)$ is wave-derived electrical power before equipment limits, and $P_{\mathrm{cap}}$ is the smaller of rated compute power and PTO rating, both in kW. $E_{j,\mathrm{direct}}$ is the resulting wave-supplied compute energy; $E_{j,\mathrm{adjusted}}$ adds battery discharge; and $E_{\mathrm{scheduled}}$ sums adjusted energy across all stages within the analysis period. All energy terms are in kWh. For constant power, the integral reduces to power multiplied by time.

![Illustrative operating cycle before battery support. The shaded area is electricity supplied directly to computing. The sea-park plateau is a diagrammatic simplification; the model uses historical wave variability. Stage durations are not to scale.](/images/appendix-operating-cycle.svg)

| Stage | Wave-resource treatment |
|---|---|
| Tug out | Linear increase from 0 to 40 kW/m |
| Travel out | Linear increase from 40 to 100 kW/m |
| Sea park | Historical WAVERYS observations |
| Travel back | Linear decrease from 100 to 40 kW/m |
| Tug in | Linear decrease from 40 to 0 kW/m |
| Dockside service | No computing |

Travel time is distance divided by speed. The reference route uses a 50 km near-port tug leg, a tug speed of 300 km/day, and self-propulsion at 48 km/day. These are simplified operating assumptions. The linear travel profile is illustrative; sea-park energy uses the historical distribution rather than the plateau shown in the diagram.

**Maintenance calendar.** Full maintenance nominally finishes at years 5, 10, 15, and so on, with seven days at dock. The node leaves the sea park early enough to complete the return and service by that date. Healthy chips are retained; failed chips are replaced during the visit. Chip-triggered returns may bring full maintenance forward by up to six months, as explained under chip failures. Service completed exactly at the analysis endpoint is excluded because it cannot improve output within the period.

The travel profile, full departure battery, and service policy are reference-design operating assumptions provided through Panthalassa correspondence. They are not measured averages from an operating fleet.

## How batteries bridge gaps in wave power

Battery duration specifies usable stored energy relative to rated compute power:

$$
B_{\max}=P\,b,
$$

where $b$ is duration in hours, $P$ is compute power in kW, and $B_{\max}$ is usable energy in kWh. The reference scenario uses four hours. This is a scenario setting, not a claim that four hours is the optimal design.

**During travel**, the model carries battery charge forward through the route. Every departure from port begins with a full battery. Charging is limited by the model’s available surplus and remaining storage space; discharge is limited by the power shortfall and stored energy:

$$
E_{\mathrm{charge}}=\min(E_{\mathrm{surplus}},B_{\max}-B_{\mathrm{current}}),
$$
$$
E_{\mathrm{discharge}}=\min(E_{\mathrm{gap}},B_{\mathrm{current}}),
\qquad
E_{j,\mathrm{adjusted}}=E_{j,\mathrm{direct}}+E_{\mathrm{discharge}}.
$$

All energy terms here are in kWh: $E_{\mathrm{surplus}}$ is the modeled surplus available for charging during the relevant route interval; $E_{\mathrm{gap}}$ is the energy shortfall relative to the compute cap; $B_{\mathrm{current}}$ is stored energy immediately before the charging or discharge operation; and $E_{\mathrm{charge}}$ and $E_{\mathrm{discharge}}$ are the amounts stored and supplied. For stage $j$, $E_{j,\mathrm{direct}}$ is wave-supplied compute energy and $E_{j,\mathrm{adjusted}}$ is total compute energy after battery support.

These operations follow the order of surplus and shortfall along the route. Stored energy increases when charging and decreases when discharging; it is not reset between travel stages. Dockside work remains offline regardless of battery charge.

**At sea park**, consecutive historical observations below rated power are grouped into lulls. For lull $\ell$, the missing energy is

$$
D_\ell=\sum_{i\in\ell}(P-P_i)\,\Delta t_i,
\qquad
R_\ell=\min(B_{\max},D_\ell).
$$

$i$ labels a historical observation and $\ell$ labels a consecutive below-rated-power lull. $P_i$ is wave-powered compute output in kW before battery support, capped at rated compute power $P$; $\Delta t_i$ is the observation’s duration in hours. $D_\ell$ is that lull’s total missing energy and $R_\ell$ is energy recovered by the battery, both in kWh. The notation $i\in\ell$ includes only observations belonging to that lull. The historical mean used for scheduled sea-park output is therefore

$$
\overline P_{\mathrm{sea}}=
\frac{\sum_i P_i\Delta t_i+\sum_\ell R_\ell}
{\sum_i\Delta t_i}.
$$

$\overline P_{\mathrm{sea}}$ is mean compute power in kW after battery support. The sum over $i$ covers the entire historical record; the sum over $\ell$ covers all full-power lulls. Dividing the total supplied kWh by total historical hours gives the mean used for scheduled sea-park output.

**An important simplification:** every distinct sea-park lull starts with a full battery. The model assumes enough surplus between lulls to recharge, lossless charging and discharging, no battery degradation, and sufficient discharge power. This preserves the size of historical energy deficits while avoiding a full chronological storage simulation. It is a favorable approximation; longer storage duration does not establish that all real-world interruptions would disappear.

## What the three availability metrics mean

The three metrics answer different practical questions:

- **Resource capacity factor: How much useful computing work can the node do overall?** Full-power operation earns full credit; operation at reduced power earns partial credit. Electricity used merely to keep the servers switched on is subtracted before counting useful work. This is a modeled work proxy, not a measurement of tokens or FLOPs.
- **Rated power availability: How often can the node run its full installed computing payload?** This concerns time at full power, rather than total work accumulated. A node can deliver a high average amount of work while spending some time slightly below full power.
- **Keepalive availability: How often can the servers remain switched on?** Servers need some electricity even when they are not doing useful work. This metric checks whether wave power and storage can meet that minimum; it does not require a full workload.

The sea-park calculations below use the historical record at the selected site. The dashboard then weights each of these percentages by time at the sea park, time in transit, and time at dock over the selected analysis period. The displayed journey-wide percentages do not reduce expected output or determine fleet size; those calculations independently account for travel, service, chip degradation, and expected failures.

**Shared quantities.** $P$ is rated compute power in kW; $P_{\mathrm{idle}}=0.15P$ is the server idle requirement in kW; $B_{\max}$ is usable battery energy in kWh. Historical observation $i$ lasts $\Delta t_i$ hours and supplies $P_i$ kW to computing from waves alone, after equipment limits. Total historical time is $T_{\mathrm{hist}}=\sum_i\Delta t_i$. The 15% idle requirement comes from Panthalassa; useful work above idle is assumed proportional to electrical power.

**First calculate the battery’s contribution.** For each consecutive below-full-power lull $\ell$, the energy deficit $D_\ell$ and fraction covered $q_\ell$ are

$$
D_\ell=\sum_{i\in\ell}(P-P_i)\Delta t_i,
\qquad
q_\ell=\frac{\min(B_{\max},D_\ell)}{D_\ell}.
$$

$i\in\ell$ restricts the sum to that lull. $D_\ell$ is in kWh and $q_\ell$ ranges from zero to one. Only actual below-threshold lulls enter this expression, so their deficits are positive. As in the battery section, each distinct lull is assumed to begin fully charged.

For the useful-work calculation, the model spreads recovered energy across the lull’s shortfall. Effective compute power, $P_{i,\mathrm{eff}}$ in kW, is

$$
P_{i,\mathrm{eff}}=P_i+q_\ell(P-P_i).
$$

Outside a lull, $P_{i,\mathrm{eff}}=P_i=P$. This approximation credits partial battery support without simulating a detailed charging and discharge schedule.

**Resource capacity factor.** Let $u_i$ be the fraction of full useful-work capability delivered during observation $i$:

$$
u_i=\min\!\left(1,\max\!\left(0,
\frac{P_{i,\mathrm{eff}}-P_{\mathrm{idle}}}{P-P_{\mathrm{idle}}}
\right)\right),
\qquad
\mathrm{CF}=\frac{\sum_i u_i\Delta t_i}{T_{\mathrm{hist}}}.
$$

Subtracting $P_{\mathrm{idle}}$ removes the electricity needed simply to stay on. Dividing by $P-P_{\mathrm{idle}}$ compares the remaining power with the full useful-work range. The minimum and maximum keep $u_i$ between zero and one; $\mathrm{CF}$ is its time-weighted average across all observations.

**Rated power availability.** Let $T_\ell=\sum_{i\in\ell}\Delta t_i$ be a full-power lull’s duration in hours. The model credits battery support with the same fraction of a lull’s hours as the fraction of its energy deficit covered:

$$
A_{\mathrm{rated}}=
1-\frac{\sum_\ell(1-q_\ell)T_\ell}{T_{\mathrm{hist}}}.
$$

$A_{\mathrm{rated}}$ is the estimated full-power share of historical time; the sum includes all full-power lulls. The numerator counts equivalent hours left below full power. This is an equivalent-hours estimate, not a count of full-power observations from a simulated battery dispatch.

**Keepalive availability.** Repeat the calculation using the idle threshold. Let $k$ label a consecutive lull below idle power:

$$
D_{k,\mathrm{idle}}=\sum_{i\in k}(P_{\mathrm{idle}}-P_i)\Delta t_i,
\qquad
q_{k,\mathrm{idle}}=\frac{\min(B_{\max},D_{k,\mathrm{idle}})}{D_{k,\mathrm{idle}}},
$$
$$
A_{\mathrm{keepalive}}=
1-\frac{\sum_k(1-q_{k,\mathrm{idle}})T_{k,\mathrm{idle}}}
{T_{\mathrm{hist}}}.
$$

$D_{k,\mathrm{idle}}$ is the energy missing to keep servers switched on, in kWh; $q_{k,\mathrm{idle}}$ is the fraction covered by storage; and $T_{k,\mathrm{idle}}=\sum_{i\in k}\Delta t_i$ is that lull’s duration in hours. $A_{\mathrm{keepalive}}$ is the estimated share of historical time the idle requirement can be met. If there are no below-idle lulls, the sum is zero and this metric is 100%.

**From the sea park to a working life.** The dashboard's three percentages use the *same operating calendar* as scheduled output: outbound tugging and self-propulsion, sea-park operation, return travel when it falls within the analysis period, and dockside work. For any one of the three metrics, the combination is

$$
M_{\mathrm{journey}}=
\frac{T_{\mathrm{sea}}M_{\mathrm{sea}}+T_{\mathrm{travel}}M_{\mathrm{travel}}}
{T_{\mathrm{sea}}+T_{\mathrm{travel}}+T_{\mathrm{dock}}}.
$$

$M_{\mathrm{journey}}$ is the displayed percentage expressed as a fraction; $M_{\mathrm{sea}}$ is the corresponding sea-park fraction calculated above; and $M_{\mathrm{travel}}$ is its value during travel. $T_{\mathrm{sea}}$, $T_{\mathrm{travel}}$, and $T_{\mathrm{dock}}$ are the hours spent in each setting during the selected analysis period. Dockside work contributes zero because computing stops there. The model excludes a visit that would finish exactly at the analysis endpoint, so the default five-year calculation includes the initial outward trip but no return or dockside service. Chip-triggered service trips do count if they occur within the period. These resource percentages hold computing hardware healthy and exclude unexpected whole-node failures, even though chip wear determines whether a surprise service trip occurs. They are descriptive and are **not** multiplied into scheduled energy or fleet sizing.

For travel, the existing linear wave-flux ramps determine when wave power reaches the full payload requirement or the lower idle requirement. The model integrates partial power above the idle requirement for capacity factor; it credits equivalent hours at full payload power for rated availability and equivalent hours above idle for keepalive availability. The battery starts full when the node leaves port, discharges to cover shortfalls, and can recharge from surplus wave power during travel. As with the sea-park calculations, rated and keepalive are separate ways of assessing battery support, not simultaneous claims on the same stored energy. For a partially covered segment, the model spreads the fraction of its energy deficit the battery can cover across that segment's hours. It does not simulate the exact instant during the ramp when a battery would run out. The sea-park stage retains its separate historical-lull battery approximation; its charge state is not reconstructed continuously across decades of observations.

**Why keepalive can still be 100% at departure.** The modeled wave ramp begins at zero at port, but the default 200 kW payload has an 800 kWh usable battery (four hours at full payload power). It needs about **372 kWh** to fill the entire early outbound shortfall below full power before the waves can supply 200 kW unaided. That includes the shorter interval below the 30 kW keepalive threshold. The battery can therefore keep the servers on and at full rated power throughout the modeled outbound leg; wave surplus later recharges it. The shortfall estimate comes from the model's simplified linear tug-out wave ramp and assumes the battery begins full, has adequate discharge power, and operates without energy losses. It is not a guarantee about actual coastal conditions or node uptime.

At the default five-year horizon, this weighting changes sea-park-only resource capacity factor from **97.21% to 97.23%** and rated power availability from **93.19% to 93.25%**; keepalive remains **100%**. At **zero battery**, the outward leg no longer receives battery support: the displayed journey estimates are about **95.86%** capacity factor, **87.13%** rated availability, and **99.999%** keepalive. The last value is slightly below 100% because the node briefly lacks even idle power as it leaves port. The site-specific historical sea-park keepalive measure remains 100% without storage. Small departures from 100% are shown with additional decimal places on the dashboard so they are not hidden by rounding.

All three displayed metrics are fractions expressed as percentages. A 100% modeled keepalive value reflects the particular wave record, route approximation, battery assumptions, and analysis calendar; it does not guarantee continuous fleet uptime.

## How chip failures trigger service and reduce output

Chip failures gradually reduce expected healthy capacity. Let $P$ be installed compute power in kW, $\lambda$ the annual failure hazard per unit of healthy compute, and $a$ the time in years since failed chips were last replaced. $e$ is the base of the natural exponential function, used here to describe a constant proportional failure hazard.

$$
H(a)=Pe^{-\lambda a},
\qquad
F(a)=P\left(1-e^{-\lambda a}\right).
$$

$H(a)$ is expected healthy capacity and $F(a)$ is expected failed capacity, both in kW. This use of $F(a)$ refers to failed compute, not the wave-flux variable in the wave section. The model follows this expected curve rather than simulating individual failures.

**The hot spare margin is inside the installed payload.** Both the guaranteed share and the best-effort margin contribute while healthy. Output declines as chips fail; the margin does not hold output constant. Instead, the selected share $h$ determines when degradation triggers a surprise return:

$$
H(\tau)=P(1-h),
\qquad
\tau=\frac{-\ln(1-h)}{\lambda}.
$$

$h$ is the dimensionless hot spare share; $P(1-h)$ is the healthy-capacity threshold in kW; $\tau$ is the trigger age in years since the last restoration; and $\ln$ is the natural logarithm. This expression applies for a positive failure hazard and a positive margin. A zero margin is a limiting sensitivity case, not a recommended maintenance policy.

**Service follows the calendar and the threshold together.**

- A threshold-triggered return starts when the expected failed share reaches the hot spare margin. Working chips can continue computing during the journey, subject to wave and equipment limits. Failures continue accumulating until service.
- A stand-alone payload visit uses one dock day. It replaces only failed capacity, restores compute health, and leaves the full-maintenance date unchanged.
- Full physical maintenance nominally occurs every five years and uses seven dock days. It also replaces failed chips and restores compute health.
- A surprise trip within six months before planned full maintenance combines both jobs into one seven-day visit. The model does not postpone a required return. The combined visit resets the five-year maintenance clock.

Between restorations, the healthy capacity integrated over an interval of $\Delta$ years is

$$
E_{\mathrm{healthy}}(\Delta)=
8{,}760\,P\frac{1-e^{-\lambda\Delta}}{\lambda}.
$$

$\Delta$ is time in years starting from a fully restored payload; $E_{\mathrm{healthy}}(\Delta)$ is healthy-capacity energy in kWh before resource and route constraints. The factor 8,760 converts years to hours under the model’s fixed-length-year convention. Travel output also faces wave, PTO, and battery limits; dockside output is zero. At sea park, the model multiplies expected healthy capacity by the historical electrical-energy factor for the installed configuration. It does not rerun the wave series continuously as chips fail. This is slightly conservative because a smaller healthy load would generally be easier to power. That internal energy factor is distinct from the displayed useful-work capacity factor.

Chip-related loss is the difference between scheduled energy and energy under this degradation-and-service calendar. Replacement cost at each service is failed kW at dock multiplied by the selected compute price per kW. Healthy chips remain installed.

**Evidence.** The 1% default hazard is a modeling proxy. [Cloud hardware reliability research](https://doi.org/10.1145/1807128.1807161) supports accounting for gradual failure; [Microsoft Project Natick](https://natick.research.microsoft.com/) reported one-eighth the server failure rate of its land control group. Neither establishes a transferable 1% rate for these nodes. The service policy and consolidation window come from reference-design correspondence. Chip failures and compute-only service affect the data-center calculation but are excluded from power-system LCOE.

## How whole-node failures are weighted

The model separates **how often an incident occurs** from **what happens after it occurs**. The node failure slider controls the first; fixed outcome weights control the second. A 3% slider setting means three expected incidents per 100 node-years. A 32% towing weight means 32% of those incidents require retrieval—not that 32% of nodes need towing each year.

The weights combine two public maritime datasets with an explicit judgment about where total losses occur. They are built in three steps.

**1. Separate recoverable incidents from total losses.** [Allianz’s Safety and Shipping Review 2026, pages 10–15](https://commercial.allianz.com/content/dam/onemarketing/commercial/commercial/reports/commercial-safety-shipping-review-2026.pdf) reports 905 total losses and 28,660 casualties/incidents over 2016–2025, for vessels above 100 gross tons. The incident total includes total losses, so the counts use the intended denominator: approximately 3.16% of reported incidents ended in total loss. The model rounds this to **3% total loss and 97% recoverable**.

This supports a low total-loss share among reported shipping incidents. Translating “not a total loss” into a repairable node outcome remains a modeling assumption; it does not establish the condition of the computing hardware after an accident.

**2. Divide recoverable outcomes between self-return and towing.** [Dugan and Utne’s 2024 study, Table 6](https://doi.org/10.1016/j.martra.2024.100104) examined 667 observed vessel losses of command. Within its offshore economic-zone subset, **43 of 132 events required towing**, or about 33%. The model uses this offshore subset, rather than the 27% towing share across all locations, as its proximity-to-open-ocean proxy. The remaining roughly 67% did not require towing.

Applying that split to the recoverable 97% gives the rounded weights for Modes 2 and 3:

$$
w_2\approx0.97\times0.67\approx0.65,
\qquad
w_3\approx0.97\times0.33\approx0.32.
$$

$w_2$ and $w_3$ are shares of all modeled non-chip incidents, not just recoverable incidents. The factors 0.97, 0.67, and 0.33 are the rounded recoverable, no-tow, and tow shares described above.

The study records whether ships were towed; it does not directly measure whether a failed Panthalassa node could travel home. The model maps no-tow cases to self-return and imports that split into its recoverable outcomes. Panthalassa describes a propulsion mechanism without moving parts and protected steering, giving an engineering reason why conventional machinery failures may overstate its towing needs. Conversely, conventional ships have crews and different repair capabilities. Retaining the observed offshore towing share avoids assuming an unmeasured reliability benefit from the simpler design; it does not prove that this is a conservative upper bound for autonomous nodes.

**3. Divide total losses between deep and shallow water.** Allianz’s loss-cause table records 368 foundered vessels, versus 169 wrecked or stranded, 46 collision, and 10 contact losses. These categories suggest a distinction between offshore sinking and incidents that can involve grounding or infrastructure, but they are not a geographic classification. Other causes, including fire, are also present. The model combines this directional evidence with predominantly offshore operation to assign **two-thirds of its total-loss share to deep water and one-third to shallow water**:

$$
w_4=0.03\times\frac{2}{3}=0.02,
\qquad
w_5=0.03\times\frac{1}{3}=0.01.
$$

$w_4$ and $w_5$ are shares of all non-chip incidents; 0.03 is the model’s combined total-loss share. The two-thirds/one-third allocation is an explicit judgment, not a ratio directly estimated from accident locations. Its purpose is to retain a distinct cleanup-cost consequence for shallow-water losses.

**The resulting outcomes**

| Mode | Outcome | Share of all non-chip incidents | What the interruption includes |
|---|---|---:|---|
| 2 | Compute disabled, node self returns | 65% | Return, seven-day repair, and redeployment; output during redeployment is credited. |
| 3 | Loss of control, tug retrieval | 32% | Tug dispatch, towing, seven-day repair, and redeployment; output during redeployment is credited. |
| 4 | Unrecoverable deep water loss | 2% | Deployment of a ready replacement, crediting its travel output. |
| 5 | Catastrophic shallow water loss | 1% | The same replacement treatment, plus wreckage cleanup cost. |

**How the weights enter the calculation.** Let $r$ be the aggregate rate in incidents per node-year; $m$ the mode number, from 2 through 5; $w_m$ its dimensionless weight; and $T$ the analysis duration in years. Then

$$
r_m=rw_m,
\qquad
\mu_m=r_mT,
\qquad
L_m=\mu_m\ell_m.
$$

$r_m$ is the mode-specific annual event rate; $\mu_m$ is its expected incident count per fleet position over the period; $\ell_m$ is kWh lost per incident; and $L_m$ is expected kWh lost to that mode. The weights sum to one. The slider scales all four mode rates together while leaving the mix unchanged.

The per-incident loss compares output over the same affected period with and without the incident:

$$
\ell_m=\max\!\left(0,E_{\mathrm{without incident},m}-E_{\mathrm{recovery},m}\right).
$$

$E_{\mathrm{without incident},m}$ is the computing energy expected absent that event; $E_{\mathrm{recovery},m}$ credits energy supplied during recovery and redeployment. Both are in kWh and use the resource-adjusted schedule. The table specifies the affected period for each mode. Changing the repair-price slider changes cost, not repair duration or event frequency.

For interpretation, the probability of at least one event under a constant-rate Poisson model is

$$
\Pr(\text{at least one mode }m\text{ incident})=1-e^{-r_mT}.
$$

$\Pr$ denotes probability and $e$ is the natural exponential base. Expected losses use the expected count $r_mT$, not this probability, so repeated incidents can contribute to expected losses.

**Why a 3% aggregate rate?** [UNCTAD](https://unctad.org/publication/review-maritime-transport-2025) reports 112,500 vessels at the start of 2025; Allianz records 2,818 reported incidents in that year. Their ratio is about 2.5%. The model rounds upward to allow for novel autonomous equipment and remote operations. The aggregate rate and outcome weights come from different comparisons: annual exposure informs frequency, while incident outcomes inform severity. These broad shipping benchmarks are not measured Panthalassa fleet rates.


## How expected output determines the fleet

The model subtracts chip-related and whole-node losses from scheduled output:

$$
E_{\mathrm{node}}=E_{\mathrm{scheduled}}-L_{\mathrm{chip}}
-\sum_{m=2}^{5}L_m.
$$

$E_{\mathrm{scheduled}}$ is one fleet position’s no-failure scheduled compute energy; $L_{\mathrm{chip}}$ is its loss from chip degradation and associated service; $L_m$ is expected loss from whole-node mode $m$, summed over Modes 2–5; and $E_{\mathrm{node}}$ is its resulting expected delivered energy. Every term covers the same analysis period and is measured in kWh.

For target average compute power $P_{\mathrm{target}}$ in kW and analysis duration $T$ in years, required fleet size $N$ is

$$
N=\left\lceil
\frac{8{,}760\,T\,P_{\mathrm{target}}}{E_{\mathrm{node}}}
\right\rceil.
$$

The factor 8,760 is hours per model year; multiplying it by $T$ and $P_{\mathrm{target}}$ gives target energy in kWh. $N$ is a count of required fleet positions. The brackets mean round up to a whole node. All fleet-level costs use this same required fleet.

Here, one “node” contribution means a required place in the operating fleet over the analysis period. Its physical hardware may undergo service or replacement; the calculation includes those interruptions and costs. Planned generations are assumed to overlap during replacement, avoiding an additional retirement gap.

The target is average delivered compute energy over the period. This fleet-sizing equation does not establish an every-hour service guarantee or a probability that the full target is available simultaneously. Power-system LCOE is calculated separately for a representative generating platform and does not depend on fleet rounding.

## What the cost assumptions include

The model first prices one node, then applies the fleet size and service-and-failure calendar. These defaults combine public benchmarks, design-specific inputs, and provisional allowances; they are not vendor quotations.

Let $P$ be rated compute power in kW, $D$ hull diameter in metres, and $B$ usable battery energy in kWh. $M_{\mathrm{hull}}$ is hull mass in tonnes; the 397-tonne mass and 23 m diameter are the reference design point. $C_{\mathrm{hull}}$, $C_{\mathrm{PTO}}$, $C_{\mathrm{battery}}$, and $C_{\mathrm{compute}}$ are the corresponding component costs in dollars per node. The factor 1.5 sizes PTO power relative to compute power.

$$
\begin{aligned}
M_{\mathrm{hull}}&=397\,\mathrm{tonnes}\left(\frac{D}{23\,\mathrm{m}}\right)^3,\\
C_{\mathrm{hull}}&=M_{\mathrm{hull}}c_{\mathrm{hull}},\\
C_{\mathrm{PTO}}&=(1.5P)c_{\mathrm{PTO}},\\
C_{\mathrm{battery}}&=Bc_{\mathrm{pack}}+Pc_{\mathrm{integration}},\\
C_{\mathrm{compute}}&=Pc_{\mathrm{compute}}.
\end{aligned}
$$

The unit prices are $c_{\mathrm{hull}}$ in dollars per tonne, $c_{\mathrm{PTO}}$ in dollars per kW of PTO rating, $c_{\mathrm{pack}}$ in dollars per usable kWh, and $c_{\mathrm{integration}}$ and $c_{\mathrm{compute}}$ in dollars per kW of rated compute power. The table below supplies the default values and their basis.

Adding hull, PTO, battery, and onboard systems gives physical-platform cost $C_{\mathrm{physical}}$. A new complete node costs $C_{\mathrm{node}}=C_{\mathrm{physical}}+C_{\mathrm{compute}}$.

| Capital item | Default | Evidence and interpretation |
|---|---|---|
| Fabricated hull | $2,000/tonne | Panthalassa supplied the 397-tonne, 23 m design point; other sizes use cubic scaling. This is an aggressive stripped-structure allowance, not a turnkey shipyard quote. Finished [USACE barge contracts](https://www.lrd.usace.army.mil/News/News-Releases/Article/3634651/corps-of-engineers-receiving-new-crane-barge-for-st-marys-river/) are much higher and include additional scope. |
| PTO | $200/kW of PTO rating | A [review of WEC equipment costs](https://doi.org/10.3390/su15086756) puts complete PTO systems at several hundred to over €1,000/kW. The default optimistically assumes a simpler rotating turbine-generator system. |
| Battery | $100/kWh plus $75/kW | The energy allowance is near [BloombergNEF’s 2025 pack prices](https://about.bnef.com/insights/clean-transport/lithium-ion-battery-pack-prices-fall-to-108-per-kilowatt-hour-despite-rising-metal-prices-bloombergnef/). The power/integration allowance is below the [commercial inverter benchmark](https://atb.nrel.gov/electricity/2024/commercial_battery_storage), making the combined marine installation allowance aggressive. |
| Compute | $25,000/kW | [Banca d’Italia](https://www.bancaditalia.it/pubblicazioni/qef/2026-1006/QEF_1006_26.pdf) estimates a GB200 NVL72 rack at $3 million; [NVIDIA](https://docs.nvidia.com/dgx/dgxgb200-user-guide/hardware.html) reports roughly 120 kW rack power. The ratio prices the complete compute rack, excluding the surrounding facility and power system. |
| Communications, navigation, and controls | $25,000/node | Published prices for [Starlink Maritime hardware](https://starlink.com/business/maritime), [Furuno radar](https://www.furunousa.com/en/products/1815), [AIS](https://www.furunousa.com/en/products/fa170), and [satellite compass](https://www.furunousa.com/en/products/sc70) total about $14,800. The remainder allows for controls, sensors, cabling, and integration, not a full autonomy-development or certification program. |

**Service and recovery.** These costs are charged separately so a repair allowance is not also treated as a replacement or towing charge.

| Cost | Calculation | Basis |
|---|---|---|
| Failed chips | Failed kW at service × compute price per kW | Only failed capacity is replaced; healthy chips are retained. |
| Tug services | Tug days × selected daily rate | $10,000/day default; $5,000–$50,000/day range. [WEC evidence](https://doi.org/10.3390/jmse12081251) uses €1,000–€8,000/day for small tugs; a [floating-wind study](https://doi.org/10.3390/jmse10101354) uses €40,000/day for a high-spec offshore support vessel. |
| Recoverable repairs | Selected repair price per Mode 2/3 event | $50,000 default; $20,000–$500,000 range. Benchmarks span a [small-ferry engine overhaul](https://www.miamidadetpo.org/library/studies/development-of-a-service-plan-for-waterborne-transportation-service-final-2004-12.pdf), a [tidal-turbine drivetrain repair](https://doi.org/10.3390/jmse11051046), and [large marine-engine overhauls](https://www.neptunus-power.com/blog/maintenance-reliability/marine-diesel-engine-overhaul-cost-2025/). These are repair analogies, not node quotations. |
| Full preventative maintenance | $0.03C_{\mathrm{physical}}$ per completed visit | A narrow dockside-work allowance, nominally once every five years—not 3% annually. Broader [WEC OPEX benchmarks](https://doi.org/10.3390/en14154699) include expenses charged separately here, so they do not directly establish this percentage. |
| Planned retirement | $0.01C_{\mathrm{physical}}$ | Port-side dismantling after an orderly return, with no scrap credit. [Wave-energy literature](https://doi.org/10.3390/en8077344) gives preliminary decommissioning allowances of about 0.5%–1% of project investment; applying 1% only to physical node cost is narrower. |
| Shallow-water cleanup | $2 million per Mode 5 event | Separate from replacement. Below public removal estimates of [$4.9 million](https://hidot.hawaii.gov/administration/hdot-awards-contract-for-removal-of-falls-of-clyde-from-honolulu-harbor/) and [$22 million](https://response.restoration.noaa.gov/node/865), reflecting a smaller assumed object. Highly site-dependent. |

**Total-loss replacement.** A complete replacement is physically purchased immediately. The model attributes only the destroyed asset’s remaining economic life as an incremental cost:

$$
C_{\mathrm{loss}}(a)=C_{\mathrm{node}}
\max\!\left(0,\frac{L-a}{L}\right).
$$

$C_{\mathrm{loss}}(a)$ is the incremental replacement cost attributed to a total loss at age $a$, in dollars per event; $C_{\mathrm{node}}$ is the full purchase cost of a new node including compute; and $a$ and $L$ are asset age and planned life in years. This is an economic allocation reflecting substitution for a future planned purchase; it is not the replacement cash payment or a market appraisal. Expected replacement charges use the annual event chronology. Cleanup remains additional and is not reduced by the remaining-life factor.

**Workload data transfer.** Only traffic crossing the node boundary is charged; internal GPU networking is excluded. Let $y$ index a year, $E_y$ be delivered fleet compute energy in that year in kWh, $b_{\mathrm{data}}$ be bandwidth intensity in Mbps per active compute kW, and $c_{\mathrm{data}}$ be the price in dollars per GB:

$$
V_y=0.45b_{\mathrm{data}}E_y,
\qquad
C_{\mathrm{data},y}=0.45b_{\mathrm{data}}\,c_{\mathrm{data}}E_y.
$$

$V_y$ is workload data volume in GB during year $y$; $C_{\mathrm{data},y}$ is that year’s workload-transfer cost in dollars. The factor 0.45 converts one Mbps sustained for one hour into decimal GB. The bandwidth symbol $b_{\mathrm{data}}$ is distinct from battery duration in the battery section. Cost follows delivered output after losses, not installed nameplate capacity.

The 0.03 Mbps/kW default is a text-inference proxy derived from [NVIDIA’s Llama 3.1 throughput benchmark](https://developer.nvidia.com/blog/supercharging-llama-3-1-across-nvidia-platforms/), [H200 power](https://www.nvidia.com/en-gb/data-center/h200/), and an approximate [four characters per token](https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them). The $1/GB default rounds [Starlink’s published maritime-capable plan](https://starlink.com/business/service-plans) pricing of about $1.08 per included GB. Neither represents a negotiated fleet contract or every inference workload; traffic peaks, latency, and network congestion are not modeled.

## How lifecycle cost, present value, and LCOE differ

These measures answer three different questions:

- **Total lifecycle cost: What costs does the model attribute to providing the selected computing target over the selected period?** It includes the computing hardware and the equipment and services needed around it. Costs are added without giving a smaller weight to later years. The model’s allocation of later replacement fleets is explained below, so this is not simply a record of literal cash payments.
- **Present-value cost: What is that same stream of costs worth in today’s terms?** The model gives a lower weight to costs incurred further in the future, using the selected discount rate. It includes the same items as lifecycle cost; it changes how their timing is valued. The calculation uses real dollars, so this discounting is separate from inflation.
- **Power-system LCOE: What does the generating platform cost per unit of electricity it can supply?** This removes computing hardware and other compute-specific expenses, and spreads the remaining power-system cost over electrical output. It is expressed in dollars per MWh over the node’s full economic life, rather than as the total bill for a computing fleet.

For comparisons, use the same measure on both sides: total versus total, present value versus present value, or power-system LCOE versus power-system LCOE.

**Total lifecycle cost and replacement generations.** The initial fleet is charged in full. If the analysis extends beyond a node’s planned life, a complete replacement generation begins operationally, but only the share of that later generation’s life used within the analysis period is attributed to the result:

$$
t_g=(g-1)L,
\qquad
f_g=\min\!\left(1,\max\!\left(0,\frac{T-t_g}{L}\right)\right),
\quad g\ge2.
$$

$T$ is analysis duration in years; $L$ is node life in years; $g$ is the planned generation number, with $g=1$ the initial fleet; $t_g$ is generation $g$’s start time in years from initial deployment; and $f_g$ is the dimensionless share of its useful life falling inside the analysis period. The minimum and maximum restrict that share to zero through one. This allocation applies only to later generations, $g\ge2$.

$$
C_{\mathrm{lifecycle}}=C_{\mathrm{initial}}
+\sum_{g\ge2}f_gC_g+\sum_y O_y.
$$

All cost terms are in dollars: $C_{\mathrm{lifecycle}}$ is total attributed lifecycle cost; $C_{\mathrm{initial}}$ is the full initial fleet purchase cost; $C_g$ is generation $g$’s full fleet purchase cost; and $O_y$ collects the other lifecycle charges attributed to year $y$—service, failures, cleanup, retirement, and data transfer. The first sum covers later planned generations; the second covers years within the analysis horizon under the model’s annual timing convention. Only the portion of a final partial year inside the horizon is included.

This avoids charging a whole additional fleet when the period extends only slightly beyond a replacement date. It is cost allocation, not literal cash-flow accounting: the full replacement still needs financing. The initial generation is never prorated, and no terminal residual-value credit is applied. Planned retirement is charged only when a generation actually reaches its economic end of life within the horizon.

**Present value.** Let $r$ be the annual real discount rate, expressed as a fraction. Unlike the incident-rate variable in the failure section, this $r$ values future costs:

$$
\mathrm{PV}(C_{\mathrm{lifecycle}})=C_{\mathrm{initial}}
+\sum_{g\ge2}\frac{f_gC_g}{(1+r)^{t_g}}
+\sum_y\frac{O_y}{(1+r)^y}.
$$

$\mathrm{PV}$ denotes present value in dollars. All other terms retain their lifecycle-cost definitions above. The divisor $(1+r)^t$ discounts a cost from time $t$ years after deployment to year zero; in this equation that time is either the generation start $t_g$ or annual cost time $y$. The initial fleet is charged at year zero, later generation allocations at their planned start dates, and other costs on the model’s annual schedule.

**Power-system LCOE.** The calculation is normalized to one generating-platform position over its full node life:

$$
\mathrm{LCOE}=
\frac{C_{\mathrm{physical},0}
+\displaystyle\sum_y\frac{C_{\mathrm{power},y}}{(1+r)^y}}
{\displaystyle\sum_y\frac{E_{\mathrm{power},y}}{(1+r)^y}}.
$$

$C_{\mathrm{physical},0}$ is initial non-compute platform capital in dollars, with subscript 0 denoting the initial purchase. $C_{\mathrm{power},y}$ is subsequent physical-platform cost in year $y$, in dollars; $E_{\mathrm{power},y}$ is net electrical energy supplied in that year, in MWh; and $r$ is the same annual real discount rate. Here, both sums cover the node’s full life $L$, rather than the selected data-center analysis period $T$. Costs and electrical output are discounted on the same timing convention; dividing discounted dollars by discounted MWh gives dollars per MWh. Fleet-size rounding does not enter this unit-cost calculation.

- **Include:** physical capital, battery, navigation and controls, physical maintenance, relevant tugging and repairs, the non-compute share of total-loss replacement, cleanup, and retirement.
- **Exclude:** compute hardware, failed-chip replacements, workload data transfer, and trips or downtime caused solely by compute service.
- **Electrical output:** use the historical wave and battery calculation capped by the installed power take-off (PTO) rating, rather than by the compute payload. Retain physical travel, nominal maintenance, and whole-node failure effects. Do not reduce output for chip degradation or multiply it by the displayed availability metrics.

Changing payload still changes the reference design’s PTO and battery sizes. Once that physical design is set, however, the servers do not cap the LCOE energy denominator. The whole non-compute platform is assigned to electricity production; shared equipment is not split between power and computing.

Project-level expenses not represented in the model—including development, insurance, permitting, certification, financing fees, and contingency—are not added to this LCOE. It is a model of the specified platform costs, not a bankable project quotation.
