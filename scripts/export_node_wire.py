"""
Export a sparse wireframe line list from the Panthalassa node Blender model.

The home-page hero (src/app/components/NodeWaveHero.tsx) draws the node as
thin lines over animated wireframe waves. Drawing every mesh edge would be a
hairball, so this picks a deliberately low-density set that still reads as
the node: a globe-style float, rings and a few meridians on the tapered tube,
one ring per barrel hoop, truss members as single centrelines, the bolted
port covers as circles, and the red ladder on the float.

Usage (from the repo root):

    blender --factory-startup -b ~/art/panthalassa_3dmodel/panthalassa_node.blend \
        --python scripts/export_node_wire.py -- src/app/assets/node_wire

Writes <prefix>.bin (little-endian int16, six per segment: x0 y0 z0 x1 y1 z1,
quantized to the bounding box) and <prefix>.json (segment count, bounds, and
the unquantize formula). Coordinates are metres, +Z up, the node stands
upright with the float at the top (z ~ 58..69) and the tow eye at z ~ 0.5.
"""
import bpy, struct, json, sys, math
from collections import defaultdict
from mathutils import Vector

OUT = sys.argv[sys.argv.index('--') + 1]

TUBE_N = 128                 # lathe segments used by build_panthalassa.py
TUBE_RING_STEP = 4           # 128-gon drawn as a 32-gon
TUBE_OUTER_RINGS = 18        # profile indices 0..17 are the outer surface
TUBE_MERIDIANS = 8
HOOP_RING_STEP = 4
PORT_RING_STEP = 4           # 48-gon cover drawn as a 12-gon
LADDER_RAIL_STRIDE = 4
LADDER_RUNG_STRIDE = 2

segs = []
unhandled = defaultdict(int)


def add(a, b):
    segs.append((*a, *b))


def polyline(pts, closed=False):
    for i in range(len(pts) - 1):
        add(pts[i], pts[i + 1])
    if closed and len(pts) > 2:
        add(pts[-1], pts[0])


def circle(center, radius, n, plane='xy'):
    cx, cy, cz = center
    pts = []
    for k in range(n):
        t = 2 * math.pi * k / n
        if plane == 'xy':
            pts.append((cx + radius * math.cos(t), cy + radius * math.sin(t), cz))
        else:  # xz
            pts.append((cx + radius * math.cos(t), cy, cz + radius * math.sin(t)))
    polyline(pts, closed=True)


def sphere_globe(center, radius, lat_u=(-0.8, -0.5, 0.0, 0.5, 0.8), meridians=6, n=48):
    """Analytic latitude rings and full meridians, poles on Z."""
    cx, cy, cz = center
    for u in lat_u:
        rr = radius * math.sqrt(max(0.0, 1 - u * u))
        circle((cx, cy, cz + radius * u), rr, n)
    m = n // 2 * 2
    for j in range(meridians):
        t = math.pi * j / meridians
        pts = []
        for k in range(m):
            a = 2 * math.pi * k / m
            pts.append((cx + radius * math.cos(a) * math.cos(t),
                        cy + radius * math.cos(a) * math.sin(t),
                        cz + radius * math.sin(a)))
        polyline(pts, closed=True)


def ring_index(o, axis=2):
    """Group vertices into rings of constant local coordinate along `axis`,
    each sorted by angle about that axis."""
    me = o.data
    other = [i for i in range(3) if i != axis]
    groups = defaultdict(list)
    for v in me.vertices:
        groups[round(v.co[axis], 4)].append(v)
    rings = []
    for key in sorted(groups):
        vs = groups[key]
        vs.sort(key=lambda v: math.atan2(v.co[other[1]], v.co[other[0]]))
        rings.append(vs)
    return rings


def draw_ring(o, ring, step):
    M = o.matrix_world
    n = len(ring)
    for k in range(0, n, step):
        add(M @ ring[k].co, M @ ring[(k + step) % n].co)


def lathe_rings(o, n, ring_ids, step):
    """Lathe from build_panthalassa.py: vertex index = ring*n + k."""
    me, M = o.data, o.matrix_world
    for r in ring_ids:
        for k in range(0, n, step):
            add(M @ me.vertices[r * n + k].co, M @ me.vertices[r * n + (k + step) % n].co)


def lathe_meridians(o, n, ring_ids, count):
    me, M = o.data, o.matrix_world
    for k in range(0, n, n // count):
        for a, b in zip(ring_ids, ring_ids[1:]):
            add(M @ me.vertices[a * n + k].co, M @ me.vertices[b * n + k].co)


def cylinder_axis(o):
    """Centreline of a primitive cylinder: local Z extent through matrix_world."""
    me, M = o.data, o.matrix_world
    zs = [v.co.z for v in me.vertices]
    add(M @ Vector((0, 0, min(zs))), M @ Vector((0, 0, max(zs))))


def curve_points(o):
    M = o.matrix_world
    for sp in o.data.splines:
        yield [tuple(M @ Vector(p.co[:3])) for p in sp.points]


rung_i = 0
for o in bpy.data.objects:
    name = o.name
    if o.type == 'MESH':
        if name.startswith('Float | continuous'):
            sphere_globe(o.matrix_world.translation, o.scale.x)
        elif name.startswith('Continuous tube outer casing'):
            rings = list(range(TUBE_OUTER_RINGS))
            lathe_rings(o, TUBE_N, rings, TUBE_RING_STEP)
            lathe_meridians(o, TUBE_N, rings, TUBE_MERIDIANS)
        elif name.startswith('Barrel reinforcing hoop'):
            lathe_rings(o, TUBE_N, [2], HOOP_RING_STEP)
        elif name.startswith(('Primary truss chord', 'Truss transverse tie', 'Truss diagonal',
                              'Intake protective strut', 'Terminal tow fitting')):
            cylinder_axis(o)
        elif name.startswith('Ladder rung'):
            if rung_i % LADDER_RUNG_STRIDE == 0:
                cylinder_axis(o)
            rung_i += 1
        elif name.startswith('Black bolted cover'):
            draw_ring(o, ring_index(o)[-1], PORT_RING_STEP)
        elif name.startswith('Terminal red lifting eye'):
            circle(o.matrix_world.translation, 0.38, 12, plane='xz')
        else:
            unhandled[name.split(' ')[0] + ' ' + name.split(' ')[1] if ' ' in name else name] += 1
    elif o.type == 'CURVE':
        if name.startswith('Red float access ladder rail'):
            for pts in curve_points(o):
                polyline(pts[::LADDER_RAIL_STRIDE] + ([pts[-1]] if (len(pts) - 1) % LADDER_RAIL_STRIDE else []))
        elif name.startswith('Exterior service conduit'):
            for pts in curve_points(o):
                polyline(pts)
        else:
            unhandled[name] += 1
    else:
        continue

lo = [min(min(s[i], s[i + 3]) for s in segs) for i in range(3)]
hi = [max(max(s[i], s[i + 3]) for s in segs) for i in range(3)]
scale = [(h - l) or 1.0 for l, h in zip(lo, hi)]


def q(v, i):
    return int(round((v - lo[i]) / scale[i] * 65535)) - 32768


buf = bytearray()
for s in segs:
    buf += struct.pack('<6h', *(q(s[i], i % 3) for i in range(6)))
with open(OUT + '.bin', 'wb') as f:
    f.write(buf)
with open(OUT + '.json', 'w') as f:
    json.dump({
        'segments': len(segs),
        'min': [round(v, 4) for v in lo],
        'max': [round(v, 4) for v in hi],
        'format': 'little-endian int16, 6 per segment (x0 y0 z0 x1 y1 z1); v = min + (q + 32768) / 65535 * (max - min)',
        'units': 'metres, +Z up, float at the top',
    }, f, indent=2)
print('SEGMENTS', len(segs), 'BYTES', len(buf))
print('SKIPPED', dict(unhandled))
