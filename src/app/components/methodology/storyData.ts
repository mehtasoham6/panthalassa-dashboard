export type VisualState = 'node' | 'waves' | 'geography' | 'outbound' | 'return' | 'resource' | 'capacity' | 'battery';
export interface StoryStep { id: string; chapter: string; title: string; visual: VisualState; paragraphs: string[]; note?: { title: string; body: string }; }

export const STEPS: StoryStep[] = [
  { id: 'physical-node', chapter: '01 / The physical system', title: 'This is a node', visual: 'node', paragraphs: [
    'A node is a floating power plant with computing hardware onboard. As waves lift and lower it, water is pushed up an internal tube into a pressurized reservoir, then flows through a turbine that drives an electrical generator. The electricity powers onboard computers, while the surrounding ocean helps cool them. Inputs and results travel between the node and land by satellite.'
  ] },
  { id: 'wave-resource', chapter: '01 / The physical system', title: 'An ocean of stored energy', visual: 'waves', paragraphs: [
    'Ocean waves act like a giant solar battery: uneven heating by the sun creates winds, which transfer energy into the water. That energy travels as swell, persisting after the wind has subsided.',
    'How much energy a node captures depends on its size and how effectively it absorbs wave motion. Its “capture width ratio” compares the power it absorbs with the wave power arriving across a span as wide as its hull. In this model, a larger hull captures more power but requires more steel.'
  ] },
  { id: 'sea-park', chapter: '01 / The physical system', title: 'Go where the best waves are', visual: 'geography', paragraphs: [
    'Some of the most energetic waves lie in the Southern Ocean, where strong winds blow across vast, uninterrupted stretches of water. Imagine a football field-length line across the ocean. At this model’s representative location, waves passing that line carry, on average, energy equivalent to the electricity usage of **~8,000 American homes**.',
    'Considering this is only 100 meters of the vast ocean, this resource is enormous even if only a fraction of it can be captured. The challenge historically is its remoteness. Panthalassa’s approach is to put computing where the strongest waves are and send their results home, rather than bring the electricity back to shore.'
  ], note: { title: 'What about corrosion and marine growth?', body: 'Operating far from shore can reduce exposure to coastal fouling organisms, limiting the need for cleaning that can damage protective marine coatings. Inside the node, darkness prevents sunlight-dependent growth, while recirculating water limits the influx of nutrients and organisms. The model assumes biofouling and corrosion are managed through routine maintenance rather than modeling them separately.' } },
  { id: 'outbound-journey', chapter: '02 / Follow one node', title: 'The journey out to sea', visual: 'outbound', paragraphs: [
    'The model follows one node from port to a representative offshore operating location (the “sea park”). In the model, a tug takes it about 50 km from shore before it begins traveling under its own power to the sea park. It can generate electricity and run its computers along the way.'
  ] },
  { id: 'return-journey', chapter: '02 / Follow one node', title: 'Routine maintenance', visual: 'return', paragraphs: [
    'The node spends most of its time at the sea park, generating power for onboard computing. For scheduled maintenance, it travels back under its own power and a tug brings it into port. Computing stops during dockside service, then the cycle begins again. Repairs can also require an earlier return.'
  ] },
  { id: 'available-power', chapter: '03 / Estimate the contribution', title: 'Start with the power available', visual: 'resource', paragraphs: [
    'The model starts by estimating the electricity waves could supply throughout a node’s operating cycle. It uses simplified wave conditions during travel and **historical wave data** at the sea park. The node can power computing while traveling, but computing stops during dockside maintenance. The model does not assume that all wave flux becomes usable energy; see the Appendix for details on how capture-width-ratio and end-to-end efficiency are considered.'
  ], note: { title: 'What about onboard electronics?', body: "This model doesn't subtract the power used by onboard navigation, communication, and control electronics. These loads are far smaller than the keep-alive power draw of the server, which is met almost all of time. Thus, for the sake of parsimony, these are not considered in the model." } },
  { id: 'computing-limit', chapter: '03 / Estimate the contribution', title: 'Full power, before the strongest waves', visual: 'capacity', paragraphs: [
    'The computing payload is deliberately sized below what strong waves can support. At the defaults, its 200 kW requirement is met before outbound tugging ends. This headroom helps keep the computers fully powered through weaker waves, improving availability. A larger payload can do more computing per node, but is harder to keep running at full power all the time.'
  ] },
  { id: 'battery-output', chapter: '03 / Estimate the contribution', title: 'Bridge the gaps, add up the energy', visual: 'battery', paragraphs: [
    'Batteries bridge short gaps when wave power falls below the computers’ needs. Adding up the electricity supplied to computing over time gives the node’s scheduled contribution—including productive travel, weaker-wave periods, and maintenance pauses. This energy is the model’s proxy for computing delivered.'
  ] },
];

export const FAILURES = [
  ['Chip failures', 'As chips fail, output declines. The hot spare margin is the percent of installed compute that can degrade before a surprise maintenance trip is triggered.'],
  ['Compute disabled, node self returns', 'Computing stops until repairs are completed, but propulsion still works. The model counts lost output during the return and repair, then credits computing produced during redeployment.'],
  ['Loss of control, tug retrieval', 'The node cannot return independently. The model counts lost computing while a tug is dispatched, the node is recovered and repaired, and it is redeployed. Retrieval also adds tug costs.'],
  ['Unrecoverable deep water loss', 'The node and its computing payload must be replaced. The model assumes a replacement is ready to depart immediately and can compute during deployment, limiting the output interruption despite the substantial replacement cost.'],
  ['Catastrophic shallow water loss', 'Replacement follows the same assumptions as a deep-water loss, with an additional wreckage cleanup cost.'],
] as const;

export const COSTS = [
  ['Computing hardware', 'The initial computing payload and replacements for failed chips.'],
  ['Hull and power systems', 'The fabricated hull, the power take-off equipment that converts wave motion into electricity, batteries, and onboard communications and navigation controls.'],
  ['Operations and upkeep', 'Tugging, scheduled maintenance, surprise maintenance, repairs, retrieval of disabled nodes, node replacement or retirement, and wreckage cleanup (when applicable).'],
  ['Data transfer', 'Satellite transmission of workload inputs and results, based on the amount of computing delivered and the workload’s data requirements.'],
] as const;
