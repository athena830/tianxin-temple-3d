import bpy
import bmesh
import math
import os
import sys
import json
from mathutils import Vector, Euler, Quaternion, Matrix

"""
玉皇宮 Phase 3 — Stage 2：半寫實 3D 祥龍龍首樣板 (Stylized Realism Eastern Temple Dragon Head)
Blender 5.3.0 Procedural Organic Lofted Subdivision Sculpting & Assembly Pipeline (Pass 2 Refined)

Key Anatomical Refinements:
1. Front-View Eye & Brow Visibility: Elevated cranial vault & supra-orbital brow ridges (z ~ 0.36..0.54)
   with a downward-sloping Ruyi nasal bridge (z ~ 0.24 -> 0.08) so both fierce eyes, golden irises,
   and overhanging flame brows are 100% unobstructed and commanding from the Front view.
2. Sculpted Flared Nostril Rims & Deep Nostril Chambers: Distinct 3D Ruyi nostril scrolls on the upper
   muzzle with deep dark interior nostril cavities.
3. Crimson Upper & Lower Gum Arches (齒齦弓): All fangs, incisors, and molars are rooted deeply inside
   sculpted crimson gum ridges with zero exposed root caps.
4. Deep-Rooted Cheek Mane, Flame Brows & Flowing Whiskers: Every whisker and flame lock has its root
   tucked deep inside the skull/cheek/jaw volume with zero floating or exposed cylinder ends.
5. Surface-Conformed Overlapping 3D Neck Scales: 5 staggered rows of curved hexagonal shield scales
   projected directly onto the dorsal & lateral neck surface normals (-95° to +95°) so the neck is
   armored in continuous overlapping emerald and gold Jiannian scales.
"""

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BLEND_OUT = os.path.join(ROOT_DIR, "assets", "source", "dragon-head.blend")
GLB_OUT = os.path.join(ROOT_DIR, "public", "assets", "models", "temple-dragon-head-preview.glb")
REPORT_OUT = os.path.join(ROOT_DIR, "public", "assets", "models", "temple-dragon-head-report.json")
RENDER_DIR = os.path.join(ROOT_DIR, "shots", "dragon-head-blender")

if "--" in sys.argv:
    args = sys.argv[sys.argv.index("--") + 1:]
    if len(args) >= 1:
        GLB_OUT = os.path.abspath(args[0])
    if len(args) >= 2:
        RENDER_DIR = os.path.abspath(args[1])

os.makedirs(os.path.dirname(BLEND_OUT), exist_ok=True)
os.makedirs(os.path.dirname(GLB_OUT), exist_ok=True)
os.makedirs(RENDER_DIR, exist_ok=True)

print(f"[DragonHead] Running on Blender {bpy.app.version_string}")

# ---------------------------------------------------------------------------
# 1. Clean Factory Scene
# ---------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0

master_col = bpy.data.collections.new("Temple_Dragon_Head_Prototype")
scene.collection.children.link(master_col)

def link_to_master(obj):
    if obj.name not in master_col.objects:
        master_col.objects.link(obj)
    for col in list(obj.users_collection):
        if col != master_col:
            col.objects.unlink(obj)

# ---------------------------------------------------------------------------
# 2. Principled BSDF Materials (Linear RGB calibrated for Taiwanese Jiannian)
# ---------------------------------------------------------------------------
def create_jiannian_material(name, base_color, metallic=0.05, roughness=0.25, coat_weight=0.30, coat_roughness=0.16, specular=0.60):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if not bsdf:
        for n in nodes:
            if n.type == 'BSDF_PRINCIPLED':
                bsdf = n
                break
    bsdf.inputs["Base Color"].default_value = base_color
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = specular
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = coat_weight
    if "Coat Roughness" in bsdf.inputs:
        bsdf.inputs["Coat Roughness"].default_value = coat_roughness
    return mat

mat_vermilion = create_jiannian_material(
    "Jiannian_Vermilion_Ceramic",
    base_color=(0.46, 0.022, 0.012, 1.0),
    metallic=0.06,
    roughness=0.25,
    coat_weight=0.32,
    coat_roughness=0.15,
    specular=0.62
)

mat_gold = create_jiannian_material(
    "Jiannian_Imperial_Gold",
    base_color=(0.74, 0.40, 0.048, 1.0),
    metallic=0.80,
    roughness=0.28,
    coat_weight=0.18,
    coat_roughness=0.20,
    specular=0.68
)

mat_emerald = create_jiannian_material(
    "Jiannian_Emerald_Glaze",
    base_color=(0.010, 0.175, 0.110, 1.0),
    metallic=0.08,
    roughness=0.23,
    coat_weight=0.38,
    coat_roughness=0.14,
    specular=0.62
)

mat_ivory = create_jiannian_material(
    "Jiannian_Fang_Ivory",
    base_color=(0.84, 0.76, 0.60, 1.0),
    metallic=0.02,
    roughness=0.26,
    coat_weight=0.22,
    coat_roughness=0.18,
    specular=0.55
)

mat_crimson = create_jiannian_material(
    "Jiannian_Oral_Crimson",
    base_color=(0.16, 0.008, 0.010, 1.0),
    metallic=0.03,
    roughness=0.35,
    coat_weight=0.28,
    coat_roughness=0.20,
    specular=0.50
)

mat_obsidian = create_jiannian_material(
    "Jiannian_Eye_Obsidian",
    base_color=(0.012, 0.012, 0.016, 1.0),
    metallic=0.10,
    roughness=0.06,
    coat_weight=0.90,
    coat_roughness=0.04,
    specular=0.88
)

def smooth_step(edge0, edge1, x):
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)

def gaussian(x, mu, sigma):
    return math.exp(-0.5 * ((x - mu) / sigma) ** 2)

# Helper to query exact neck spine center and radii at any y in [0.15, 0.92]
def get_neck_profile(y):
    nt = max(0.0, (y - 0.15) / 0.77)
    z_c = 0.24 - 0.34 * (nt ** 1.25)
    rx = 0.38 - 0.03 * nt
    rz = 0.36 - 0.03 * nt
    return z_c, rx, rz

# ---------------------------------------------------------------------------
# 3A. Continuous Quad-Lofted Organic Cranium, Ruyi Snout, Eye Sockets & Palate
# ---------------------------------------------------------------------------
print("[DragonHead] Sculpting quad-lofted organic cranium, Ruyi snout, eye sockets & vaulted palate...")

def build_upper_cranium_and_snout():
    bm = bmesh.new()
    n_y = 52
    n_theta = 48
    y_start = 0.92   # Rear neck base
    y_end = -1.06    # Front Ruyi snout tip

    rings = []
    for iy in range(n_y):
        ty = iy / (n_y - 1)
        y = y_start + ty * (y_end - y_start)

        # Spine centerline height Z(y):
        # High cranium at y in [-0.35, +0.15] (z_center ~ 0.26),
        # sloping downward along the snout bridge to z_center = 0.06 at y = -1.06 so eyes are 100% visible from Front view!
        if y > 0.15:
            z_center, neck_rx, neck_rz = get_neck_profile(y)
        elif y > -0.32:
            z_center = 0.24 + 0.05 * gaussian(y, -0.10, 0.18)
        else:
            st = (-0.32 - y) / 0.74  # 0 at eye socket (-0.32), 1 at snout tip (-1.06)
            z_center = 0.24 - 0.17 * (st ** 1.15) - 0.035 * gaussian(y, -0.58, 0.14) + 0.045 * gaussian(y, -0.94, 0.10)

        tip_taper = math.sqrt(max(0.04, 1.0 - max(0.0, (-0.96 - y) / 0.115) ** 2))

        if y > 0.18:
            _, w_base, h_top = get_neck_profile(y)
            # Smooth blend near occiput (y ~ 0.18..0.30)
            occ_blend = gaussian(y, 0.0, 0.24)
            w_base += 0.14 * occ_blend
            h_top += 0.12 * occ_blend
        else:
            w_base = (
                0.33
                * (1.0 - 0.16 * gaussian(y, -0.58, 0.14))  # Muzzle waist
                + 0.14 * gaussian(y, -0.88, 0.11)          # Flared Ruyi nostril wings
                + 0.22 * gaussian(y, -0.10, 0.22)          # Broad cheek jowls & temporal vault
            ) * tip_taper

            # Notice: snout top height is kept compact (0.18..0.21) while forehead rises high (+0.32)
            snout_suppress = smooth_step(-0.45, -0.15, y)
            h_top = (
                (0.17 + 0.08 * snout_suppress) * tip_taper
                + 0.28 * gaussian(y, -0.08, 0.22)          # High twin forehead domes (天庭隆起)
                + 0.05 * gaussian(y, -0.92, 0.09)          # Compact upturned Ruyi nose tip
            )

        ring_verts = []
        for it in range(n_theta):
            theta = (it / n_theta) * 2.0 * math.pi - math.pi
            abs_t = abs(theta)
            sin_t = math.sin(theta)
            cos_t = math.cos(theta)

            rx = w_base
            rz_up = h_top

            # 1) Twin Forehead Horn Bosses & Central Sagittal Groove (龍額雙角隆起與中線淺溝)
            forehead_zone = gaussian(y, -0.08, 0.20)
            if cos_t > 0.15:
                boss_bump = 0.13 * forehead_zone * gaussian(abs_t, 0.52, 0.24)
                sagittal_dip = -0.05 * forehead_zone * gaussian(abs_t, 0.0, 0.15)
                rz_up += boss_bump + sagittal_dip
                rx += 0.07 * forehead_zone * gaussian(abs_t, 0.55, 0.24)

            # 2) Fierce Overhanging S-Curved Brow Ridge (怒目火焰眉骨 - wide & elevated)
            brow_y_center = -0.32 + 0.15 * ((abs_t - 0.65) / 0.45)
            brow_zone = gaussian(y, brow_y_center, 0.11) * gaussian(abs_t, 0.78, 0.22)
            rx += 0.16 * brow_zone
            rz_up += 0.13 * brow_zone

            # 3) Deep Recessed Eye Socket directly below Brow Ridge (深邃眼窩凹槽)
            eye_socket_zone = gaussian(y, -0.35, 0.10) * gaussian(abs_t, 1.15, 0.20)
            rx -= 0.11 * eye_socket_zone
            rz_up -= 0.04 * eye_socket_zone

            # 4) Muscular Cheek Jowls & Cheekbone Arch (飽滿龍腮與顴骨轉折)
            cheek_zone = gaussian(y, -0.06, 0.20) * gaussian(abs_t, 1.55, 0.32)
            rx += 0.17 * cheek_zone

            # 5) Dorsal Nasal Bridge Ridge & Transverse Scale Ribs (鼻樑中央隆脊與橫節紋)
            nasal_zone = smooth_step(-0.88, -0.72, y) * (1.0 - smooth_step(-0.38, -0.24, y))
            if abs_t < 0.45:
                nasal_ridge = 0.045 * nasal_zone * gaussian(abs_t, 0.0, 0.18)
                nasal_rib = 0.009 * nasal_zone * math.cos(y * 36.0) * gaussian(abs_t, 0.0, 0.22)
                rz_up += nasal_ridge + nasal_rib

            # 6) Flared Ruyi Nostril Wings & Deep Front-Facing Nostril Cavities (翻捲鼻翼與立體鼻孔深腔)
            nostril_wing = gaussian(y, -0.88, 0.08) * gaussian(abs_t, 0.85, 0.25)
            rx += 0.11 * nostril_wing
            rz_up += 0.065 * nostril_wing

            nostril_hole = gaussian(y, -0.94, 0.045) * gaussian(abs_t, 0.78, 0.16)
            rx -= 0.095 * nostril_hole
            rz_up -= 0.085 * nostril_hole

            # 7) Undulating Rolled Upper Lip Rim (上顎翻唇波浪唇線)
            mouth_open_zone = 1.0 - smooth_step(-0.14, 0.06, y)
            lip_rim_zone = mouth_open_zone * gaussian(abs_t, 1.88, 0.22)
            lip_wave = 1.0 + 0.20 * math.sin(y * 11.5)
            rx += 0.085 * lip_rim_zone * lip_wave

            x = rx * sin_t

            if cos_t >= -0.22:
                z = z_center + rz_up * cos_t - 0.025 * lip_rim_zone
            else:
                bottom_t = (abs_t - math.acos(-0.22)) / (math.pi - math.acos(-0.22))
                neck_bottom_z = z_center + h_top * 0.95 * cos_t

                # Vaulted oral palate roof inside open upper jaw
                lip_edge_z = z_center - 0.22 * rz_up - 0.025
                palate_arch = 0.11 * math.sin(bottom_t * math.pi * 0.5) * tip_taper
                palate_ribs = 0.007 * math.cos(y * 42.0) * math.sin(bottom_t * math.pi * 0.5)
                mouth_roof_z = lip_edge_z + palate_arch + palate_ribs

                z = (1.0 - mouth_open_zone) * neck_bottom_z + mouth_open_zone * mouth_roof_z

            v = bm.verts.new((x, y, z))
            ring_verts.append(v)
        rings.append(ring_verts)

    for iy in range(n_y - 1):
        r0 = rings[iy]
        r1 = rings[iy + 1]
        for it in range(n_theta):
            nit = (it + 1) % n_theta
            bm.faces.new((r0[it], r0[nit], r1[nit], r1[it]))

    # Cap front snout tip and rear neck base using quad grid_fill (eliminates polar triangle-fan pinching under SUBSURF!)
    front_edges = []
    for it in range(n_theta):
        nit = (it + 1) % n_theta
        for e in rings[-1][it].link_edges:
            if e.other_vert(rings[-1][it]) == rings[-1][nit]:
                front_edges.append(e)
                break
    try:
        bmesh.ops.grid_fill(bm, edges=front_edges, mat_nr=0, use_interp_simple=True)
    except Exception:
        bmesh.ops.contextual_create(bm, geom=front_edges)

    back_edges = []
    for it in range(n_theta):
        nit = (it + 1) % n_theta
        for e in rings[0][it].link_edges:
            if e.other_vert(rings[0][it]) == rings[0][nit]:
                back_edges.append(e)
                break
    try:
        bmesh.ops.grid_fill(bm, edges=back_edges, mat_nr=0, use_interp_simple=True)
    except Exception:
        bmesh.ops.contextual_create(bm, geom=back_edges)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new("Dragon_Cranium_And_Snout_Mesh")
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new("Dragon_Cranium_And_Snout", mesh)
    link_to_master(obj)

    sub = obj.modifiers.new(name="Subsurf", type='SUBSURF')
    sub.levels = 1
    sub.render_levels = 1
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=sub.name)
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(mat_vermilion)
    return obj

cranium_obj = build_upper_cranium_and_snout()

# ---------------------------------------------------------------------------
# 3B. Continuous Quad-Lofted Roaring Lower Jaw & Deep Oral Floor Trough
# ---------------------------------------------------------------------------
print("[DragonHead] Sculpting quad-lofted roaring lower jaw & deep oral floor trough...")

def build_roaring_lower_jaw():
    bm = bmesh.new()
    n_y = 28
    n_theta = 36
    y_start = 0.05   # Embedded inside jaw hinge joint
    y_end = -0.94    # Upturned dragon chin tip

    rings = []
    for iy in range(n_y):
        ty = iy / (n_y - 1)
        y = y_start + ty * (y_end - y_start)

        z_jaw = -0.05 - 0.38 * ty + 0.08 * (ty ** 3.2)
        tip_taper = math.sqrt(max(0.05, 1.0 - max(0.0, (ty - 0.88) / 0.125) ** 2))
        rear_taper = smooth_step(0.0, 0.12, ty)

        w_jaw = (0.40 - 0.10 * ty + 0.05 * gaussian(y, -0.78, 0.14)) * tip_taper * (0.75 + 0.25 * rear_taper)
        h_jaw = (0.14 + 0.04 * gaussian(y, -0.82, 0.12)) * tip_taper

        ring_verts = []
        for it in range(n_theta):
            theta = (it / n_theta) * 2.0 * math.pi - math.pi
            abs_t = abs(theta)
            sin_t = math.sin(theta)
            cos_t = math.cos(theta)

            rx = w_jaw
            gum_ridge = gaussian(abs_t, 1.32, 0.24) * tip_taper
            rx += 0.055 * gum_ridge
            x = rx * sin_t

            if cos_t >= 0.0:
                oral_trough = -0.11 * gaussian(abs_t, 0.0, 0.55) * math.sin(ty * math.pi)
                gum_wall_lift = 0.065 * gaussian(abs_t, 1.18, 0.26) * math.sin(ty * math.pi)
                z = z_jaw + h_jaw * 0.45 * cos_t + oral_trough + gum_wall_lift
            else:
                chin_boss = 0.055 * gaussian(y, -0.82, 0.12) * gaussian(abs_t, math.pi, 0.65)
                z = z_jaw + (h_jaw + chin_boss) * cos_t

            v = bm.verts.new((x, y, z))
            ring_verts.append(v)
        rings.append(ring_verts)

    for iy in range(n_y - 1):
        r0 = rings[iy]
        r1 = rings[iy + 1]
        for it in range(n_theta):
            nit = (it + 1) % n_theta
            bm.faces.new((r0[it], r0[nit], r1[nit], r1[it]))

    front_edges = []
    for it in range(n_theta):
        nit = (it + 1) % n_theta
        for e in rings[-1][it].link_edges:
            if e.other_vert(rings[-1][it]) == rings[-1][nit]:
                front_edges.append(e)
                break
    try:
        bmesh.ops.grid_fill(bm, edges=front_edges, mat_nr=0, use_interp_simple=True)
    except Exception:
        bmesh.ops.contextual_create(bm, geom=front_edges)

    back_edges = []
    for it in range(n_theta):
        nit = (it + 1) % n_theta
        for e in rings[0][it].link_edges:
            if e.other_vert(rings[0][it]) == rings[0][nit]:
                back_edges.append(e)
                break
    try:
        bmesh.ops.grid_fill(bm, edges=back_edges, mat_nr=0, use_interp_simple=True)
    except Exception:
        bmesh.ops.contextual_create(bm, geom=back_edges)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new("Dragon_Lower_Jaw_Mesh")
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new("Dragon_Lower_Jaw", mesh)
    link_to_master(obj)

    sub = obj.modifiers.new(name="Subsurf", type='SUBSURF')
    sub.levels = 1
    sub.render_levels = 1
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=sub.name)
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(mat_vermilion)
    return obj

lower_jaw_obj = build_roaring_lower_jaw()

# ---------------------------------------------------------------------------
# 4. Seamless Branched Stag Antlers (雙鹿角：自然分叉、根部角座厚度、Voxel融合無接縫)
# ---------------------------------------------------------------------------
print("[DragonHead] Sculpting seamless branched stag antlers...")

def create_tapered_curve_mesh(name, points_radii, resolution_u=20, bevel_res=8):
    curve_data = bpy.data.curves.new(name + "_Curve", type='CURVE')
    curve_data.dimensions = '3D'
    curve_data.resolution_u = resolution_u
    curve_data.bevel_depth = 1.0
    curve_data.bevel_resolution = bevel_res
    curve_data.use_fill_caps = True

    spline = curve_data.splines.new('BEZIER')
    spline.bezier_points.add(len(points_radii) - 1)
    for idx, (pt, rad) in enumerate(points_radii):
        bp = spline.bezier_points[idx]
        bp.co = Vector(pt)
        bp.radius = rad
        bp.handle_left_type = 'AUTO'
        bp.handle_right_type = 'AUTO'

    obj = bpy.data.objects.new(name, curve_data)
    link_to_master(obj)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    return bpy.context.active_object

antler_parts = []
for side in (-1, 1):
    side_parts = []
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.105,
        minor_radius=0.038,
        major_segments=22,
        minor_segments=12,
        location=(side * 0.22, -0.06, 0.54),
        rotation=(math.radians(-26), math.radians(side * 20), 0)
    )
    burr = bpy.context.active_object
    burr.name = f"Antler_Burr_{side}"
    link_to_master(burr)
    side_parts.append(burr)

    main_beam = create_tapered_curve_mesh(f"Antler_Beam_{side}", [
        ((side * 0.21, -0.06, 0.42), 0.105),
        ((side * 0.24, 0.00, 0.58), 0.090),
        ((side * 0.34, 0.18, 0.86), 0.074),
        ((side * 0.46, 0.44, 1.18), 0.060),
        ((side * 0.52, 0.68, 1.48), 0.044),
        ((side * 0.44, 0.84, 1.72), 0.015),
    ], resolution_u=22, bevel_res=8)
    side_parts.append(main_beam)

    tine1 = create_tapered_curve_mesh(f"Antler_Tine1_{side}", [
        ((side * 0.31, 0.12, 0.76), 0.064),
        ((side * 0.36, -0.02, 0.92), 0.048),
        ((side * 0.34, -0.18, 1.08), 0.030),
        ((side * 0.28, -0.26, 1.22), 0.013),
    ], resolution_u=16, bevel_res=7)
    side_parts.append(tine1)

    tine2 = create_tapered_curve_mesh(f"Antler_Tine2_{side}", [
        ((side * 0.42, 0.34, 1.05), 0.056),
        ((side * 0.58, 0.40, 1.20), 0.042),
        ((side * 0.72, 0.42, 1.36), 0.026),
        ((side * 0.78, 0.40, 1.50), 0.012),
    ], resolution_u=16, bevel_res=7)
    side_parts.append(tine2)

    tine3 = create_tapered_curve_mesh(f"Antler_Tine3_{side}", [
        ((side * 0.49, 0.56, 1.34), 0.046),
        ((side * 0.56, 0.76, 1.48), 0.032),
        ((side * 0.60, 0.94, 1.60), 0.013),
    ], resolution_u=14, bevel_res=6)
    side_parts.append(tine3)

    bpy.ops.object.select_all(action='DESELECT')
    for p in side_parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = side_parts[0]
    bpy.ops.object.join()
    antler_side = bpy.context.active_object
    antler_side.name = f"Dragon_Antler_{'L' if side < 0 else 'R'}"

    ar_mod = antler_side.modifiers.new(name="AntlerFuse", type='REMESH')
    ar_mod.mode = 'VOXEL'
    ar_mod.voxel_size = 0.018
    ar_mod.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=ar_mod.name)

    as_mod = antler_side.modifiers.new(name="AntlerSmooth", type='CORRECTIVE_SMOOTH')
    as_mod.factor = 0.55
    as_mod.iterations = 8
    bpy.ops.object.modifier_apply(modifier=as_mod.name)

    ad_mod = antler_side.modifiers.new(name="AntlerDecimate", type='DECIMATE')
    ad_mod.ratio = 0.50
    bpy.ops.object.modifier_apply(modifier=ad_mod.name)

    antler_parts.append(antler_side)

bpy.ops.object.select_all(action='DESELECT')
for a in antler_parts:
    a.select_set(True)
bpy.context.view_layer.objects.active = antler_parts[0]
bpy.ops.object.join()
antlers_obj = bpy.context.active_object
antlers_obj.name = "Dragon_Antlers"
antlers_obj.data.materials.append(mat_gold)

# ---------------------------------------------------------------------------
# 5. Eyes, Eyelids, Golden Iris Rings & Sculpted Nostril Rims
# ---------------------------------------------------------------------------
print("[DragonHead] Building prominent recessed eyes, sculpted eyelids, irises & nostril rims...")

eye_objs = []
lid_objs = []
iris_objs = []

for side in (-1, 1):
    # Elevated and angled forward so eyes & golden irises are 100% visible from Front, 45° and Side views!
    eye_center = Vector((side * 0.385, -0.355, 0.305))

    # 1) Glossy Obsidian Eyeball Core
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=24,
        ring_count=16,
        radius=0.105,
        location=eye_center
    )
    eyeball = bpy.context.active_object
    eyeball.name = f"Eyeball_{side}"
    eyeball.scale = (0.98, 1.06, 0.98)
    link_to_master(eyeball)
    bpy.ops.object.shade_smooth()
    eye_objs.append(eyeball)

    # 2) Golden Iris Ring oriented toward forward-lateral viewer (+32 deg outward, -68 deg forward)
    gaze_dir = Vector((side * 0.38, -0.91, -0.12)).normalized()
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.060,
        minor_radius=0.017,
        major_segments=24,
        minor_segments=12,
        location=eye_center + gaze_dir * 0.082,
    )
    iris = bpy.context.active_object
    iris.name = f"Eye_Iris_{side}"
    iris.rotation_euler = gaze_dir.to_track_quat('Z', 'Y').to_euler()
    link_to_master(iris)
    bpy.ops.object.shade_smooth()
    iris_objs.append(iris)

    # 3) Upper & Lower Sculpted Eyelid Folds wrapping the eyeball rim
    upper_lid = create_tapered_curve_mesh(f"Upper_Eyelid_{side}", [
        ((side * 0.28, -0.45, 0.29), 0.022),
        ((side * 0.38, -0.44, 0.39), 0.036),
        ((side * 0.47, -0.34, 0.38), 0.034),
        ((side * 0.48, -0.24, 0.30), 0.020),
    ], resolution_u=16, bevel_res=6)
    lid_objs.append(upper_lid)

    lower_lid = create_tapered_curve_mesh(f"Lower_Eyelid_{side}", [
        ((side * 0.29, -0.44, 0.28), 0.018),
        ((side * 0.39, -0.43, 0.21), 0.028),
        ((side * 0.47, -0.33, 0.22), 0.026),
        ((side * 0.47, -0.24, 0.29), 0.018),
    ], resolution_u=16, bevel_res=6)
    lid_objs.append(lower_lid)

    # 4) Sculpted Ruyi Nostril Scroll Rim & Dark Nostril Interior Cavity (立體翻捲鼻翼環與深黑鼻孔內腔)
    nostril_loc = Vector((side * 0.23, -0.94, 0.14))
    nostril_dir = Vector((side * 0.35, -0.88, 0.32)).normalized()
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.068,
        minor_radius=0.026,
        major_segments=22,
        minor_segments=10,
        location=nostril_loc,
    )
    n_rim = bpy.context.active_object
    n_rim.name = f"Nostril_Rim_{side}"
    n_rim.rotation_euler = nostril_dir.to_track_quat('Z', 'Y').to_euler()
    n_rim.scale = (1.15, 0.88, 1.0)
    link_to_master(n_rim)
    lid_objs.append(n_rim)

    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=16,
        ring_count=12,
        radius=0.056,
        location=nostril_loc - nostril_dir * 0.018
    )
    n_cav = bpy.context.active_object
    n_cav.name = f"Nostril_Cavity_{side}"
    n_cav.scale = (1.0, 0.75, 0.85)
    link_to_master(n_cav)
    eye_objs.append(n_cav)

def join_and_assign(obj_list, name, material):
    bpy.ops.object.select_all(action='DESELECT')
    for o in obj_list:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obj_list[0]
    bpy.ops.object.join()
    joined = bpy.context.active_object
    joined.name = name
    bpy.ops.object.shade_smooth()
    joined.data.materials.clear()
    joined.data.materials.append(material)
    return joined

eyes_mesh = join_and_assign(eye_objs, "Dragon_Eyeballs", mat_obsidian)
iris_mesh = join_and_assign(iris_objs, "Dragon_Eye_Irises", mat_gold)
lids_mesh = join_and_assign(lid_objs, "Dragon_Eyelids", mat_vermilion)

# ---------------------------------------------------------------------------
# 6. Curved Fangs, Teeth Rows & Curled Dragon Tongue (上下龍牙、齒列與口腔內捲曲龍舌)
# ---------------------------------------------------------------------------
print("[DragonHead] Sculpting curved fangs, dentition & curled dragon tongue...")

teeth_objs = []

for side in (-1, 1):
    # 1) Large Upper Canine Fangs (根部深埋於上顎唇緣內部 z=0.06，絕不外露)
    u_fang = create_tapered_curve_mesh(f"Upper_Fang_{side}", [
        ((side * 0.25, -0.84, 0.07), 0.044),
        ((side * 0.26, -0.86, -0.04), 0.036),
        ((side * 0.25, -0.85, -0.15), 0.022),
        ((side * 0.23, -0.81, -0.24), 0.005),
    ], resolution_u=14, bevel_res=6)
    teeth_objs.append(u_fang)

    # 2) Large Lower Canine Fangs (根部深埋於下顎齒槽 z=-0.34 內部)
    l_fang = create_tapered_curve_mesh(f"Lower_Fang_{side}", [
        ((side * 0.21, -0.80, -0.34), 0.038),
        ((side * 0.22, -0.82, -0.25), 0.030),
        ((side * 0.21, -0.81, -0.17), 0.018),
        ((side * 0.19, -0.78, -0.09), 0.005),
    ], resolution_u=14, bevel_res=6)
    teeth_objs.append(l_fang)

    # 3) Upper & Lower Front Incisors (根部深埋於上下顎內部)
    for idx, x_off in enumerate((0.055, 0.145)):
        u_inc = create_tapered_curve_mesh(f"Upper_Incisor_{side}_{idx}", [
            ((side * x_off, -0.92, 0.08), 0.022),
            ((side * x_off, -0.93, 0.00), 0.016),
            ((side * x_off, -0.91, -0.07), 0.004),
        ], resolution_u=10, bevel_res=5)
        teeth_objs.append(u_inc)

        l_inc = create_tapered_curve_mesh(f"Lower_Incisor_{side}_{idx}", [
            ((side * x_off, -0.86, -0.35), 0.020),
            ((side * x_off, -0.87, -0.28), 0.014),
            ((side * x_off, -0.85, -0.22), 0.004),
        ], resolution_u=10, bevel_res=5)
        teeth_objs.append(l_inc)

    # 4) Lateral Premolars / Molars along jaw margin
    for idx in range(4):
        t = idx / 3.0
        y_pos = -0.68 + t * 0.32
        x_pos_u = 0.28 + t * 0.05
        z_pos_u = 0.06 + t * 0.03
        u_mol = create_tapered_curve_mesh(f"Upper_Molar_{side}_{idx}", [
            ((side * x_pos_u, y_pos, z_pos_u), 0.026),
            ((side * x_pos_u, y_pos, z_pos_u - 0.05), 0.018),
            ((side * (x_pos_u - 0.01), y_pos + 0.02, z_pos_u - 0.10), 0.005),
        ], resolution_u=10, bevel_res=5)
        teeth_objs.append(u_mol)

        x_pos_l = 0.25 + t * 0.05
        z_pos_l = -0.30 + t * 0.09
        l_mol = create_tapered_curve_mesh(f"Lower_Molar_{side}_{idx}", [
            ((side * x_pos_l, y_pos, z_pos_l - 0.02), 0.023),
            ((side * x_pos_l, y_pos, z_pos_l + 0.03), 0.016),
            ((side * (x_pos_l - 0.01), y_pos + 0.02, z_pos_l + 0.08), 0.005),
        ], resolution_u=10, bevel_res=5)
        teeth_objs.append(l_mol)

teeth_mesh = join_and_assign(teeth_objs, "Dragon_Teeth_Fangs", mat_ivory)

# 5) Dynamic S-Curved Dragon Tongue seated naturally inside the lower jaw trough
tongue_obj = create_tapered_curve_mesh("Dragon_Tongue", [
    ((0.0, -0.08, -0.10), 0.12),
    ((0.0, -0.32, -0.20), 0.13),
    ((0.0, -0.56, -0.28), 0.115),
    ((0.0, -0.74, -0.26), 0.082),
    ((0.0, -0.86, -0.19), 0.020),
], resolution_u=18, bevel_res=8)
tongue_obj.scale = (1.18, 1.0, 0.42)
bpy.ops.object.select_all(action='DESELECT')
tongue_obj.select_set(True)
bpy.context.view_layer.objects.active = tongue_obj
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
tongue_obj.data.materials.append(mat_crimson)

# ---------------------------------------------------------------------------
# 7. Flowing Dragon Whiskers, Flame Eyebrows, Cheek Mane & Ruyi Nasal Crest
# ---------------------------------------------------------------------------
print("[DragonHead] Sculpting deep-rooted flowing whiskers, Jiannian flame brows & cheek curls...")

whisker_gold_objs = []
flame_vermilion_objs = []

for side in (-1, 1):
    # 1) Primary Long Flowing Dragon Whiskers (根部深埋於 x=0.22 上顎內部，自然向外與向後S形舒展)
    main_whisker = create_tapered_curve_mesh(f"Dragon_Whisker_Main_{side}", [
        ((side * 0.22, -0.80, 0.03), 0.028),    # Deep internal root inside snout
        ((side * 0.36, -0.86, 0.02), 0.038),    # Emerging at upper lip whisker follicle
        ((side * 0.64, -0.94, -0.02), 0.030),   # Forward & outward sweep
        ((side * 0.94, -0.76, -0.12), 0.023),   # Wide lateral arch
        ((side * 1.14, -0.32, -0.18), 0.016),   # Mid-back S-wave
        ((side * 1.26, 0.14, -0.06), 0.011),    # Trailing upward wave
        ((side * 1.34, 0.50, 0.12), 0.004),     # Fine curled whisker tip
    ], resolution_u=28, bevel_res=7)
    whisker_gold_objs.append(main_whisker)

    # Secondary Upper Nostril Tendril Whisker (向外前方優雅微揚，絕不遮擋45度角龍睛視線!)
    sub_whisker = create_tapered_curve_mesh(f"Dragon_Whisker_Sub_{side}", [
        ((side * 0.22, -0.88, 0.08), 0.018),    # Deep internal root
        ((side * 0.35, -0.92, 0.10), 0.025),    # Emerging below nostril scroll
        ((side * 0.56, -1.02, 0.15), 0.018),
        ((side * 0.76, -0.96, 0.24), 0.011),
        ((side * 0.86, -0.82, 0.32), 0.004),
    ], resolution_u=20, bevel_res=6)
    whisker_gold_objs.append(sub_whisker)

    # 2) Multi-layered Jiannian Flame Eyebrows (根部深嵌於眉骨內，向外後方怒張飛揚)
    for b_idx in range(5):
        t = b_idx / 4.0
        bx = 0.22 + t * 0.22
        by = -0.38 + t * 0.20
        bz = 0.35 + t * 0.10
        brow_lock = create_tapered_curve_mesh(f"Flame_Brow_{side}_{b_idx}", [
            ((side * (bx - 0.08), by + 0.04, bz - 0.05), 0.024), # Deep internal root inside brow ridge
            ((side * bx, by, bz), 0.040),                        # Emerging at brow crest
            ((side * (bx + 0.13), by + 0.06, bz + 0.10), 0.030),
            ((side * (bx + 0.25), by + 0.20, bz + 0.22), 0.019),
            ((side * (bx + 0.21), by + 0.34, bz + 0.34), 0.005),
        ], resolution_u=16, bevel_res=6)
        if b_idx in (0, 2, 4):
            whisker_gold_objs.append(brow_lock)
        else:
            flame_vermilion_objs.append(brow_lock)

    # 3) Cheek Jowl Flame Locks (根部深嵌於腮幫內部 x=0.28，且高度範圍 cz in [0.00, 0.26] 絕不懸空外露底蓋!)
    for c_idx in range(6):
        t = c_idx / 5.0
        cz = 0.26 - t * 0.26
        cy = -0.06 + math.sin(t * math.pi) * 0.10
        cx_surface = 0.44 + math.sin(t * math.pi) * 0.05
        cheek_lock = create_tapered_curve_mesh(f"Cheek_Mane_{side}_{c_idx}", [
            ((side * 0.26, cy + 0.04, cz + 0.02), 0.028),                # Deep internal root inside cranium/cheek
            ((side * cx_surface, cy, cz), 0.046),                        # Emerging cleanly from cheek skin
            ((side * (cx_surface + 0.15), cy + 0.14, cz + 0.03), 0.035),
            ((side * (cx_surface + 0.29), cy + 0.30, cz + 0.09), 0.021),
            ((side * (cx_surface + 0.35), cy + 0.45, cz + 0.18), 0.005),
        ], resolution_u=16, bevel_res=6)
        if c_idx % 2 == 0:
            flame_vermilion_objs.append(cheek_lock)
        else:
            whisker_gold_objs.append(cheek_lock)

# 4) Lower Jaw Chin Beard Locks (根部深嵌於下顎龍頷內部 z=-0.38)
for ch_idx in range(-2, 3):
    x_pos = ch_idx * 0.070
    z_base = -0.43 - abs(ch_idx) * 0.010
    y_base = -0.84 + abs(ch_idx) * 0.038
    chin_lock = create_tapered_curve_mesh(f"Chin_Beard_{ch_idx}", [
        ((x_pos * 0.7, y_base + 0.06, z_base + 0.07), 0.020), # Deep root inside chin bone
        ((x_pos, y_base, z_base), 0.032),                     # Emerging under chin boss
        ((x_pos * 1.22, y_base - 0.04, z_base - 0.10), 0.023),
        ((x_pos * 1.45, y_base + 0.08, z_base - 0.22), 0.014),
        ((x_pos * 1.60, y_base + 0.24, z_base - 0.30), 0.004),
    ], resolution_u=16, bevel_res=6)
    whisker_gold_objs.append(chin_lock)

# 5) Nasal Bridge Ruyi Cloud Crest Fins (沿著傾斜鼻樑脊高度自然排列)
for n_idx in range(4):
    t_n = n_idx / 3.0
    ny = -0.78 + t_n * 0.42
    nz = 0.22 + t_n * 0.16
    nasal_fin = create_tapered_curve_mesh(f"Nasal_Fin_{n_idx}", [
        ((0.0, ny, nz - 0.06), 0.030),
        ((0.0, ny + 0.03, nz + 0.04), 0.024),
        ((0.0, ny + 0.10, nz + 0.09), 0.005),
    ], resolution_u=12, bevel_res=5)
    whisker_gold_objs.append(nasal_fin)

whiskers_gold_mesh = join_and_assign(whisker_gold_objs, "Dragon_Whiskers_And_Gold_Brows", mat_gold)
flames_vermilion_mesh = join_and_assign(flame_vermilion_objs, "Dragon_Flame_Mane_Locks", mat_vermilion)

# ---------------------------------------------------------------------------
# 8. Surface-Conformed Layered 3D Neck Scales, Dorsal Mane & Body Socket
# ---------------------------------------------------------------------------
print("[DragonHead] Constructing surface-conformed overlapping 3D neck scales, dorsal fins & body socket...")

def build_curved_shield_scale_template():
    """Creates a thick 3D curved shield scale mesh with central keel ridge."""
    bm = bmesh.new()
    top_coords = [
        (0.0, 0.065, 0.026),
        (-0.088, 0.0, 0.018),
        (-0.068, -0.095, 0.010),
        (0.0, -0.145, 0.016),
        (0.068, -0.095, 0.010),
        (0.088, 0.0, 0.018),
        (0.0, -0.045, 0.035),
    ]
    bot_coords = [(x, y, z - 0.045) for (x, y, z) in top_coords]

    t_verts = [bm.verts.new(c) for c in top_coords]
    b_verts = [bm.verts.new(c) for c in bot_coords]

    for i in range(6):
        ni = (i + 1) % 6
        bm.faces.new((t_verts[i], t_verts[ni], t_verts[6]))
        bm.faces.new((b_verts[ni], b_verts[i], b_verts[6]))
        bm.faces.new((t_verts[i], b_verts[i], b_verts[ni], t_verts[ni]))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new("Scale_Template_Mesh")
    bm.to_mesh(mesh)
    bm.free()
    return mesh

scale_template = build_curved_shield_scale_template()
emerald_scale_objs = []
gold_scale_objs = []

# Place 5 staggered rows of 3D scales directly on the exact neck surface profile (-95 deg to +95 deg)
neck_y_rows = [0.28, 0.41, 0.54, 0.67, 0.80]

for r_idx, ny in enumerate(neck_y_rows):
    z_c, n_rx, n_rz = get_neck_profile(ny)
    # Account for occipital blend near y=0.28
    occ_blend = gaussian(ny, 0.0, 0.24)
    surf_rx = n_rx + 0.14 * occ_blend + 0.012
    surf_rz = n_rz + 0.12 * occ_blend + 0.012

    num_in_row = 9
    for s_idx in range(num_in_row):
        frac = (s_idx / (num_in_row - 1)) - 0.5
        stagger = (0.45 / (num_in_row - 1)) if (r_idx % 2 == 1) else 0.0
        angle = max(-0.98, min(0.98, (frac + stagger) * 2.0)) * math.radians(96)

        sx = math.sin(angle) * surf_rx
        sz = z_c + math.cos(angle) * surf_rz
        sy = ny

        sc_obj = bpy.data.objects.new(f"Neck_Scale_{r_idx}_{s_idx}", scale_template.copy())
        link_to_master(sc_obj)
        sc_obj.location = Vector((sx, sy, sz))

        out_dir = Vector((math.sin(angle), 0.24, math.cos(angle))).normalized()
        rot_quat = out_dir.to_track_quat('Z', 'Y')
        sc_obj.rotation_euler = rot_quat.to_euler()
        sc_obj.scale = (1.16, 1.22, 1.12)

        if s_idx == num_in_row // 2 or (r_idx == 0 and s_idx % 2 == 0):
            gold_scale_objs.append(sc_obj)
        else:
            emerald_scale_objs.append(sc_obj)

# Central Dorsal Mane Fins along Top of Neck & Occiput
for d_idx in range(6):
    dy = 0.12 + d_idx * 0.135
    z_c, _, n_rz = get_neck_profile(dy)
    occ_b = gaussian(dy, 0.0, 0.24)
    dz = z_c + n_rz + 0.12 * occ_b
    dorsal_fin = create_tapered_curve_mesh(f"Dorsal_Mane_Fin_{d_idx}", [
        ((0.0, dy, dz - 0.08), 0.056),
        ((0.0, dy + 0.08, dz + 0.12), 0.042),
        ((0.0, dy + 0.20, dz + 0.24), 0.022),
        ((0.0, dy + 0.30, dz + 0.32), 0.006),
    ], resolution_u=14, bevel_res=6)
    if d_idx % 2 == 0:
        gold_scale_objs.append(dorsal_fin)
    else:
        emerald_scale_objs.append(dorsal_fin)

# Rear Neck Connection Collar Ring
z_end_c, rx_end, rz_end = get_neck_profile(0.90)
bpy.ops.mesh.primitive_torus_add(
    major_radius=0.37,
    minor_radius=0.052,
    major_segments=28,
    minor_segments=12,
    location=(0.0, 0.90, z_end_c),
    rotation=(math.radians(68), 0, 0)
)
collar_ring = bpy.context.active_object
collar_ring.name = "Neck_Body_Connection_Collar"
collar_ring.scale = (0.98, 0.95, 1.0)
link_to_master(collar_ring)
gold_scale_objs.append(collar_ring)

scales_emerald_mesh = join_and_assign(emerald_scale_objs, "Dragon_Neck_Scales_Emerald", mat_emerald)
scales_gold_mesh = join_and_assign(gold_scale_objs, "Dragon_Dorsal_Mane_And_Collar_Gold", mat_gold)

# ---------------------------------------------------------------------------
# 9. Parent Hierarchy under Root Empty & Recalculate All Normals
# ---------------------------------------------------------------------------
root_empty = bpy.data.objects.new("Temple_Dragon_Head_Root", None)
link_to_master(root_empty)

all_mesh_objs = [obj for obj in master_col.objects if obj.type == 'MESH']
for obj in all_mesh_objs:
    obj.parent = root_empty
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.shade_smooth()

    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()

# ---------------------------------------------------------------------------
# 10. Save Editable .blend Source File & Export GLB
# ---------------------------------------------------------------------------
print(f"[DragonHead] Saving editable Blender project to: {BLEND_OUT}")
bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)

print(f"[DragonHead] Exporting GLB to: {GLB_OUT}")
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=GLB_OUT,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_materials='EXPORT'
)

glb_size = os.path.getsize(GLB_OUT)
blend_size = os.path.getsize(BLEND_OUT)
print(f"[DragonHead] Exported GLB size: {glb_size} bytes | .blend size: {blend_size} bytes")

# ---------------------------------------------------------------------------
# 11. Render Studio Multi-Angle & Wireframe Inspection Views inside Blender 5.3
# ---------------------------------------------------------------------------
print("[DragonHead] Setting up Blender Studio Lighting & Camera for 6 Inspection Renders...")

world = bpy.data.worlds.new("DragonStudioWorld")
scene.world = world
world.use_nodes = True
bg_node = world.node_tree.nodes.get("Background")
if bg_node:
    bg_node.inputs[0].default_value = (0.045, 0.036, 0.030, 1.0)
    bg_node.inputs[1].default_value = 0.85

def add_light(name, ltype, energy, color, loc, rot_deg):
    ldata = bpy.data.lights.new(name=name, type=ltype)
    ldata.energy = energy
    ldata.color = color
    if ltype == 'AREA':
        ldata.size = 3.5
    lobj = bpy.data.objects.new(name=name, object_data=ldata)
    scene.collection.objects.link(lobj)
    lobj.location = Vector(loc)
    lobj.rotation_euler = Euler(tuple(math.radians(a) for a in rot_deg), 'XYZ')
    return lobj

key_light = add_light("KeyLight", 'AREA', 240.0, (1.0, 0.95, 0.86), (-2.6, -2.8, 2.4), (52, 0, -42))
fill_light = add_light("FillLight", 'AREA', 110.0, (0.85, 0.92, 1.0), (2.8, -2.0, 1.2), (65, 0, 50))
rim_light = add_light("RimLight", 'AREA', 190.0, (1.0, 0.88, 0.68), (0.0, 2.8, 2.2), (-48, 0, 0))
under_light = add_light("UnderLight", 'POINT', 55.0, (1.0, 0.85, 0.70), (0.0, -1.8, -1.2), (0, 0, 0))

cam_data = bpy.data.cameras.new("InspectionCam")
cam_data.lens = 50.0
cam_obj = bpy.data.objects.new("InspectionCam", cam_data)
scene.collection.objects.link(cam_obj)
scene.camera = cam_obj

target_empty = bpy.data.objects.new("CamTarget", None)
scene.collection.objects.link(target_empty)
target_empty.location = Vector((0.0, -0.05, 0.35))

track_const = cam_obj.constraints.new(type='TRACK_TO')
track_const.target = target_empty
track_const.track_axis = 'TRACK_NEGATIVE_Z'
track_const.up_axis = 'UP_Y'

for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
    try:
        scene.render.engine = eng
        break
    except Exception:
        pass

scene.render.resolution_x = 1280
scene.render.resolution_y = 960
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'

views = {
    "front": ((0.0, -3.55, 0.52), (0.0, -0.15, 0.34)),
    "side_left": ((-3.65, -0.05, 0.40), (0.0, -0.05, 0.36)),
    "side_right": ((3.65, -0.05, 0.40), (0.0, -0.05, 0.36)),
    "angle45": ((-2.55, -2.55, 1.18), (0.0, -0.08, 0.36)),
    "top": ((0.0, -0.25, 3.95), (0.0, -0.05, 0.30)),
    "bottom_jaw": ((0.0, -2.50, -1.65), (0.0, -0.45, 0.02)),
}

rendered_files = {}
for vname, (cam_pos, tgt_pos) in views.items():
    cam_obj.location = Vector(cam_pos)
    target_empty.location = Vector(tgt_pos)
    bpy.context.view_layer.update()
    out_png = os.path.join(RENDER_DIR, f"blender_{vname}.png")
    scene.render.filepath = out_png
    bpy.ops.render.render(write_still=True)
    rendered_files[vname] = out_png
    print(f"[DragonHead] Rendered {vname} -> {out_png}")

# Render Wireframe Topology View
cam_obj.location = Vector((-2.45, -2.45, 1.10))
target_empty.location = Vector((0.0, -0.08, 0.36))
mat_wire = create_jiannian_material("Wireframe_Gold", base_color=(0.95, 0.75, 0.22, 1.0), metallic=0.2, roughness=0.3)
mat_clay = create_jiannian_material("Clay_Base", base_color=(0.08, 0.07, 0.06, 1.0), metallic=0.0, roughness=0.75)

for obj in all_mesh_objs:
    obj.data.materials.clear()
    obj.data.materials.append(mat_clay)
    obj.data.materials.append(mat_wire)
    wmod = obj.modifiers.new(name="WireOverlay", type='WIREFRAME')
    wmod.thickness = 0.0038
    wmod.use_replace = False
    wmod.material_offset = 1

bpy.context.view_layer.update()
wire_png = os.path.join(RENDER_DIR, "blender_wireframe.png")
scene.render.filepath = wire_png
bpy.ops.render.render(write_still=True)
rendered_files["wireframe"] = wire_png
print(f"[DragonHead] Rendered wireframe -> {wire_png}")

# ---------------------------------------------------------------------------
# 12. Re-Import GLB into Clean Blender Scene & Collect Full Verification Metrics
# ---------------------------------------------------------------------------
print(f"[DragonHead] Re-importing {GLB_OUT} into clean Blender scene for verification...")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB_OUT)
bpy.context.view_layer.update()

imp_meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
total_verts = 0
total_tris = 0
total_edges = 0
mesh_breakdown = []
material_names = set()

all_bbox_min = [float('inf')] * 3
all_bbox_max = [float('-inf')] * 3

for o in imp_meshes:
    m = o.data
    m.calc_loop_triangles()
    v_cnt = len(m.vertices)
    t_cnt = len(m.loop_triangles)
    e_cnt = len(m.edges)
    total_verts += v_cnt
    total_tris += t_cnt
    total_edges += e_cnt

    norms_ok = all(0.98 <= v.normal.length <= 1.02 for v in m.vertices)
    mats = [mat.name for mat in m.materials if mat]
    for mn in mats:
        material_names.add(mn)

    for corner in o.bound_box:
        wc = o.matrix_world @ Vector(corner)
        for i in range(3):
            all_bbox_min[i] = min(all_bbox_min[i], wc[i])
            all_bbox_max[i] = max(all_bbox_max[i], wc[i])

    mesh_breakdown.append({
        "name": o.name,
        "vertices": v_cnt,
        "edges": e_cnt,
        "triangles": t_cnt,
        "normalsValid": norms_ok,
        "materials": mats
    })

overall_dims = [round(all_bbox_max[i] - all_bbox_min[i], 4) for i in range(3)]

report_data = {
    "blenderVersion": bpy.app.version_string,
    "blendSourceFile": BLEND_OUT,
    "blendFileSize": blend_size,
    "glbFile": GLB_OUT,
    "glbFileSize": glb_size,
    "reImportSummary": {
        "meshObjectCount": len(imp_meshes),
        "totalVertices": total_verts,
        "totalEdges": total_edges,
        "totalTriangles": total_tris,
        "uniqueMaterials": sorted(list(material_names)),
        "overallDimensionsMeters": overall_dims,
        "boundingBoxMin": [round(x, 4) for x in all_bbox_min],
        "boundingBoxMax": [round(x, 4) for x in all_bbox_max],
        "meshes": mesh_breakdown
    },
    "renderedViews": rendered_files
}

with open(REPORT_OUT, "w", encoding="utf-8") as f:
    json.dump(report_data, f, indent=2, ensure_ascii=False)

print(f"[DragonHead] Verification report saved to: {REPORT_OUT}")
print(f"[DragonHead] Summary: {len(imp_meshes)} mesh groups, {total_verts} vertices, {total_tris} triangles, {glb_size} bytes")
print("[DragonHead] STAGE 2 BLENDER PIPELINE COMPLETED SUCCESSFULLY!")
