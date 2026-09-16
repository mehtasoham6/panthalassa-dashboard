export type VisualState = 'node' | 'waves' | 'geography' | 'outbound' | 'return' | 'resource' | 'capacity' | 'battery';
export interface StoryStep { id: string; chapter: string; title: string; visual: VisualState; paragraphs: string[]; note?: string; }

export const STEPS: StoryStep[] = [
  { id: 'physical-node', chapter: '01 / The physical system', title: 'One node. Power and computing.', visual: 'node', paragraphs: [
    'A node is a floating power plant with computing hardware onboard. As waves lift and lower it, water is pushed up an internal tube into a pressurized reservoir, then flows through a turbine that drives an electrical generator. The electricity powers onboard computers, while the surrounding ocean helps cool them. Inputs and results travel between the node and land by satellite.'
  ] },
  { id: 'wave-resource', chapter: '01 / The physical system', title: 'An ocean of stored energy.', visual: 'waves', paragraphs: [
    'Ocean waves act like a giant solar battery: uneven heating by the sun creates winds, which transfer energy into the water. That energy travels as swell, persisting after the wind has subsided.',
    'How much energy a node captures depends on its size and how effectively it absorbs wave motion. Its “capture width ratio” compares the power it absorbs with the wave power arriving across a span as wide as its hull. In this model, a larger hull captures more power but requires more steel.'
  ] },
  { id: 'sea-park', chapter: '01 / The physical system', title: 'Go where the waves are.', visual: 'geography', paragraphs: [
    'Some of the richest wave resources lie in the Southern Ocean, including south of Australia, where strong winds blow across vast, uninterrupted stretches of water.',
    'Panthalassa puts computing where the waves are strongest. This model’s Southern Ocean location averages about four times the wave power per metre of wavefront estimated for Aguçadoura, the site of the world’s first commercial wave farm.'
  ], note: 'Operating far from shore can reduce exposure to coastal fouling organisms, limiting the need for cleaning that can damage protective marine coatings. Inside the node, darkness prevents sunlight-dependent growth, while recirculating water limits the influx of nutrients and organisms. The model assumes biofouling and corrosion are managed through routine maintenance rather than modeling them separately.' },
  { id: 'outbound-journey', chapter: '02 / Follow one node', title: 'The journey is productive, too.', visual: 'outbound', paragraphs: [
    'The model follows one node from port to a representative offshore operating location (the “sea park”). In the model, a tug takes it about 50 km from shore before it begins traveling under its own power to the sea park. It can generate electricity and run its computers along the way.'
  ] },
  { id: 'return-journey', chapter: '02 / Follow one node', title: 'Work. Return. Repeat.', visual: 'return', paragraphs: [
    'The node spends most of its time at the sea park, generating power for onboard computing. For scheduled maintenance, it travels back under its own power and a tug brings it into port. Computing stops during dockside service, then the cycle begins again. Repairs can also require an earlier return.'
  ] },
  { id: 'available-power', chapter: '03 / Estimate the contribution', title: 'Start with the power available.', visual: 'resource', paragraphs: [
    'The model starts by estimating the electricity waves could supply throughout a node’s operating cycle. It uses simplified wave conditions during travel and historical wave data at the sea park. The node can power computing while traveling, but computing stops during dockside maintenance.'
  ] },
  { id: 'computing-limit', chapter: '03 / Estimate the contribution', title: 'Full power, before the strongest waves.', visual: 'capacity', paragraphs: [
    'The computing payload is deliberately sized below what strong waves can support. At the defaults, its 200 kW requirement is met before outbound tugging ends. This headroom helps keep the computers fully powered through weaker waves, improving availability. A larger payload can do more computing per node, but is harder to keep running at full power all the time.'
  ] },
  { id: 'battery-output', chapter: '03 / Estimate the contribution', title: 'Bridge the gaps. Add up the energy.', visual: 'battery', paragraphs: [
    'Batteries bridge short gaps when wave power falls below the computers’ needs. Adding up the electricity supplied to computing over time gives the node’s scheduled contribution—including productive travel, weaker-wave periods, and maintenance pauses. This energy is the model’s proxy for computing delivered.'
  ] },
];

export const FAILURES = [
  ['Chip failures', 'Individual chip failures gradually reduce working computing capacity. A hot-spare margin within the installed payload lets the node tolerate some failures before returning for chip replacement. The model counts both declining capacity and the interruption for service.'],
  ['Returns under its own power', 'Some failures interrupt computing but leave the node able to travel home. The model counts the contribution lost during its return, repair, and journey back to the sea park.'],
  ['Needs a tow', 'More disabling failures require a tug to retrieve the node. The model accounts for the longer interruption associated with retrieval, repair, and redeployment.'],
  ['Node lost', 'An unrecoverable node must be replaced. The model counts the interruption until a replacement arrives and the associated replacement costs. It distinguishes deep-water losses from shallow-water incidents that can also require costly cleanup.'],
] as const;

export const COSTS = [
  ['Computing hardware', 'The initial computing payload and replacements for failed chips.'],
  ['Hull and power systems', 'The fabricated hull, equipment that converts wave motion into electricity, batteries, and onboard navigation and communications hardware.'],
  ['Operations and upkeep', 'Tug services, scheduled maintenance, repairs, retrieval of disabled nodes, and node replacement or retirement—including cleanup where applicable.'],
  ['Data transfer', 'Satellite transmission of workload inputs and results, based on the amount of computing delivered and the workload’s data requirements.'],
] as const;
