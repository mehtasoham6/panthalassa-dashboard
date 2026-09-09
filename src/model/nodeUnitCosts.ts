import { CONST } from "./constants.js";
import type { DerivedQuantities, ModelInputs } from "./types.js";

/**
 * Section 7.1: cost of one newly built node, split into its compute and
 * non-compute (power-system/platform) pieces. Pure per-unit-cost math --
 * independent of fleet size, node generations, or any service/failure
 * schedule -- shared by both the integrated total-lifecycle-cost model
 * (costs.ts) and the standalone power-system LCOE model (lcoe.ts) so the two
 * never drift apart on what a node costs, while their SCHEDULES (which
 * events happen when, and which sliders drive them) stay fully separate.
 */
export interface NodeUnitCosts {
  /** Full node cost: non-compute platform + installed compute hardware. */
  physical_node_cost_usd: number;
  /** Installed compute hardware (GPUs/chips) cost only. */
  compute_hardware_cost_usd: number;
  /**
   * The non-compute, electricity-producing platform: structural hull, PTO/
   * generator, battery (pack + power/integration component), and onboard
   * navigation/communications/controls/sensors/power-supply systems. This is
   * the entire cost basis for power-system LCOE's numerator -- no partial
   * allocation of shared hardware.
   */
  non_compute_node_cost_usd: number;
  /**
   * Structural (steel) hull mass, cubically scaled off a single empirical
   * Panthalassa design point (397 t at 23.0 m hull diameter) -- geometric
   * volume scaling, not linear in diameter. Feeds hull_cost_usd only; never
   * used as an energy/power multiplier anywhere in the model.
   */
  hull_steel_mass_tonnes: number;
  /** hull_steel_mass_tonnes * finished_hull_cost_usd_per_tonne. */
  hull_cost_usd: number;
}

export function computeNodeUnitCosts(inputs: ModelInputs, derived: DerivedQuantities): NodeUnitCosts {
  // Cubic (geometric-volume) scaling off the single empirical design point --
  // NOT linear in diameter. At the 20 m default this yields ~261 t (vs. the
  // reference 397 t at 23 m).
  const hull_steel_mass_tonnes =
    CONST.reference_hull_steel_mass_tonnes * Math.pow(inputs.hull_diameter_m / CONST.reference_hull_diameter_m, 3);
  const hull_cost_usd = hull_steel_mass_tonnes * inputs.finished_hull_cost_usd_per_tonne;
  const pto_cost_usd = derived.pto_rating_kw * inputs.pto_cost_usd_per_kw;
  const battery_capacity_kwh = inputs.payload_rating_kw * inputs.battery_duration_hours;
  const battery_cost_usd =
    battery_capacity_kwh * CONST.battery_pack_cost_usd_per_kwh +
    inputs.payload_rating_kw * CONST.battery_power_system_cost_usd_per_kw;
  const compute_hardware_cost_usd = inputs.payload_rating_kw * inputs.compute_hardware_cost_usd_per_kw;
  const onboard_systems_cost_usd = CONST.onboard_systems_cost_usd_per_node;

  const physical_node_cost_usd =
    hull_cost_usd + pto_cost_usd + battery_cost_usd + onboard_systems_cost_usd + compute_hardware_cost_usd;
  const non_compute_node_cost_usd = physical_node_cost_usd - compute_hardware_cost_usd;

  return {
    physical_node_cost_usd,
    compute_hardware_cost_usd,
    non_compute_node_cost_usd,
    hull_steel_mass_tonnes,
    hull_cost_usd,
  };
}
