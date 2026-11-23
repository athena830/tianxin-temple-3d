import bpy
import math
import os
from mathutils import Vector, Euler

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BLEND_STAGE2 = os.path.join(ROOT_DIR, "assets", "source", "dragon-head-stage2.blend")
BEFORE_DIR = os.path.join(ROOT_DIR, "shots", "stage2-before")
os.makedirs(BEFORE_DIR, exist_ok=True)

bpy.ops.wm.open_mainfile(filepath=BLEND_STAGE2)
scene = bpy.context.scene

# Ensure identical studio lighting
for obj in list(scene.objects):
    if obj.type in ('LIGHT', 'CAMERA') or obj.name in ("CamTarget", "InspectionCam"):
        bpy.data.objects.remove(obj, do_unlink=True)

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

add_light("KeyLight", 'AREA', 240.0, (1.0, 0.95, 0.86), (-2.6, -2.8, 2.4), (52, 0, -42))
add_light("FillLight", 'AREA', 110.0, (0.85, 0.92, 1.0), (2.8, -2.0, 1.2), (65, 0, 50))
add_light("RimLight", 'AREA', 190.0, (1.0, 0.88, 0.68), (0.0, 2.8, 2.2), (-48, 0, 0))
add_light("UnderLight", 'POINT', 55.0, (1.0, 0.85, 0.70), (0.0, -1.8, -1.2), (0, 0, 0))

cam_data = bpy.data.cameras.new("InspectionCam")
cam_data.lens = 50.0
cam_obj = bpy.data.objects.new("InspectionCam", cam_data)
scene.collection.objects.link(cam_obj)
scene.camera = cam_obj

target_empty = bpy.data.objects.new("CamTarget", None)
scene.collection.objects.link(target_empty)

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
    "angle45": ((-2.55, -2.55, 1.18), (0.0, -0.08, 0.36), 50.0),
    "closeup_eye_brow": ((-1.35, -1.25, 0.62), (-0.24, -0.26, 0.35), 62.0),
    "closeup_snout_mouth_teeth": ((-1.25, -1.68, -0.04), (-0.04, -0.64, -0.06), 58.0),
    "closeup_whisker_neck": ((-1.95, -1.10, 0.22), (-0.22, 0.08, 0.12), 52.0),
}

for vname, (cam_pos, tgt_pos, lens_mm) in views.items():
    cam_data.lens = lens_mm
    cam_obj.location = Vector(cam_pos)
    target_empty.location = Vector(tgt_pos)
    bpy.context.view_layer.update()
    out_png = os.path.join(BEFORE_DIR, f"before_{vname}.png")
    scene.render.filepath = out_png
    bpy.ops.render.render(write_still=True)
    print(f"[BeforeRender] Rendered {vname} -> {out_png}")
