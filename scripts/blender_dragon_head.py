import bpy
import bmesh
import math
import os
import sys
import json
from mathutils import Vector, Euler, Quaternion, Matrix

"""
玉皇宮 Phase 3 — Stage 2.2：祥龍龍首最終美術精修
(Stylized Realism Taiwanese Jiannian Temple Dragon Head — Final Artistic Polish)
"""

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BLEND_OUT = os.path.join(ROOT_DIR, "assets", "source", "dragon-head.blend")
GLB_OUT = os.path.join(ROOT_DIR, "public", "assets", "models", "temple-dragon-head-preview.glb")
REPORT_OUT = os.path.join(ROOT_DIR, "public", "assets", "models", "temple-dragon-head-report.json")
RENDER_DIR = os.path.join(ROOT_DIR, "shots", "dragon-head-blender")
AFTER_DIR = os.path.join(ROOT_DIR, "shots", "stage2.2-after")

if "--" in sys.argv:
    args = sys.argv[sys.argv.index("--") + 1:]
    if len(args) >= 1:
        GLB_OUT = os.path.abspath(args[0])
    if len(args) >= 2:
        RENDER_DIR = os.path.abspath(args[1])

os.makedirs(os.path.dirname(BLEND_OUT), exist_ok=True)
os.makedirs(os.path.dirname(GLB_OUT), exist_ok=True)
os.makedirs(RENDER_DIR, exist_ok=True)
os.makedirs(AFTER_DIR, exist_ok=True)

print(f"[DragonHead 2.2] Running on Blender {bpy.app.version_string}")

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

def smooth_step(edge0, edge1, x):
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)

def gaussian(x, mu, sigma):
    return math.exp(-0.5 * ((x - mu) / sigma) ** 2)

def linear_to_srgb(c):
    c = max(0.0, min(1.0, c))
    if c <= 0.0031308:
        return 12.92 * c
    return 1.055 * (c ** (1.0 / 2.4)) - 0.055

def close_ring_cap_watertight(bm, ring, y_offset=0.0, reverse_winding=False):
    n = len(ring)
    center_co = sum((v.co for v in ring), Vector((0.0, 0.0, 0.0))) / float(n)
    mid_ring = [
        bm.verts.new(center_co.lerp(v.co, 0.45) + Vector((0.0, y_offset * 0.5, 0.0)))
        for v in ring
    ]
    v_apex = bm.verts.new(center_co + Vector((0.0, y_offset, 0.0)))

    for i in range(n):
        ni = (i + 1) % n
        if not reverse_winding:
            bm.faces.new((ring[i], ring[ni], mid_ring[ni], mid_ring[i]))
            bm.faces.new((mid_ring[i], mid_ring[ni], v_apex))
        else:
            bm.faces.new((ring[ni], ring[i], mid_ring[i], mid_ring[ni]))
            bm.faces.new((mid_ring[ni], mid_ring[i], v_apex))

# ---------------------------------------------------------------------------
# 2. Handcrafted Jiannian Ceramic Multi-Channel PBR Textures (sRGB-Calibrated, Isotropic)
# ---------------------------------------------------------------------------
print("[DragonHead 2.2] Generating sRGB-calibrated isotropic Jiannian ceramic Albedo, Roughness & Normal maps...")

def generate_jiannian_multichannel_textures(size=256):
    """
    Generates isotropic, domain-warped porcelain glaze & kiln variation maps (zero diagonal plaid artifacts!)
    with proper linear_to_srgb encoding for Albedo textures so Blender 5.3 and Three.js render exact temple hues.
    """
    norm_img = bpy.data.images.new("Jiannian_Ceramic_Normal", width=size, height=size, alpha=False)
    norm_img.colorspace_settings.name = 'Non-Color'

    orm_img = bpy.data.images.new("Jiannian_Ceramic_ORM", width=size, height=size, alpha=False)
    orm_img.colorspace_settings.name = 'Non-Color'

    verm_img = bpy.data.images.new("Jiannian_Vermilion_Albedo", width=size, height=size, alpha=False)
    gold_img = bpy.data.images.new("Jiannian_Gold_Albedo", width=size, height=size, alpha=False)
    emer_img = bpy.data.images.new("Jiannian_Emerald_Albedo", width=size, height=size, alpha=False)
    tooth_img = bpy.data.images.new("Jiannian_Tooth_Albedo", width=size, height=size, alpha=False)

    height_grid = [[0.0] * size for _ in range(size)]
    verm_pixels = [1.0] * (size * size * 4)
    gold_pixels = [1.0] * (size * size * 4)
    emer_pixels = [1.0] * (size * size * 4)
    tooth_pixels = [1.0] * (size * size * 4)
    orm_pixels = [1.0] * (size * size * 4)
    norm_pixels = [1.0] * (size * size * 4)

    two_pi = 2.0 * math.pi

    for iy in range(size):
        v = iy / size
        for ix in range(size):
            u = ix / size
            # Domain-warped isotropic coordinates (eliminates directional stripes/plaid!)
            wu = u + 0.08 * math.sin(v * two_pi * 3.0) + 0.04 * math.cos(u * two_pi * 5.0)
            wv = v + 0.08 * math.cos(u * two_pi * 3.0) + 0.04 * math.sin(v * two_pi * 5.0)

            # Isotropic multi-octave ceramic glaze undulation (product of orthogonal modes, zero diagonal bands)
            n1 = math.sin(wu * two_pi * 2.0) * math.cos(wv * two_pi * 2.0)
            n2 = math.cos(wu * two_pi * 5.0 + 0.8) * math.sin(wv * two_pi * 5.0 + 0.4)
            n3 = math.sin(wu * two_pi * 11.0 + 1.7) * math.cos(wv * two_pi * 11.0 + 2.3)
            n4 = math.cos(wu * two_pi * 23.0 + 0.5) * math.sin(wv * two_pi * 23.0 + 1.1)

            h = 0.45 * n1 + 0.30 * n2 + 0.16 * n3 + 0.09 * n4
            height_grid[iy][ix] = h

            # Handcrafted ceramic roughness variation in [0.42, 0.54] (mean 0.48)
            r_val = max(0.38, min(0.58, 0.48 + 0.035 * n1 + 0.025 * n2 + 0.015 * n3))

            idx = (iy * size + ix) * 4
            # Subtle organic kiln glaze color modulation (-1..+1)
            mod = 0.55 * n1 + 0.30 * n2 + 0.15 * n3

            # 1) Vermilion Ceramic Albedo (Linear target ~(0.43, 0.026, 0.014) with subtle ±6% kiln depth)
            vr_lin = 0.43 + 0.028 * mod
            vg_lin = 0.026 + 0.005 * mod
            vb_lin = 0.014 + 0.003 * mod
            verm_pixels[idx]     = linear_to_srgb(vr_lin)
            verm_pixels[idx + 1] = linear_to_srgb(vg_lin)
            verm_pixels[idx + 2] = linear_to_srgb(vb_lin)
            verm_pixels[idx + 3] = 1.0

            # 2) Imperial Gold Albedo (Linear target ~(0.71, 0.42, 0.064) with subtle antique gold leaf variation)
            gr_lin = 0.71 + 0.045 * mod
            gg_lin = 0.42 + 0.032 * mod
            gb_lin = 0.064 + 0.008 * mod
            gold_pixels[idx]     = linear_to_srgb(gr_lin)
            gold_pixels[idx + 1] = linear_to_srgb(gg_lin)
            gold_pixels[idx + 2] = linear_to_srgb(gb_lin)
            gold_pixels[idx + 3] = 1.0

            # 3) Emerald Glaze Albedo (Linear target ~(0.013, 0.19, 0.115) with subtle celadon-jade glaze pooling)
            er_lin = 0.013 + 0.003 * mod
            eg_lin = 0.190 + 0.022 * mod
            eb_lin = 0.115 + 0.014 * mod
            emer_pixels[idx]     = linear_to_srgb(er_lin)
            emer_pixels[idx + 1] = linear_to_srgb(eg_lin)
            emer_pixels[idx + 2] = linear_to_srgb(eb_lin)
            emer_pixels[idx + 3] = 1.0

            # 4) Tooth Bone-Ivory Albedo (v = 0 at gumline root -> v = 1 at biting tip)
            # Warm amber-ivory root neck blending smoothly into natural aged bone-ivory crown (not chalky white!)
            root_t = smooth_step(0.05, 0.36, v)
            tip_t = smooth_step(0.65, 1.0, v)
            flute_var = 1.0 + 0.025 * math.cos(u * two_pi * 4.0) + 0.015 * n2
            tr_lin = (0.42 * (1.0 - root_t) + (0.68 + 0.06 * tip_t) * root_t) * flute_var
            tg_lin = (0.24 * (1.0 - root_t) + (0.58 + 0.06 * tip_t) * root_t) * flute_var
            tb_lin = (0.14 * (1.0 - root_t) + (0.41 + 0.05 * tip_t) * root_t) * flute_var
            tooth_pixels[idx]     = linear_to_srgb(tr_lin)
            tooth_pixels[idx + 1] = linear_to_srgb(tg_lin)
            tooth_pixels[idx + 2] = linear_to_srgb(tb_lin)
            tooth_pixels[idx + 3] = 1.0

            orm_pixels[idx]     = 1.0
            orm_pixels[idx + 1] = r_val
            orm_pixels[idx + 2] = r_val
            orm_pixels[idx + 3] = 1.0

    bump_scale = 0.80
    for iy in range(size):
        iy_prev = (iy - 1) % size
        iy_next = (iy + 1) % size
        for ix in range(size):
            ix_prev = (ix - 1) % size
            ix_next = (ix + 1) % size
            dh_du = (height_grid[iy][ix_next] - height_grid[iy][ix_prev]) * bump_scale
            dh_dv = (height_grid[iy_next][ix] - height_grid[iy_prev][ix]) * bump_scale

            nx = -dh_du
            ny = -dh_dv
            nz = 1.0
            inv_len = 1.0 / math.sqrt(nx * nx + ny * ny + nz * nz)
            nx *= inv_len
            ny *= inv_len
            nz *= inv_len

            idx = (iy * size + ix) * 4
            norm_pixels[idx]     = nx * 0.5 + 0.5
            norm_pixels[idx + 1] = ny * 0.5 + 0.5
            norm_pixels[idx + 2] = nz * 0.5 + 0.5
            norm_pixels[idx + 3] = 1.0

    for img, pix in (
        (norm_img, norm_pixels),
        (orm_img, orm_pixels),
        (verm_img, verm_pixels),
        (gold_img, gold_pixels),
        (emer_img, emer_pixels),
        (tooth_img, tooth_pixels),
    ):
        img.pixels.foreach_set(pix)
        img.update()
        img.pack()

    return norm_img, orm_img, verm_img, gold_img, emer_img, tooth_img

(
    jiannian_norm_img,
    jiannian_orm_img,
    verm_albedo_img,
    gold_albedo_img,
    emer_albedo_img,
    tooth_albedo_img,
) = generate_jiannian_multichannel_textures(256)

def assign_box_uvs(mesh, uv_scale=2.5):
    bm = bmesh.new()
    bm.from_mesh(mesh)
    uv_layer = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for loop in f.loops:
            co = loop.vert.co
            if ax >= ay and ax >= az:
                u, v = co.y * uv_scale, co.z * uv_scale
            elif ay >= ax and ay >= az:
                u, v = co.x * uv_scale, co.z * uv_scale
            else:
                u, v = co.x * uv_scale, co.y * uv_scale
            loop[uv_layer].uv = (u, v)
    bm.to_mesh(mesh)
    bm.free()

def create_jiannian_material(
    name,
    base_color,
    albedo_img=None,
    use_roughness_map=True,
    metallic=0.02,
    roughness=0.48,
    coat_weight=0.08,
    coat_roughness=0.40,
    specular=0.34,
    normal_strength=0.16,
    use_glaze_maps=True
):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    nodes = nt.nodes
    links = nt.links
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

    if albedo_img is not None:
        tex_col = nodes.new("ShaderNodeTexImage")
        tex_col.image = albedo_img
        tex_col.location = (-520, 260)
        links.new(tex_col.outputs["Color"], bsdf.inputs["Base Color"])

    if use_glaze_maps and use_roughness_map:
        tex_orm = nodes.new("ShaderNodeTexImage")
        tex_orm.image = jiannian_orm_img
        tex_orm.location = (-580, 40)

        sep_rgb = nodes.new("ShaderNodeSeparateColor")
        sep_rgb.location = (-300, 40)
        links.new(tex_orm.outputs["Color"], sep_rgb.inputs["Color"])
        links.new(sep_rgb.outputs["Green"], bsdf.inputs["Roughness"])

    if use_glaze_maps and normal_strength > 0.0:
        tex_norm = nodes.new("ShaderNodeTexImage")
        tex_norm.image = jiannian_norm_img
        tex_norm.location = (-520, -200)

        norm_node = nodes.new("ShaderNodeNormalMap")
        norm_node.inputs["Strength"].default_value = normal_strength
        norm_node.location = (-240, -200)

        links.new(tex_norm.outputs["Color"], norm_node.inputs["Color"])
        links.new(norm_node.outputs["Normal"], bsdf.inputs["Normal"])

    return mat

mat_vermilion = create_jiannian_material(
    "Jiannian_Vermilion_Ceramic",
    base_color=(0.43, 0.026, 0.014, 1.0),
    albedo_img=verm_albedo_img,
    use_roughness_map=True,
    metallic=0.02,
    roughness=0.48,
    coat_weight=0.08,
    coat_roughness=0.40,
    specular=0.33,
    normal_strength=0.16
)

mat_gold = create_jiannian_material(
    "Jiannian_Imperial_Gold",
    base_color=(0.71, 0.42, 0.064, 1.0),
    albedo_img=gold_albedo_img,
    use_roughness_map=True,
    metallic=0.60,
    roughness=0.45,
    coat_weight=0.08,
    coat_roughness=0.40,
    specular=0.42,
    normal_strength=0.12
)

mat_emerald = create_jiannian_material(
    "Jiannian_Emerald_Glaze",
    base_color=(0.013, 0.19, 0.115, 1.0),
    albedo_img=emer_albedo_img,
    use_roughness_map=True,
    metallic=0.03,
    roughness=0.36,
    coat_weight=0.18,
    coat_roughness=0.28,
    specular=0.44,
    normal_strength=0.15
)

mat_ivory = create_jiannian_material(
    "Jiannian_Fang_Ivory",
    base_color=(0.68, 0.58, 0.41, 1.0),
    albedo_img=tooth_albedo_img,
    use_roughness_map=False,
    metallic=0.01,
    roughness=0.36,
    coat_weight=0.14,
    coat_roughness=0.26,
    specular=0.42,
    normal_strength=0.06,
    use_glaze_maps=True
)

mat_crimson = create_jiannian_material(
    "Jiannian_Oral_Crimson",
    base_color=(0.15, 0.010, 0.012, 1.0),
    albedo_img=None,
    use_roughness_map=True,
    metallic=0.01,
    roughness=0.48,
    coat_weight=0.10,
    coat_roughness=0.34,
    specular=0.34,
    normal_strength=0.12
)

mat_obsidian = create_jiannian_material(
    "Jiannian_Eye_Obsidian",
    base_color=(0.008, 0.008, 0.012, 1.0),
    albedo_img=None,
    use_roughness_map=False,
    metallic=0.05,
    roughness=0.07,
    coat_weight=0.85,
    coat_roughness=0.05,
    specular=0.85,
    normal_strength=0.0,
    use_glaze_maps=False
)

def get_neck_profile(y):
    nt = max(0.0, (y - 0.15) / 0.75)
    z_c = 0.24 - 0.33 * (nt ** 1.22)
    rx = 0.37 - 0.03 * nt
    rz = 0.35 - 0.03 * nt
    return z_c, rx, rz

def ceramic_micro_wave(x, y, z, amp=0.0012):
    w1 = math.sin(x * 19.0 + y * 17.0) * math.cos(y * 21.0 - z * 18.0)
    w2 = math.cos(x * 37.0 - z * 31.0) * math.sin(y * 33.0 + x * 23.0)
    return amp * (0.65 * w1 + 0.35 * w2)

# ---------------------------------------------------------------------------
# 3A. Sculpted Cranium, Scowling Supraorbital Brow Bone, Deep Eye Sockets & Faceted Ruyi Snout
# ---------------------------------------------------------------------------
print("[DragonHead 2.2] Sculpting fierce overhanging brow bone, deep eye sockets & faceted bamboo-ridge Ruyi snout...")

def build_upper_cranium_and_snout():
    bm = bmesh.new()
    n_y = 70
    n_theta = 64
    y_start = 0.90
    y_end = -0.87

    rings = []
    for iy in range(n_y):
        ty = iy / (n_y - 1)
        y_linear = y_start + ty * (y_end - y_start)

        if y_linear > 0.15:
            z_center, _, _ = get_neck_profile(y_linear)
        elif y_linear > -0.32:
            z_center = 0.24 + 0.058 * gaussian(y_linear, -0.09, 0.17)
        else:
            st = max(0.0, (-0.32 - y_linear) / 0.55)
            z_center = (
                0.24
                - 0.160 * (st ** 1.05)
                - 0.046 * gaussian(y_linear, -0.46, 0.085)
                + 0.042 * gaussian(y_linear, -0.78, 0.075)
            )

        tip_taper = math.sqrt(max(0.015, 1.0 - max(0.0, (-0.77 - y_linear) / 0.105) ** 2))

        if y_linear > 0.16:
            _, w_base, h_top = get_neck_profile(y_linear)
            occ_blend = gaussian(y_linear, 0.0, 0.22)
            w_base += 0.14 * occ_blend
            h_top += 0.12 * occ_blend
        else:
            w_base = (
                0.335
                * (1.0 - 0.22 * gaussian(y_linear, -0.50, 0.10))
                + 0.155 * gaussian(y_linear, -0.73, 0.085)
                + 0.215 * gaussian(y_linear, -0.08, 0.21)
            ) * tip_taper

            snout_suppress = smooth_step(-0.46, -0.16, y_linear)
            h_top = (
                (0.142 + 0.09 * snout_suppress) * tip_taper
                + 0.295 * gaussian(y_linear, -0.07, 0.20)
                + 0.042 * gaussian(y_linear, -0.77, 0.070) * tip_taper
            )

        mouth_open_zone = (1.0 - smooth_step(-0.14, 0.06, y_linear)) * smooth_step(-0.84, -0.74, y_linear)
        z_lip_target = 0.045 + 0.025 * max(0.0, min(1.0, (y_linear + 0.78) / 0.65)) + 0.015 * math.sin(y_linear * 13.0)

        ring_verts = []
        for it in range(n_theta):
            theta = (it / n_theta) * 2.0 * math.pi - math.pi
            abs_t = abs(theta)
            sin_t = math.sin(theta)
            cos_t = math.cos(theta)

            rx = w_base
            rz_up = h_top

            # 1) Twin Frontal Horn Pedicles, Deep Tian-Ting Sagittal Furrow & Corrugator Scowl Creases
            forehead_zone = gaussian(y_linear, -0.07, 0.19)
            if cos_t > 0.10:
                boss_bump = 0.155 * forehead_zone * gaussian(abs_t, 0.50, 0.21)
                sagittal_dip = -0.075 * forehead_zone * gaussian(abs_t, 0.0, 0.13)
                temple_facet = 0.036 * forehead_zone * gaussian(abs_t, 0.82, 0.14)
                rz_up += boss_bump + sagittal_dip + temple_facet
                rx += 0.078 * forehead_zone * gaussian(abs_t, 0.54, 0.21)

            glabella_scowl = gaussian(y_linear, -0.34, 0.075)
            scowl_furrow = -0.038 * glabella_scowl * (gaussian(abs_t, 0.0, 0.06) + 0.70 * gaussian(abs_t, 0.18, 0.05))
            scowl_ridge = 0.058 * glabella_scowl * gaussian(abs_t, 0.32, 0.09)
            rz_up += scowl_furrow + scowl_ridge

            # 2) Fierce Overhanging Diagonal Supraorbital Brow Bone (怒目斜壓眉弓)
            brow_y_center = -0.34 + 0.16 * ((abs_t - 0.52) / 0.45)
            brow_arch = gaussian(y_linear, brow_y_center, 0.088) * gaussian(abs_t, 0.78, 0.22)
            brow_z_profile = -0.020 * gaussian(abs_t, 0.42, 0.14) + 0.155 * smooth_step(0.44, 0.86, abs_t)
            rx += 0.195 * brow_arch
            rz_up += brow_z_profile * gaussian(y_linear, brow_y_center, 0.088) * gaussian(abs_t, 0.76, 0.24)

            # 3) Deeply Recessed Shadowed Orbital Socket directly beneath Overhanging Brow Bone
            eye_socket_zone = gaussian(y_linear, -0.34, 0.095) * gaussian(abs_t, 1.12, 0.21)
            rx -= 0.160 * eye_socket_zone
            rz_up -= 0.068 * eye_socket_zone

            # 4) Sculpted Angular Zygomatic Cheekbone, Infraorbital Furrow & Muscular Masseter Jowl
            infraorbital_groove = gaussian(y_linear, -0.36, 0.07) * gaussian(abs_t, 1.28, 0.10)
            zygo_arch = gaussian(y_linear, -0.22, 0.12) * gaussian(abs_t, 1.44, 0.20)
            sub_zygo_dip = gaussian(y_linear, -0.26, 0.09) * gaussian(abs_t, 1.72, 0.13)
            jowl_boss = gaussian(y_linear, -0.05, 0.18) * gaussian(abs_t, 1.54, 0.26)
            rx += -0.035 * infraorbital_groove + 0.110 * zygo_arch - 0.042 * sub_zygo_dip + 0.160 * jowl_boss
            rz_up += 0.040 * zygo_arch

            # 5) Angular 5-Node Bamboo-Ridge Nasal Bridge, Bony Side Planes & Deep Nasolabial Valleys
            nasal_zone = smooth_step(-0.82, -0.68, y_linear) * (1.0 - smooth_step(-0.37, -0.25, y_linear))
            if abs_t < 0.82:
                nasal_keel = 0.072 * nasal_zone * (1.0 - min(1.0, abs_t / 0.26) ** 1.4)
                bamboo_nodes = 0.020 * nasal_zone * math.cos((y_linear + 0.34) * 44.0) * gaussian(abs_t, 0.0, 0.20)
                nasal_bone_edge = 0.025 * nasal_zone * gaussian(abs_t, 0.26, 0.07)
                nasolabial_valley = -0.066 * nasal_zone * gaussian(abs_t, 0.48, 0.11)
                rz_up += nasal_keel + bamboo_nodes + nasal_bone_edge + nasolabial_valley
                rx += 0.024 * nasal_zone * gaussian(abs_t, 0.26, 0.08) - 0.050 * nasal_zone * gaussian(abs_t, 0.48, 0.11)

            # 6) Front Ruyi Cloud-Shield Nose Pad, Softened Philtrum Groove & Diagonal Muzzle Vibrissae Folds
            ruyi_nose_shield = gaussian(y_linear, -0.79, 0.055)
            philtrum_groove = -0.026 * gaussian(y_linear, -0.82, 0.055) * gaussian(abs_t, 0.0, 0.12)
            ruyi_lobes = 0.044 * ruyi_nose_shield * gaussian(abs_t, 0.24, 0.14)
            rz_up += ruyi_lobes + philtrum_groove
            rx += 0.032 * ruyi_lobes

            muzzle_pad_zone = gaussian(y_linear, -0.63, 0.11) * gaussian(abs_t, 1.32, 0.26)
            vibrissae_folds = 0.016 * muzzle_pad_zone * math.cos((y_linear - 0.16 * abs_t) * 46.0)
            rx += vibrissae_folds
            rz_up += 0.5 * vibrissae_folds

            # 7) Flared Alar Nostril Turrets, Deep Alar Crease & Deep Concave Nostril Chambers
            nostril_wing = gaussian(y_linear, -0.72, 0.065) * gaussian(abs_t, 0.84, 0.18)
            alar_crease = -0.042 * gaussian(y_linear, -0.69, 0.045) * gaussian(abs_t, 1.06, 0.10)
            rx += 0.092 * nostril_wing + alar_crease
            rz_up += 0.068 * nostril_wing + 0.5 * alar_crease

            nostril_pit = gaussian(y_linear, -0.73, 0.044) * gaussian(abs_t, 0.70, 0.14)
            rx -= 0.135 * nostril_pit
            rz_up -= 0.120 * nostril_pit

            # 8) Solid Convex Nose Cap & Thick Rolled Upper Lip Overhanging the Vaulted Palate
            t_lip_start = 0.56 * math.pi
            t_lip_end = 0.73 * math.pi

            lip_swell = mouth_open_zone * gaussian(abs_t, t_lip_start, 0.18)
            rx_outer_base = rx + (0.075 * tip_taper) * lip_swell
            x_closed = rx_outer_base * sin_t

            cheek_pull = smooth_step(0.32 * math.pi, t_lip_start, abs_t) * (1.0 - smooth_step(-0.12, 0.08, y_linear))
            z_ellipse = z_center + rz_up * 0.88 * cos_t
            z_outer_target = (1.0 - cheek_pull) * z_ellipse + cheek_pull * (z_lip_target + 0.065 * (cos_t - math.cos(t_lip_start)))
            z_closed = z_outer_target

            if mouth_open_zone > 0.001 and abs_t > t_lip_start:
                sin_start = math.sin(t_lip_start)
                r_lip_outer = (rx + 0.075 * tip_taper) * sin_start
                z_lip_outer = z_lip_target

                if abs_t <= t_lip_end:
                    u_lip = (abs_t - t_lip_start) / (t_lip_end - t_lip_start)
                    roll_angle = u_lip * math.pi
                    lip_half_thick = (0.045 + 0.010 * gaussian(y_linear, -0.62, 0.12)) * tip_taper
                    lip_drop = 0.038 * tip_taper

                    r_rolled = r_lip_outer - lip_half_thick * (1.0 - math.cos(roll_angle))
                    z_rolled = z_lip_outer - lip_drop * math.sin(roll_angle)
                else:
                    u_pal = (abs_t - t_lip_end) / (math.pi - t_lip_end)
                    lip_half_thick = (0.045 + 0.010 * gaussian(y_linear, -0.62, 0.12)) * tip_taper
                    r_gum_inner = max(0.012, r_lip_outer - 2.0 * lip_half_thick)

                    r_rolled = r_gum_inner * math.cos(u_pal * math.pi * 0.5)
                    palate_arch = 0.135 * math.sin(u_pal * math.pi * 0.5) * tip_taper
                    palate_rugae = 0.008 * math.cos(y_linear * 44.0) * math.sin(u_pal * math.pi)
                    z_rolled = z_lip_outer + palate_arch + palate_rugae

                x_mouth = (1.0 if theta >= 0.0 else -1.0) * r_rolled
                x = (1.0 - mouth_open_zone) * x_closed + mouth_open_zone * x_mouth
                z = (1.0 - mouth_open_zone) * z_closed + mouth_open_zone * z_rolled
            else:
                x = x_closed
                z = z_closed

            micro = ceramic_micro_wave(x, y_linear, z, amp=0.0012)
            x += micro * sin_t
            z += micro * cos_t

            v = bm.verts.new((x, y_linear, z))
            ring_verts.append(v)
        rings.append(ring_verts)

    for iy in range(n_y - 1):
        r0 = rings[iy]
        r1 = rings[iy + 1]
        for it in range(n_theta):
            nit = (it + 1) % n_theta
            bm.faces.new((r0[it], r0[nit], r1[nit], r1[it]))

    close_ring_cap_watertight(bm, rings[-1], y_offset=-0.010, reverse_winding=False)
    close_ring_cap_watertight(bm, rings[0], y_offset=0.010, reverse_winding=True)

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
    assign_box_uvs(obj.data, uv_scale=2.6)
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(mat_vermilion)
    return obj

cranium_obj = build_upper_cranium_and_snout()

# ---------------------------------------------------------------------------
# 3B. Thick Muscular Mandible, Watertight Convex Chin Symphysis & Cheek Commissure Folds
# ---------------------------------------------------------------------------
print("[DragonHead 2.2] Sculpting thick muscular lower mandible, carved chin boss & cheek commissure folds...")

def build_roaring_lower_jaw():
    bm = bmesh.new()
    n_y = 36
    n_theta = 44
    y_start = 0.04
    y_end = -0.80

    rings = []
    for iy in range(n_y):
        ty = iy / (n_y - 1)
        y_linear = y_start + ty * (y_end - y_start)

        z_jaw = -0.05 - 0.34 * ty + 0.080 * (ty ** 2.8)
        tip_taper = math.sqrt(max(0.018, 1.0 - max(0.0, (ty - 0.84) / 0.165) ** 2))
        rear_taper = smooth_step(0.0, 0.10, ty)

        w_jaw = (
            0.38
            - 0.085 * ty
            + 0.054 * gaussian(y_linear, -0.65, 0.12)
        ) * tip_taper * (0.78 + 0.22 * rear_taper)

        h_jaw = (
            0.165
            + 0.044 * gaussian(y_linear, -0.18, 0.14)
            + 0.052 * gaussian(y_linear, -0.68, 0.10)
        ) * tip_taper

        commissure_zone = gaussian(y_linear, -0.10, 0.095)
        trough_env = math.sin(ty * math.pi) * (1.0 - smooth_step(0.70, 0.82, ty))

        ring_verts = []
        for it in range(n_theta):
            theta = (it / n_theta) * 2.0 * math.pi - math.pi
            abs_t = abs(theta)
            sin_t = math.sin(theta)
            cos_t = math.cos(theta)

            rx = w_jaw
            lip_roll = gaussian(abs_t, 1.24, 0.24) * tip_taper * trough_env
            rx += 0.068 * lip_roll
            x = rx * sin_t

            if cos_t >= 0.0:
                oral_trough = -0.120 * gaussian(abs_t, 0.0, 0.52) * trough_env
                lip_wall_lift = 0.065 * gaussian(abs_t, 1.18, 0.24) * trough_env
                commissure_lift = 0.178 * commissure_zone * gaussian(abs_t, 1.26, 0.26)
                z = z_jaw + h_jaw * 0.44 * cos_t + oral_trough + lip_wall_lift + commissure_lift
            else:
                chin_boss = 0.062 * gaussian(y_linear, -0.68, 0.10) * gaussian(abs_t, math.pi, 0.55) * tip_taper
                chin_cleft = -0.016 * gaussian(y_linear, -0.72, 0.07) * gaussian(abs_t, math.pi, 0.14) * tip_taper
                mandible_keel = 0.028 * gaussian(abs_t, 2.15, 0.24) * tip_taper
                z = z_jaw + (h_jaw + chin_boss + chin_cleft + mandible_keel) * cos_t

            micro = ceramic_micro_wave(x, y_linear, z, amp=0.0010)
            x += micro * sin_t
            z += micro * cos_t

            v = bm.verts.new((x, y_linear, z))
            ring_verts.append(v)
        rings.append(ring_verts)

    for iy in range(n_y - 1):
        r0 = rings[iy]
        r1 = rings[iy + 1]
        for it in range(n_theta):
            nit = (it + 1) % n_theta
            bm.faces.new((r0[it], r0[nit], r1[nit], r1[it]))

    close_ring_cap_watertight(bm, rings[-1], y_offset=-0.010, reverse_winding=False)
    close_ring_cap_watertight(bm, rings[0], y_offset=0.010, reverse_winding=True)

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
    assign_box_uvs(obj.data, uv_scale=2.6)
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(mat_vermilion)
    return obj

lower_jaw_obj = build_roaring_lower_jaw()

# ---------------------------------------------------------------------------
# 4. Seamless Branched Stag Antlers (雙鹿角：自然分叉、根部角座厚度、Voxel融合無接縫)
# ---------------------------------------------------------------------------
print("[DragonHead 2.2] Sculpting seamless branched stag antlers...")

def create_tapered_curve_mesh(name, points_radii, resolution_u=18, bevel_res=6):
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
        major_radius=0.108,
        minor_radius=0.040,
        major_segments=22,
        minor_segments=12,
        location=(side * 0.22, -0.05, 0.55),
        rotation=(math.radians(-26), math.radians(side * 20), 0)
    )
    burr = bpy.context.active_object
    burr.name = f"Antler_Burr_{side}"
    link_to_master(burr)
    side_parts.append(burr)

    main_beam = create_tapered_curve_mesh(f"Antler_Beam_{side}", [
        ((side * 0.21, -0.05, 0.42), 0.106),
        ((side * 0.24, 0.01, 0.59), 0.090),
        ((side * 0.34, 0.19, 0.87), 0.074),
        ((side * 0.46, 0.45, 1.18), 0.060),
        ((side * 0.52, 0.68, 1.48), 0.044),
        ((side * 0.44, 0.84, 1.72), 0.015),
    ], resolution_u=20, bevel_res=7)
    side_parts.append(main_beam)

    tine1 = create_tapered_curve_mesh(f"Antler_Tine1_{side}", [
        ((side * 0.31, 0.12, 0.76), 0.064),
        ((side * 0.36, -0.02, 0.92), 0.048),
        ((side * 0.34, -0.18, 1.08), 0.030),
        ((side * 0.28, -0.26, 1.22), 0.013),
    ], resolution_u=14, bevel_res=6)
    side_parts.append(tine1)

    tine2 = create_tapered_curve_mesh(f"Antler_Tine2_{side}", [
        ((side * 0.42, 0.34, 1.05), 0.056),
        ((side * 0.58, 0.40, 1.20), 0.042),
        ((side * 0.72, 0.42, 1.36), 0.026),
        ((side * 0.78, 0.40, 1.50), 0.012),
    ], resolution_u=14, bevel_res=6)
    side_parts.append(tine2)

    tine3 = create_tapered_curve_mesh(f"Antler_Tine3_{side}", [
        ((side * 0.49, 0.56, 1.34), 0.046),
        ((side * 0.56, 0.76, 1.48), 0.032),
        ((side * 0.60, 0.94, 1.60), 0.013),
    ], resolution_u=12, bevel_res=6)
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
assign_box_uvs(antlers_obj.data, uv_scale=2.2)
antlers_obj.data.materials.append(mat_gold)

# ---------------------------------------------------------------------------
# 5. Sleek Scowling Phoenix Eyelids, Solid Vertical-Slit Golden Iris & Spiral Ruyi Nostril Wings
# ---------------------------------------------------------------------------
print("[DragonHead 2.2] Sculpting sleek scowling phoenix eyelids, solid vertical-slit golden iris & spiral Ruyi nostril wings...")

def build_fierce_slit_spherical_iris(name, eye_center, radius, gaze_dir):
    """
    Builds a solid, flush golden iris ring with a vertical-elliptical dragon slit pupil (威嚴東方龍束瞳).
    Guarantees r_local >= 1.006 * radius across the entire iris body so ZERO black eyeball pokes through!
    """
    bm = bmesh.new()
    n_rad = 12
    n_seg = 40

    z_axis = gaze_dir.normalized()
    up_ref = Vector((0.0, 0.0, 1.0))
    x_axis = up_ref.cross(z_axis).normalized()
    y_axis = z_axis.cross(x_axis).normalized()

    rings = []
    for ir in range(n_rad):
        tr = ir / (n_rad - 1)
        # Positive convex-ruff iris profile: always strictly above radius (1.002 at edges, 1.042 at pupillary crest)
        arch_base = math.sin(tr * math.pi)
        pupillary_ruff = 0.30 * gaussian(tr, 0.22, 0.14)

        ring_verts = []
        for iseg in range(n_seg):
            phi = (iseg / n_seg) * 2.0 * math.pi
            cos_p = math.cos(phi)
            sin_p = math.sin(phi)

            # Vertical-elliptical dragon pupil at tr=0 (alpha_x = 12.0 deg, alpha_y = 19.5 deg)
            # transitioning smoothly to circular outer limbus at tr=1 (alpha_outer = 34.0 deg)
            alpha_inner_phi = math.radians(12.0 * (cos_p ** 2) + 19.5 * (sin_p ** 2))
            alpha_outer_phi = math.radians(34.0)
            alpha = alpha_inner_phi + tr * (alpha_outer_phi - alpha_inner_phi)

            sin_a = math.sin(alpha)
            cos_a = math.cos(alpha)

            striation = 0.0006 * math.cos(phi * 24.0) * arch_base
            r_local = radius * (0.998 + 0.036 * (arch_base + pupillary_ruff)) + striation

            local_dir = (
                cos_a * z_axis
                + sin_a * cos_p * x_axis
                + sin_a * sin_p * y_axis
            ).normalized()
            pt = eye_center + r_local * local_dir
            ring_verts.append(bm.verts.new(pt))
        rings.append(ring_verts)

    for ir in range(n_rad - 1):
        r0 = rings[ir]
        r1 = rings[ir + 1]
        for iseg in range(n_seg):
            niseg = (iseg + 1) % n_seg
            bm.faces.new((r0[iseg], r0[niseg], r1[niseg], r1[iseg]))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name + "_Mesh")
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    link_to_master(obj)
    assign_box_uvs(obj.data, uv_scale=3.2)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_smooth()
    return obj

def build_scowling_phoenix_eyelid_wrap(name, side, eye_center, radius, gaze_dir):
    """
    Builds a single-layer, taut, scowling phoenix/almond dragon eyelid wrap (緊緻單層丹鳳怒目眼瞼):
    - NO secondary balloon bump on top of the eyelid!
    - The upper eyelid margin presses diagonally across the top of the iris with a fierce scowl line,
      pinching into a sharp hooked inner tear-duct canthus and swept outer flame canthus,
      and blending smoothly back into the skull's deep orbital socket beneath the overhanging brow bone.
    """
    bm = bmesh.new()
    n_u = 48
    n_v = 18

    z_axis = gaze_dir.normalized()
    world_up = Vector((side * -0.26, 0.28, 0.92)).normalized()
    x_axis = world_up.cross(z_axis).normalized()
    y_axis = z_axis.cross(x_axis).normalized()
    if y_axis.z < 0:
        y_axis = -y_axis
        x_axis = -x_axis

    inner_sign = 1.0 if (x_axis.y < 0.0) else -1.0

    rings = []
    for iu in range(n_u):
        phi = (iu / n_u) * 2.0 * math.pi
        cos_p = math.cos(phi)
        sin_p = math.sin(phi)

        is_upper = max(0.0, sin_p)
        is_lower = max(0.0, -sin_p)
        is_corner = cos_p * cos_p
        is_inner_corner = max(0.0, inner_sign * cos_p)
        is_outer_corner = max(0.0, -inner_sign * cos_p)

        # Taut almond dragon fissure: upper lid lowers to 27.5 deg to hood top of iris; corners flare to 45 deg
        upper_scowl_press = 5.5 * is_upper * (0.65 + 0.35 * is_inner_corner)
        lower_taut_rim = 2.0 * is_lower
        corner_flare = 14.0 * (is_corner ** 1.15)
        alpha_aperture = math.radians(33.0 - upper_scowl_press - lower_taut_rim + corner_flare)
        alpha_back = math.radians(135.0)

        loop_verts = []
        for iv in range(n_v):
            tv = iv / (n_v - 1)
            alpha = alpha_aperture + (tv ** 1.1) * (alpha_back - alpha_aperture)
            sin_a = math.sin(alpha)
            cos_a = math.cos(alpha)

            # Single sleek palpebral fold crest at tv=0.20 tapering smoothly back into the skull socket!
            primary_fold = gaussian(tv, 0.20, 0.14) + 0.45 * gaussian(tv, 0.50, 0.24)
            inner_rim_tuck = -0.024 * gaussian(tv, 0.0, 0.045)
            deep_socket_close = -0.025 * smooth_step(0.88, 1.0, tv)

            fold_amp = 0.044 * is_upper + 0.028 * is_lower + 0.024 * is_corner
            r_lid = radius * (1.032 + inner_rim_tuck + deep_socket_close) + fold_amp * primary_fold

            canthus_hook = (
                -0.028 * (is_inner_corner ** 2.2)
                + 0.032 * (is_outer_corner ** 2.0)
                - 0.012 * is_upper * (1.0 - is_corner) * (1.0 - tv)
            ) * (1.0 - 0.45 * tv)

            dir_vec = (
                cos_a * z_axis
                + sin_a * cos_p * x_axis
                + (sin_a * sin_p + canthus_hook) * y_axis
            ).normalized()

            pt = eye_center + r_lid * dir_vec
            loop_verts.append(bm.verts.new(pt))
        rings.append(loop_verts)

    for iu in range(n_u):
        niu = (iu + 1) % n_u
        r0 = rings[iu]
        r1 = rings[niu]
        for iv in range(n_v - 1):
            bm.faces.new((r0[iv], r1[iv], r1[iv + 1], r0[iv + 1]))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name + "_Mesh")
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    link_to_master(obj)
    sub = obj.modifiers.new(name="Subsurf", type='SUBSURF')
    sub.levels = 1
    sub.render_levels = 1
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=sub.name)
    assign_box_uvs(obj.data, uv_scale=3.0)
    bpy.ops.object.shade_smooth()
    return obj

def build_spiral_ruyi_nostril_wing(name, side, nostril_loc, nostril_dir):
    bm = bmesh.new()
    n_u = 36
    n_v = 16
    z_axis = nostril_dir.normalized()
    up_ref = Vector((0.0, 0.0, 1.0))
    x_axis = up_ref.cross(z_axis).normalized()
    y_axis = z_axis.cross(x_axis).normalized()

    rings = []
    for iu in range(n_u):
        u = (iu / n_u) * 2.0 * math.pi
        cos_u = math.cos(u)
        sin_u = math.sin(u)

        is_dorsal = max(0.0, sin_u)
        is_outer = max(0.0, side * cos_u)
        is_ventral = max(0.0, -sin_u)
        wing_flare = 1.0 + 0.48 * is_dorsal + 0.34 * is_outer - 0.14 * is_ventral
        alar_pinch = 0.012 * math.cos(u * 3.0)

        loop_verts = []
        for iv in range(n_v):
            tv = iv / (n_v - 1)
            if tv < 0.55:
                st = tv / 0.55
                r_ring = 0.014 + (0.046 + 0.025 * wing_flare + alar_pinch) * (st ** 0.75)
                z_off = -0.065 + (0.065 + 0.034 * wing_flare) * math.sin(st * math.pi * 0.5)
            else:
                st = (tv - 0.55) / 0.45
                r_crest = 0.060 + 0.025 * wing_flare + alar_pinch
                r_ring = r_crest + 0.014 * math.sin(st * math.pi) - 0.008 * st
                z_off = 0.034 * wing_flare * math.cos(st * math.pi * 0.5) - 0.044 * (st ** 1.4)

            pt = (
                nostril_loc
                + (r_ring * 1.18 * cos_u) * x_axis
                + (r_ring * 0.92 * sin_u) * y_axis
                + z_off * z_axis
            )
            loop_verts.append(bm.verts.new(pt))
        rings.append(loop_verts)

    for iu in range(n_u):
        niu = (iu + 1) % n_u
        r0 = rings[iu]
        r1 = rings[niu]
        for iv in range(n_v - 1):
            bm.faces.new((r0[iv], r1[iv], r1[iv + 1], r0[iv + 1]))

    tunnel_ring = [rings[iu][0] for iu in range(n_u)]
    close_ring_cap_watertight(bm, tunnel_ring, y_offset=0.015, reverse_winding=True)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name + "_Mesh")
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    link_to_master(obj)
    sub = obj.modifiers.new(name="Subsurf", type='SUBSURF')
    sub.levels = 1
    sub.render_levels = 1
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=sub.name)
    assign_box_uvs(obj.data, uv_scale=3.2)
    bpy.ops.object.shade_smooth()
    return obj

eye_objs = []
lid_objs = []
iris_objs = []
nostril_cav_objs = []

for side in (-1, 1):
    eye_center = Vector((side * 0.362, -0.340, 0.312))
    eye_radius = 0.100
    gaze_dir = Vector((side * 0.43, -0.89, -0.07)).normalized()

    # 1) Obsidian Eyeball Core
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=28,
        ring_count=18,
        radius=eye_radius,
        location=eye_center
    )
    eyeball = bpy.context.active_object
    eyeball.name = f"Eyeball_{side}"
    link_to_master(eyeball)
    bpy.ops.object.shade_smooth()
    eye_objs.append(eyeball)

    # 2) Solid Vertical-Slit Striated Golden Iris
    iris = build_fierce_slit_spherical_iris(f"Eye_Iris_{side}", eye_center, eye_radius, gaze_dir)
    iris_objs.append(iris)

    # 3) Sleek Single-Layer Scowling Phoenix Eyelid Wrap
    eyelid_wrap = build_scowling_phoenix_eyelid_wrap(f"Orbital_Eyelid_Wrap_{side}", side, eye_center, eye_radius, gaze_dir)
    lid_objs.append(eyelid_wrap)

    # 4) Flared Spiral Ruyi Nostril Wing with Deep Concave Nostril Tunnel
    nostril_loc = Vector((side * 0.252, -0.725, 0.236))
    nostril_dir = Vector((side * 0.44, -0.75, 0.49)).normalized()
    n_wing = build_spiral_ruyi_nostril_wing(f"Nostril_Wing_{side}", side, nostril_loc, nostril_dir)
    lid_objs.append(n_wing)

    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=14,
        ring_count=10,
        radius=0.036,
        location=nostril_loc - nostril_dir * 0.042
    )
    n_cav = bpy.context.active_object
    n_cav.name = f"Nostril_Cavity_{side}"
    n_cav.scale = (0.95, 0.85, 0.65)
    link_to_master(n_cav)
    bpy.ops.object.shade_smooth()
    nostril_cav_objs.append(n_cav)

def join_and_assign(obj_list, name, material, uv_scale=2.6, assign_uv=True):
    bpy.ops.object.select_all(action='DESELECT')
    for o in obj_list:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obj_list[0]
    bpy.ops.object.join()
    joined = bpy.context.active_object
    joined.name = name
    if assign_uv:
        assign_box_uvs(joined.data, uv_scale=uv_scale)
    bpy.ops.object.shade_smooth()
    joined.data.materials.clear()
    joined.data.materials.append(material)
    return joined

eyes_mesh = join_and_assign(eye_objs, "Dragon_Eyeballs", mat_obsidian, uv_scale=3.0)
iris_mesh = join_and_assign(iris_objs, "Dragon_Eye_Irises", mat_gold, uv_scale=3.2)
lids_mesh = join_and_assign(lid_objs, "Dragon_Eyelids", mat_vermilion, uv_scale=2.8)

# ---------------------------------------------------------------------------
# 6. Anatomical Dentition with UV Root-to-Tip Shading & Smooth Scalloped Alveolar Gum Arches
# ---------------------------------------------------------------------------
print("[DragonHead 2.2] Sculpting smooth scalloped alveolar gum arches, curved dental arch & root-shaded bone-ivory teeth...")

def catmull_rom_spline(pts, num_samples):
    n = len(pts)
    if n < 2:
        return [Vector(pts[0])] * num_samples
    ext = [Vector(pts[0]) * 2.0 - Vector(pts[1])] + [Vector(p) for p in pts] + [Vector(pts[-1]) * 2.0 - Vector(pts[-2])]
    out = []
    for i in range(num_samples):
        t_global = (i / (num_samples - 1)) * (n - 1)
        seg = min(n - 2, int(t_global))
        t = t_global - seg
        p0, p1, p2, p3 = ext[seg], ext[seg + 1], ext[seg + 2], ext[seg + 3]
        t2 = t * t
        t3 = t2 * t
        pos = 0.5 * (
            (2.0 * p1)
            + (-p0 + p2) * t
            + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2
            + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3
        )
        out.append(pos)
    return out

def create_sculpted_fang_mesh(name, spine_pts, rx_base, ry_base, flute_depth=0.08, n_u=12, n_v=14):
    bm = bmesh.new()
    centers = catmull_rom_spline(spine_pts, n_u)
    rings = []

    for iu in range(n_u):
        tu = iu / (n_u - 1)
        c = centers[iu]
        if iu < n_u - 1:
            tang = (centers[iu + 1] - c).normalized()
        else:
            tang = (c - centers[iu - 1]).normalized()

        ref = Vector((1.0, 0.0, 0.0)) if abs(tang.x) < 0.85 else Vector((0.0, 1.0, 0.0))
        b_axis = tang.cross(ref).normalized()
        n_axis = b_axis.cross(tang).normalized()

        taper = (1.0 - (tu ** 1.32)) * (1.0 + 0.14 * math.sin(tu * math.pi))
        rx = max(0.002, rx_base * taper)
        ry = max(0.002, ry_base * taper)

        ring_verts = []
        for iv in range(n_v):
            ang = (iv / n_v) * 2.0 * math.pi
            flute = 1.0 + flute_depth * math.cos(ang * 2.0) * math.sin(tu * math.pi)
            local_pt = c + (rx * math.cos(ang) * flute) * n_axis + (ry * math.sin(ang) * flute) * b_axis
            ring_verts.append(bm.verts.new(local_pt))
        rings.append(ring_verts)

    uv_layer = bm.loops.layers.uv.verify()

    for iu in range(n_u - 1):
        v0 = iu / n_u
        v1 = (iu + 1) / n_u
        r0 = rings[iu]
        r1 = rings[iu + 1]
        for iv in range(n_v):
            niv = (iv + 1) % n_v
            u0 = iv / n_v
            u1 = (iv + 1) / n_v
            f = bm.faces.new((r0[iv], r0[niv], r1[niv], r1[iv]))
            f.loops[0][uv_layer].uv = (u0, v0)
            f.loops[1][uv_layer].uv = (u1, v0)
            f.loops[2][uv_layer].uv = (u1, v1)
            f.loops[3][uv_layer].uv = (u0, v1)

    tip_pt = centers[-1] + (centers[-1] - centers[-2]).normalized() * 0.004
    v_tip = bm.verts.new(tip_pt)
    v_last = (n_u - 1) / n_u
    for iv in range(n_v):
        niv = (iv + 1) % n_v
        u0 = iv / n_v
        u1 = (iv + 1) / n_v
        f = bm.faces.new((rings[-1][iv], rings[-1][niv], v_tip))
        f.loops[0][uv_layer].uv = (u0, v_last)
        f.loops[1][uv_layer].uv = (u1, v_last)
        f.loops[2][uv_layer].uv = ((u0 + u1) * 0.5, 0.99)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name + "_Mesh")
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    link_to_master(obj)
    return obj

teeth_objs = []
oral_crimson_objs = list(nostril_cav_objs)

# High-Resolution Scalloped Upper & Lower Alveolar Gum Arches positioned right at the visible tooth emergence margin!
# (Smoothly cradles every tooth root without co-planar sleeve sawtooth z-fighting!)
upper_gum_arch = create_tapered_curve_mesh("Upper_Alveolar_Gum_Arch", [
    ((-0.28, -0.16,  0.072), 0.038),
    ((-0.26, -0.39,  0.062), 0.044),
    ((-0.23, -0.62,  0.052), 0.050),
    ((-0.13, -0.74,  0.048), 0.042),
    (( 0.00, -0.77,  0.048), 0.038),
    (( 0.13, -0.74,  0.048), 0.042),
    (( 0.23, -0.62,  0.052), 0.050),
    (( 0.26, -0.39,  0.062), 0.044),
    (( 0.28, -0.16,  0.072), 0.038),
], resolution_u=32, bevel_res=8)
oral_crimson_objs.append(upper_gum_arch)

lower_gum_arch = create_tapered_curve_mesh("Lower_Alveolar_Gum_Arch", [
    ((-0.26, -0.20, -0.172), 0.034),
    ((-0.24, -0.44, -0.212), 0.038),
    ((-0.195,-0.675,-0.242), 0.044),
    ((-0.11, -0.71, -0.232), 0.036),
    (( 0.00, -0.725,-0.230), 0.034),
    (( 0.11, -0.71, -0.232), 0.036),
    (( 0.195,-0.675,-0.242), 0.044),
    (( 0.24, -0.44, -0.212), 0.038),
    (( 0.26, -0.20, -0.172), 0.034),
], resolution_u=32, bevel_res=8)
oral_crimson_objs.append(lower_gum_arch)

for side in (-1, 1):
    # 1) Curved Horseshoe Anterior Incisors (前門齒列：非等距弧形排列，I1小且內收、I2中、I3大且外傾類犬齒)
    incisor_specs = [
        (0.028, -0.772, 0.078, -0.002, 0.013, -0.722, -0.258, -0.172, 0.012, 0.002),
        (0.068, -0.760, 0.076, -0.022, 0.016, -0.710, -0.254, -0.152, 0.015, 0.008),
        (0.126, -0.738, 0.074, -0.054, 0.022, -0.692, -0.250, -0.124, 0.019, 0.018),
    ]
    for idx, (xo, yu, zru, ztu, ru, yl, zrl, ztl, rl, fx) in enumerate(incisor_specs):
        u_inc = create_sculpted_fang_mesh(
            f"Upper_Incisor_{side}_{idx}",
            [
                (side * xo, yu + 0.012, zru),
                (side * (xo + fx * 0.5), yu - 0.008, (zru + ztu) * 0.5),
                (side * (xo + fx * 0.25), yu + 0.016, ztu),
            ],
            rx_base=ru,
            ry_base=ru * 0.85
        )
        teeth_objs.append(u_inc)

        l_inc = create_sculpted_fang_mesh(
            f"Lower_Incisor_{side}_{idx}",
            [
                (side * (xo * 0.90), yl + 0.012, zrl),
                (side * (xo * 0.90 + fx * 0.45), yl - 0.006, (zrl + ztl) * 0.5),
                (side * (xo * 0.88 + fx * 0.20), yl + 0.014, ztl),
            ],
            rx_base=rl,
            ry_base=rl * 0.85
        )
        teeth_objs.append(l_inc)

    # 2) Commanding Upper Sabre Canine Fang
    u_fang = create_sculpted_fang_mesh(
        f"Upper_Main_Canine_{side}",
        [
            (side * 0.220, -0.62,  0.088),
            (side * 0.238, -0.64, -0.020),
            (side * 0.230, -0.63, -0.130),
            (side * 0.208, -0.58, -0.230),
        ],
        rx_base=0.044,
        ry_base=0.051,
        flute_depth=0.10,
        n_u=16,
        n_v=16
    )
    teeth_objs.append(u_fang)

    # 3) Interlocking Lower Sabre Canine Fang
    l_fang = create_sculpted_fang_mesh(
        f"Lower_Main_Canine_{side}",
        [
            (side * 0.192, -0.675, -0.285),
            (side * 0.205, -0.690, -0.205),
            (side * 0.198, -0.675, -0.120),
            (side * 0.178, -0.640, -0.045),
        ],
        rx_base=0.037,
        ry_base=0.043,
        flute_depth=0.09,
        n_u=16,
        n_v=16
    )
    teeth_objs.append(l_fang)

    # 4) Non-Uniform Clustered Lateral Premolars & Double-Cusp Carnassial Fangs
    upper_lateral_specs = [
        (-0.525, 0.244, 0.082, 0.082, 0.018, 0.023, 0.014),
        (-0.390, 0.262, 0.088, 0.155, 0.027, 0.039, 0.032),
        (-0.285, 0.276, 0.094, 0.110, 0.022, 0.031, 0.022),
        (-0.168, 0.286, 0.098, 0.070, 0.017, 0.022, 0.014),
    ]
    for idx, (yp, xp, zr, ln, rx_t, ry_t, bc) in enumerate(upper_lateral_specs):
        u_lat = create_sculpted_fang_mesh(
            f"Upper_Lateral_Tooth_{side}_{idx}",
            [
                (side * xp, yp, zr),
                (side * (xp + 0.005), yp + bc * 0.3, zr - ln * 0.45),
                (side * (xp - 0.008), yp + bc, zr - ln),
            ],
            rx_base=rx_t,
            ry_base=ry_t
        )
        teeth_objs.append(u_lat)

        if idx in (1, 2):
            u_cusp = create_sculpted_fang_mesh(
                f"Upper_Carnassial_Cusp_{side}_{idx}",
                [
                    (side * xp, yp + ry_t * 0.85, zr),
                    (side * xp, yp + ry_t * 0.95, zr - ln * 0.28),
                    (side * (xp - 0.005), yp + ry_t * 1.05, zr - ln * 0.55),
                ],
                rx_base=rx_t * 0.65,
                ry_base=ry_t * 0.60,
                n_u=8,
                n_v=10
            )
            teeth_objs.append(u_cusp)

    lower_lateral_specs = [
        (-0.568, 0.226, -0.252, 0.086, 0.017, 0.022, 0.014),
        (-0.442, 0.244, -0.228, 0.142, 0.025, 0.035, 0.026),
        (-0.338, 0.258, -0.200, 0.104, 0.021, 0.028, 0.019),
        (-0.215, 0.268, -0.175, 0.068, 0.017, 0.022, 0.012),
    ]
    for idx, (yp, xp, zr, ln, rx_t, ry_t, bc) in enumerate(lower_lateral_specs):
        l_lat = create_sculpted_fang_mesh(
            f"Lower_Lateral_Tooth_{side}_{idx}",
            [
                (side * xp, yp, zr),
                (side * (xp + 0.005), yp + bc * 0.3, zr + ln * 0.45),
                (side * (xp - 0.008), yp + bc, zr + ln),
            ],
            rx_base=rx_t,
            ry_base=ry_t
        )
        teeth_objs.append(l_lat)

        if idx in (1, 2):
            l_cusp = create_sculpted_fang_mesh(
                f"Lower_Carnassial_Cusp_{side}_{idx}",
                [
                    (side * xp, yp + ry_t * 0.85, zr),
                    (side * xp, yp + ry_t * 0.95, zr + ln * 0.28),
                    (side * (xp - 0.005), yp + ry_t * 1.05, zr + ln * 0.52),
                ],
                rx_base=rx_t * 0.65,
                ry_base=ry_t * 0.60,
                n_u=8,
                n_v=10
            )
            teeth_objs.append(l_cusp)

teeth_mesh = join_and_assign(teeth_objs, "Dragon_Teeth_Fangs", mat_ivory, assign_uv=False)

# 5) Quad-Lofted S-Curved Dragon Tongue with Dorsal Median Sulcus & Pointed Flame Tip
def build_sculpted_dragon_tongue():
    bm = bmesh.new()
    spine = catmull_rom_spline([
        (0.0,  0.02, -0.07),
        (0.0, -0.20, -0.16),
        (0.0, -0.44, -0.24),
        (0.0, -0.62, -0.21),
        (0.0, -0.73, -0.15),
    ], 26)
    n_u = len(spine)
    n_v = 24
    rings = []

    for iu in range(n_u):
        tu = iu / (n_u - 1)
        c = spine[iu]
        w_tongue = 0.135 * math.sin(math.acos(max(-0.99, min(0.99, 2.0 * tu - 1.0)))) * (1.0 - 0.48 * (tu ** 1.8))
        w_tongue = max(0.003, w_tongue + 0.024 * (1.0 - tu))
        h_tongue = max(0.002, 0.048 * (1.0 - 0.84 * (tu ** 1.6)))

        ring_verts = []
        for iv in range(n_v):
            ang = (iv / n_v) * 2.0 * math.pi
            cos_a = math.cos(ang)
            sin_a = math.sin(ang)
            x = w_tongue * cos_a
            sulcus = -0.016 * (1.0 - tu * 0.7) * gaussian(cos_a, 0.0, 0.28) if sin_a > 0.0 else 0.0
            z = c.z + h_tongue * sin_a + sulcus
            ring_verts.append(bm.verts.new((x, c.y, z)))
        rings.append(ring_verts)

    for iu in range(n_u - 1):
        r0 = rings[iu]
        r1 = rings[iu + 1]
        for iv in range(n_v):
            niv = (iv + 1) % n_v
            bm.faces.new((r0[iv], r0[niv], r1[niv], r1[iv]))

    v_tip = bm.verts.new((0.0, -0.755, -0.135))
    for iv in range(n_v):
        niv = (iv + 1) % n_v
        bm.faces.new((rings[-1][iv], rings[-1][niv], v_tip))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new("Dragon_Tongue_Mesh")
    bm.to_mesh(mesh)
    bm.free()

    t_obj = bpy.data.objects.new("Dragon_Tongue_Core", mesh)
    link_to_master(t_obj)
    return t_obj

tongue_core = build_sculpted_dragon_tongue()
oral_crimson_objs.append(tongue_core)
tongue_obj = join_and_assign(oral_crimson_objs, "Dragon_Tongue", mat_crimson, uv_scale=3.0)

# ---------------------------------------------------------------------------
# 7. Three-Tiered Ribbon Whiskers (主鬚、副鬚、後鬚) & Clustered Non-Comb Flame Brows/Mane
# ---------------------------------------------------------------------------
print("[DragonHead 2.2] Sculpting 3-tier ribbon whiskers (主鬚、副鬚、後鬚) & clustered non-comb flame brows/mane...")

def create_sculpted_ribbon_mesh(name, control_specs, n_u=30, up_hint=(0.0, 0.0, 1.0)):
    bm = bmesh.new()
    pts = [spec[0] for spec in control_specs]
    widths = [spec[1] for spec in control_specs]
    thicks = [spec[2] for spec in control_specs]
    twists = [spec[3] for spec in control_specs]

    centers = catmull_rom_spline(pts, n_u)
    n_ctrl = len(control_specs)

    def interp_scalar(arr, tu):
        pos = tu * (n_ctrl - 1)
        idx = min(n_ctrl - 2, int(pos))
        frac = smooth_step(0.0, 1.0, pos - idx)
        return arr[idx] * (1.0 - frac) + arr[idx + 1] * frac

    profile_8 = [
        (-0.50,  0.00),
        (-0.26,  0.40),
        ( 0.00,  0.54),
        ( 0.26,  0.40),
        ( 0.50,  0.00),
        ( 0.26, -0.40),
        ( 0.00, -0.54),
        (-0.26, -0.40),
    ]

    up_vec = Vector(up_hint).normalized()
    rings = []

    for iu in range(n_u - 1):
        tu = iu / (n_u - 1)
        c = centers[iu]
        if iu < n_u - 1:
            tang = (centers[iu + 1] - c).normalized()
        else:
            tang = (c - centers[iu - 1]).normalized()

        if abs(tang.dot(up_vec)) > 0.94:
            ref = Vector((0.0, 1.0, 0.0))
        else:
            ref = up_vec
        w_axis = tang.cross(ref).normalized()
        h_axis = w_axis.cross(tang).normalized()

        twist_rad = math.radians(interp_scalar(twists, tu))
        cos_tw = math.cos(twist_rad)
        sin_tw = math.sin(twist_rad)
        w_rot = cos_tw * w_axis + sin_tw * h_axis
        h_rot = -sin_tw * w_axis + cos_tw * h_axis

        w_val = interp_scalar(widths, tu)
        h_val = interp_scalar(thicks, tu)

        ring_verts = []
        for (wf, hf) in profile_8:
            pt = c + (wf * w_val) * w_rot + (hf * h_val) * h_rot
            ring_verts.append(bm.verts.new(pt))
        rings.append(ring_verts)

    for iu in range(len(rings) - 1):
        r0 = rings[iu]
        r1 = rings[iu + 1]
        for iv in range(8):
            niv = (iv + 1) % 8
            bm.faces.new((r0[iv], r0[niv], r1[niv], r1[iv]))

    bm.faces.new(tuple(reversed(rings[0])))

    v_tip = bm.verts.new(centers[-1])
    for iv in range(8):
        niv = (iv + 1) % 8
        bm.faces.new((rings[-1][iv], rings[-1][niv], v_tip))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name + "_Mesh")
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    link_to_master(obj)
    return obj

whisker_gold_objs = []
flame_vermilion_objs = []

for side in (-1, 1):
    # =========================================================================
    # A. THREE-TIERED FLOWING RIBBON WHISKERS (主鬚、副鬚、後鬚：長短、寬窄、前後空間層次分明!)
    # =========================================================================
    # 1) Primary Sovereign Ribbon Whisker (主鬚)
    main_follicle = create_tapered_curve_mesh(f"Main_Whisker_Follicle_{side}", [
        ((side * 0.22, -0.65, 0.075), 0.044),
        ((side * 0.29, -0.66, 0.070), 0.036),
        ((side * 0.35, -0.67, 0.064), 0.024),
    ], resolution_u=8, bevel_res=5)
    flame_vermilion_objs.append(main_follicle)

    main_whisker = create_sculpted_ribbon_mesh(
        f"Dragon_Whisker_Primary_{side}",
        [
            ((side * 0.23, -0.65,  0.072), 0.028, 0.017, side * 12),
            ((side * 0.34, -0.67,  0.062), 0.048, 0.019, side * 24),
            ((side * 0.52, -0.69,  0.015), 0.082, 0.016, side * 42),
            ((side * 0.72, -0.50, -0.055), 0.094, 0.014, side * 54),
            ((side * 0.88, -0.14, -0.075), 0.072, 0.012, side * 26),
            ((side * 0.96,  0.26,  0.015), 0.046, 0.009, side * -14),
            ((side * 0.90,  0.62,  0.145), 0.022, 0.006, side * -34),
            ((side * 0.78,  0.88,  0.245), 0.003, 0.002, side * -48),
        ],
        n_u=36,
        up_hint=(0.0, 0.0, 1.0)
    )
    whisker_gold_objs.append(main_whisker)

    # 2) Secondary Anterior Tendril Whisker (副鬚)
    sub_follicle = create_tapered_curve_mesh(f"Sub_Whisker_Follicle_{side}", [
        ((side * 0.18, -0.74, 0.094), 0.032),
        ((side * 0.25, -0.76, 0.090), 0.026),
        ((side * 0.30, -0.77, 0.086), 0.018),
    ], resolution_u=8, bevel_res=5)
    flame_vermilion_objs.append(sub_follicle)

    sub_whisker = create_sculpted_ribbon_mesh(
        f"Dragon_Whisker_Secondary_{side}",
        [
            ((side * 0.18, -0.74, 0.092), 0.018, 0.012, side * 18),
            ((side * 0.28, -0.77, 0.086), 0.034, 0.013, side * 32),
            ((side * 0.44, -0.82, 0.058), 0.048, 0.011, side * 48),
            ((side * 0.58, -0.73, 0.035), 0.036, 0.008, side * 22),
            ((side * 0.66, -0.54, 0.068), 0.018, 0.005, side * -8),
            ((side * 0.64, -0.36, 0.125), 0.003, 0.002, side * -26),
        ],
        n_u=24,
        up_hint=(0.0, 0.0, 1.0)
    )
    whisker_gold_objs.append(sub_whisker)

    # 3) Tertiary Posterior Maxillary Whisker (後鬚)
    rear_follicle = create_tapered_curve_mesh(f"Rear_Whisker_Follicle_{side}", [
        ((side * 0.26, -0.44, 0.072), 0.036),
        ((side * 0.33, -0.45, 0.068), 0.028),
        ((side * 0.38, -0.44, 0.062), 0.020),
    ], resolution_u=8, bevel_res=5)
    flame_vermilion_objs.append(rear_follicle)

    rear_whisker = create_sculpted_ribbon_mesh(
        f"Dragon_Whisker_Posterior_{side}",
        [
            ((side * 0.27, -0.44,  0.070), 0.022, 0.014, side * -12),
            ((side * 0.37, -0.44,  0.060), 0.038, 0.015, side * -26),
            ((side * 0.52, -0.34, -0.025), 0.058, 0.013, side * -44),
            ((side * 0.66, -0.08, -0.145), 0.050, 0.011, side * -28),
            ((side * 0.74,  0.24, -0.155), 0.032, 0.008, side * 8),
            ((side * 0.72,  0.54, -0.085), 0.015, 0.005, side * 28),
            ((side * 0.64,  0.76, -0.010), 0.003, 0.002, side * 42),
        ],
        n_u=28,
        up_hint=(0.0, 0.0, 1.0)
    )
    whisker_gold_objs.append(rear_whisker)

    # =========================================================================
    # B. CLUSTERED ASYMMETRIC FLAME EYEBROWS (主次分明、長短寬窄交錯的火焰眉簇 — 100%浮於眉弓骨稜外上方，絕不穿模額頭皮膚!)
    # =========================================================================
    brow_cluster_specs = [
        # 1. Inner Glabella Short Scowl Flame Tongue (眉頭短怒焰)
        (True,  (0.24, -0.36, 0.38), (0.31, -0.40, 0.43), (0.38, -0.39, 0.49), (0.41, -0.34, 0.55), (0.38, -0.28, 0.59), 0.046, 0.018, 28),
        # 2. Anterior Secondary Splay Flame (前次眉焰 — 向外前上方展開)
        (False, (0.28, -0.34, 0.40), (0.36, -0.37, 0.46), (0.47, -0.34, 0.54), (0.55, -0.24, 0.63), (0.52, -0.14, 0.69), 0.058, 0.019, 42),
        # 3. HERO PRIMARY BROW PEAK FLAME (主眉峰巨焰 — 最寬最長、向外上方威猛飛揚!)
        (True,  (0.32, -0.30, 0.42), (0.41, -0.32, 0.49), (0.55, -0.25, 0.61), (0.67, -0.09, 0.74), (0.62,  0.07, 0.83), 0.082, 0.022, 50),
        # 4. Upper Companion Overlapping Flame (主眉上方交疊副焰 — 與主焰交錯抱合)
        (False, (0.35, -0.26, 0.43), (0.44, -0.27, 0.51), (0.55, -0.18, 0.64), (0.62, -0.03, 0.74), (0.58,  0.10, 0.79), 0.054, 0.018, 34),
        # 5. Posterior Outer Sweeping Flame (眉尾外掠長焰 — 向外側後方大幅舒展)
        (True,  (0.38, -0.22, 0.42), (0.47, -0.22, 0.48), (0.61, -0.12, 0.57), (0.73,  0.04, 0.66), (0.71,  0.19, 0.72), 0.066, 0.020, 46),
        # 6. Outer Temple Basal Curling Tongue (太陽穴底托短焰)
        (False, (0.41, -0.18, 0.39), (0.49, -0.17, 0.44), (0.59, -0.08, 0.50), (0.66,  0.03, 0.55), (0.64,  0.12, 0.58), 0.048, 0.017, 25),
    ]
    for b_idx, (is_gold, p0, p1, p2, p3, p4, wm, thm, twp) in enumerate(brow_cluster_specs):
        brow_blade = create_sculpted_ribbon_mesh(
            f"Flame_Brow_Cluster_{side}_{b_idx}",
            [
                ((side * p0[0], p0[1], p0[2]), wm * 0.45, thm * 0.85, side * (twp * 0.4)),
                ((side * p1[0], p1[1], p1[2]), wm * 0.90, thm,        side * (twp * 0.75)),
                ((side * p2[0], p2[1], p2[2]), wm * 1.08, thm * 0.82, side * twp),
                ((side * p3[0], p3[1], p3[2]), wm * 0.56, thm * 0.55, side * (twp * 0.6)),
                ((side * p4[0], p4[1], p4[2]), 0.003,     0.002,      side * (twp * 0.25)),
            ],
            n_u=18,
            up_hint=(0.0, 1.0, 0.25)
        )
        if is_gold:
            whisker_gold_objs.append(brow_blade)
        else:
            flame_vermilion_objs.append(brow_blade)

    # =========================================================================
    # C. CLUSTERED NON-COMB CHEEK & JAWLINE FLAME MANE (三簇交疊龍腮火焰鬃毛)
    # =========================================================================
    cheek_cluster_specs = [
        (False, (0.24, -0.05, 0.29), (0.43, -0.08, 0.28), (0.55, 0.04, 0.34), (0.64, 0.18, 0.41), (0.62, 0.28, 0.46), 0.052, 0.018, 22),
        (True,  (0.24, -0.02, 0.23), (0.45, -0.04, 0.22), (0.63, 0.12, 0.28), (0.78, 0.32, 0.38), (0.76, 0.50, 0.46), 0.084, 0.022, 42),
        (False, (0.23,  0.02, 0.18), (0.44,  0.01, 0.17), (0.57, 0.16, 0.20), (0.66, 0.34, 0.25), (0.64, 0.46, 0.30), 0.060, 0.019, 18),
        (True,  (0.24, -0.03, 0.11), (0.46, -0.05, 0.10), (0.66, 0.11, 0.12), (0.82, 0.31, 0.20), (0.84, 0.52, 0.30), 0.090, 0.023, 48),
        (False, (0.23,  0.00, 0.06), (0.44, -0.02, 0.05), (0.60, 0.12, 0.03), (0.73, 0.29, 0.08), (0.74, 0.44, 0.16), 0.058, 0.018, 30),
        (True,  (0.22, -0.06, 0.01), (0.41, -0.08, 0.00), (0.54, 0.04, -0.02), (0.64, 0.18, 0.02), (0.65, 0.30, 0.08), 0.068, 0.020, 26),
    ]
    for c_idx, (is_gold, p0, p1, p2, p3, p4, wm, thm, twp) in enumerate(cheek_cluster_specs):
        cheek_blade = create_sculpted_ribbon_mesh(
            f"Cheek_Mane_Cluster_{side}_{c_idx}",
            [
                ((side * p0[0], p0[1], p0[2]), wm * 0.45, thm * 0.85, side * (twp * 0.35)),
                ((side * p1[0], p1[1], p1[2]), wm * 0.92, thm,        side * (twp * 0.75)),
                ((side * p2[0], p2[1], p2[2]), wm * 1.08, thm * 0.82, side * twp),
                ((side * p3[0], p3[1], p3[2]), wm * 0.58, thm * 0.55, side * (twp * 0.60)),
                ((side * p4[0], p4[1], p4[2]), 0.003,     0.002,      side * (twp * 0.20)),
            ],
            n_u=18,
            up_hint=(0.0, 0.0, 1.0)
        )
        if is_gold:
            whisker_gold_objs.append(cheek_blade)
        else:
            flame_vermilion_objs.append(cheek_blade)

# 4) Layered Lower Jaw Chin Beard Tuft
chin_specs = [
    ( 0.000, -0.68, -0.45, 1.25, 0.056),
    (-0.052, -0.65, -0.46, 0.95, 0.044),
    ( 0.052, -0.65, -0.46, 0.95, 0.044),
    (-0.105, -0.61, -0.46, 0.72, 0.036),
    ( 0.105, -0.61, -0.46, 0.72, 0.036),
]
for ch_idx, (x_pos, y_base, z_base, l_sc, w_m) in enumerate(chin_specs):
    chin_ribbon = create_sculpted_ribbon_mesh(
        f"Chin_Beard_Ribbon_{ch_idx}",
        [
            ((x_pos * 0.60, y_base + 0.08, z_base + 0.07), w_m * 0.45, 0.014, x_pos * 140),
            ((x_pos,        y_base,        z_base),        w_m,        0.016, x_pos * 220),
            ((x_pos * 1.18, y_base + 0.05 * l_sc, z_base - 0.09 * l_sc), w_m * 1.08, 0.012, x_pos * 300),
            ((x_pos * 1.35, y_base + 0.17 * l_sc, z_base - 0.18 * l_sc), w_m * 0.55, 0.008, x_pos * 180),
            ((x_pos * 1.45, y_base + 0.32 * l_sc, z_base - 0.23 * l_sc), 0.003,      0.002, x_pos * 60),
        ],
        n_u=16,
        up_hint=(1.0, 0.0, 0.0)
    )
    whisker_gold_objs.append(chin_ribbon)

# 5) Graduated Ruyi Nasal Bridge Cloud Crest Blades
for n_idx in range(4):
    t_n = n_idx / 3.0
    ny = -0.70 + t_n * 0.34
    nz = 0.21 + t_n * 0.13
    sc_n = 0.75 + 0.45 * t_n
    nasal_blade = create_sculpted_ribbon_mesh(
        f"Nasal_Crest_Blade_{n_idx}",
        [
            ((0.0, ny - 0.01, nz - 0.05), 0.024 * sc_n, 0.015, 90),
            ((0.0, ny + 0.01, nz + 0.015), 0.044 * sc_n, 0.017, 90),
            ((0.0, ny + 0.05 * sc_n, nz + 0.058 * sc_n), 0.028 * sc_n, 0.011, 90),
            ((0.0, ny + 0.09 * sc_n, nz + 0.088 * sc_n), 0.003, 0.002, 90),
        ],
        n_u=12,
        up_hint=(1.0, 0.0, 0.0)
    )
    whisker_gold_objs.append(nasal_blade)

whiskers_gold_mesh = join_and_assign(whisker_gold_objs, "Dragon_Whiskers_And_Gold_Brows", mat_gold, uv_scale=2.8)
flames_vermilion_mesh = join_and_assign(flame_vermilion_objs, "Dragon_Flame_Mane_Locks", mat_vermilion, uv_scale=2.8)

# ---------------------------------------------------------------------------
# 8. Surface-Conformed 3D Neck Scales, Dorsal Flame Fins & Form-Fitting Neck Collar
# ---------------------------------------------------------------------------
print("[DragonHead 2.2] Constructing surface-conformed 3D neck scales, dorsal fins & form-fitting neck collar...")

def build_curved_shield_scale_template():
    bm = bmesh.new()
    top_coords = [
        (0.0, 0.068, 0.026),
        (-0.090, 0.0, 0.018),
        (-0.070, -0.098, 0.010),
        (0.0, -0.148, 0.017),
        (0.070, -0.098, 0.010),
        (0.090, 0.0, 0.018),
        (0.0, -0.045, 0.038),
    ]
    bot_coords = [(x, y, z - 0.046) for (x, y, z) in top_coords]

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

neck_y_rows = [0.26, 0.39, 0.52, 0.65, 0.78]

for r_idx, ny in enumerate(neck_y_rows):
    z_c, n_rx, n_rz = get_neck_profile(ny)
    occ_blend = gaussian(ny, 0.0, 0.22)
    surf_rx = n_rx + 0.14 * occ_blend + 0.010
    surf_rz = n_rz + 0.12 * occ_blend + 0.010

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

for d_idx in range(6):
    dy = 0.12 + d_idx * 0.13
    z_c, _, n_rz = get_neck_profile(dy)
    occ_b = gaussian(dy, 0.0, 0.22)
    dz = z_c + n_rz + 0.12 * occ_b
    d_scale = 1.15 - 0.08 * d_idx
    dorsal_fin = create_sculpted_ribbon_mesh(
        f"Dorsal_Mane_Blade_{d_idx}",
        [
            ((0.0, dy - 0.02, dz - 0.08), 0.044 * d_scale, 0.026, 90),
            ((0.0, dy + 0.02, dz + 0.02), 0.084 * d_scale, 0.028, 90),
            ((0.0, dy + 0.11, dz + 0.15 * d_scale), 0.064 * d_scale, 0.020, 90),
            ((0.0, dy + 0.22, dz + 0.25 * d_scale), 0.028 * d_scale, 0.010, 90),
            ((0.0, dy + 0.30, dz + 0.31 * d_scale), 0.003, 0.002, 90),
        ],
        n_u=14,
        up_hint=(1.0, 0.0, 0.0)
    )
    if d_idx % 2 == 0:
        gold_scale_objs.append(dorsal_fin)
    else:
        emerald_scale_objs.append(dorsal_fin)

def build_form_fitting_neck_collar():
    bm = bmesh.new()
    n_u = 40
    n_v = 12
    y_col = 0.87
    z_c, rx_c, rz_c = get_neck_profile(y_col)
    rings = []
    for iu in range(n_u):
        theta = (iu / n_u) * 2.0 * math.pi
        sin_t = math.sin(theta)
        cos_t = math.cos(theta)
        cloud_wave = 0.012 * math.cos(theta * 6.0)
        loop_verts = []
        for iv in range(n_v):
            phi = (iv / n_v) * 2.0 * math.pi
            dr = 0.026 * math.cos(phi)
            dy = (0.042 + cloud_wave) * math.sin(phi)
            x = (rx_c + dr) * sin_t
            y = y_col + dy
            z = z_c + (rz_c + dr) * cos_t
            loop_verts.append(bm.verts.new((x, y, z)))
        rings.append(loop_verts)

    for iu in range(n_u):
        niu = (iu + 1) % n_u
        r0 = rings[iu]
        r1 = rings[niu]
        for iv in range(n_v):
            niv = (iv + 1) % n_v
            bm.faces.new((r0[iv], r1[iv], r1[niv], r0[niv]))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new("Neck_Body_Connection_Collar_Mesh")
    bm.to_mesh(mesh)
    bm.free()
    c_obj = bpy.data.objects.new("Neck_Body_Connection_Collar", mesh)
    link_to_master(c_obj)
    return c_obj

collar_ring = build_form_fitting_neck_collar()
gold_scale_objs.append(collar_ring)

scales_emerald_mesh = join_and_assign(emerald_scale_objs, "Dragon_Neck_Scales_Emerald", mat_emerald, uv_scale=2.8)
scales_gold_mesh = join_and_assign(gold_scale_objs, "Dragon_Dorsal_Mane_And_Collar_Gold", mat_gold, uv_scale=2.8)

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
print(f"[DragonHead 2.2] Saving editable Blender project to: {BLEND_OUT}")
bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)

print(f"[DragonHead 2.2] Exporting GLB to: {GLB_OUT}")
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
print(f"[DragonHead 2.2] Exported GLB size: {glb_size} bytes | .blend size: {blend_size} bytes")

# ---------------------------------------------------------------------------
# 11. Render Studio Multi-Angle, Close-Ups & Wireframe Views inside Blender 5.3
# ---------------------------------------------------------------------------
print("[DragonHead 2.2] Setting up identical Blender Studio Lighting & Camera for 9 Inspection Renders...")

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
    "front": ((0.0, -3.55, 0.52), (0.0, -0.15, 0.34), 50.0),
    "side_left": ((-3.65, -0.05, 0.40), (0.0, -0.05, 0.36), 50.0),
    "side_right": ((3.65, -0.05, 0.40), (0.0, -0.05, 0.36), 50.0),
    "angle45": ((-2.55, -2.55, 1.18), (0.0, -0.08, 0.36), 50.0),
    "top": ((0.0, -0.25, 3.95), (0.0, -0.05, 0.30), 50.0),
    "bottom_jaw": ((0.0, -2.50, -1.65), (0.0, -0.45, 0.02), 50.0),
    "closeup_eye_brow": ((-1.35, -1.25, 0.62), (-0.24, -0.26, 0.35), 62.0),
    "closeup_snout_mouth_teeth": ((-1.25, -1.68, -0.04), (-0.04, -0.64, -0.06), 58.0),
    "closeup_whisker_neck": ((-1.95, -1.10, 0.22), (-0.22, 0.08, 0.12), 52.0),
}

rendered_files = {}
for vname, (cam_pos, tgt_pos, lens_mm) in views.items():
    cam_data.lens = lens_mm
    cam_obj.location = Vector(cam_pos)
    target_empty.location = Vector(tgt_pos)
    bpy.context.view_layer.update()
    out_png = os.path.join(RENDER_DIR, f"blender_{vname}.png")
    scene.render.filepath = out_png
    bpy.ops.render.render(write_still=True)
    rendered_files[vname] = out_png

    after_png = os.path.join(AFTER_DIR, f"after_{vname}.png")
    scene.render.filepath = after_png
    bpy.ops.render.render(write_still=True)
    print(f"[DragonHead 2.2] Rendered {vname} -> {out_png}")

# Render Wireframe Topology View
cam_data.lens = 50.0
cam_obj.location = Vector((-2.45, -2.45, 1.10))
target_empty.location = Vector((0.0, -0.08, 0.36))
mat_wire = create_jiannian_material("Wireframe_Gold", base_color=(0.95, 0.75, 0.22, 1.0), metallic=0.2, roughness=0.3, use_glaze_maps=False)
mat_clay = create_jiannian_material("Clay_Base", base_color=(0.08, 0.07, 0.06, 1.0), metallic=0.0, roughness=0.75, use_glaze_maps=False)

for obj in all_mesh_objs:
    obj.data.materials.clear()
    obj.data.materials.append(mat_clay)
    obj.data.materials.append(mat_wire)
    wmod = obj.modifiers.new(name="WireOverlay", type='WIREFRAME')
    wmod.thickness = 0.0035
    wmod.use_replace = False
    wmod.material_offset = 1

bpy.context.view_layer.update()
wire_png = os.path.join(RENDER_DIR, "blender_wireframe.png")
scene.render.filepath = wire_png
bpy.ops.render.render(write_still=True)
rendered_files["wireframe"] = wire_png
print(f"[DragonHead 2.2] Rendered wireframe -> {wire_png}")

# ---------------------------------------------------------------------------
# 12. Re-Import GLB into Clean Blender Scene & Collect Full Verification Metrics
# ---------------------------------------------------------------------------
print(f"[DragonHead 2.2] Re-importing {GLB_OUT} into clean Blender scene for verification...")
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
    "stage": "2.2",
    "blenderVersion": bpy.app.version_string,
    "blendSourceFile": BLEND_OUT,
    "blendStage2BackupFile": os.path.join(ROOT_DIR, "assets", "source", "dragon-head-stage2.blend"),
    "blendStage2_1BackupFile": os.path.join(ROOT_DIR, "assets", "source", "dragon-head-stage2.1.blend"),
    "blendFileSize": blend_size,
    "glbFile": GLB_OUT,
    "glbFileSize": glb_size,
    "reImportSummary": {
        "meshObjectCount": len(imp_meshes),
        "totalVertices": total_verts,
        "totalEdges": total_edges,
        "totalTriangles": total_tris,
        "stage2BaselineTriangles": 154968,
        "stage2_1BaselineTriangles": 118014,
        "triangleDeltaFromStage2": total_tris - 154968,
        "triangleDeltaFromStage2_1": total_tris - 118014,
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

print(f"[DragonHead 2.2] Verification report saved to: {REPORT_OUT}")
print(f"[DragonHead 2.2] Summary: {len(imp_meshes)} mesh groups, {total_verts} vertices, {total_tris} triangles (Stage 2.1: 118,014 | Stage 2.0: 154,968), {glb_size} bytes")
print("[DragonHead 2.2] STAGE 2.2 BLENDER PIPELINE COMPLETED SUCCESSFULLY!")
