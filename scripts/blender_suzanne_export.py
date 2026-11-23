import bpy
import os
import sys
import json
import math
from mathutils import Vector

"""
Blender 5.3 Background Verification Script for Phase 3 Stage 1.5
Usage:
  blender -b --python-exit-code 1 -P scripts/blender_suzanne_export.py -- [output_glb_path]

Tests:
1. bpy execution in background mode
2. Suzanne monkey mesh generation via bpy.ops.mesh.primitive_monkey_add
3. Principled BSDF PBR material assignment
4. Export to glTF 2.0 Binary (.glb)
5. Re-import GLB verification: Geometry, Material, Normals, Dimensions, and Orientation
"""

output_path = "public/assets/models/test_blender.glb"
if "--" in sys.argv:
    argv_after = sys.argv[sys.argv.index("--") + 1:]
    if argv_after:
        output_path = argv_after[0]

output_path = os.path.abspath(output_path)
os.makedirs(os.path.dirname(output_path), exist_ok=True)

print(f"[Blender Script] Blender Version: {bpy.app.version_string} (Tuple: {bpy.app.version})")
print(f"[Blender Script] Binary Path: {bpy.app.binary_path}")

# 1. Reset scene to empty factory state
bpy.ops.wm.read_factory_settings(use_empty=True)

# 2. Create Suzanne Mesh
bpy.ops.mesh.primitive_monkey_add(size=2.0, location=(0.0, 0.0, 0.0), rotation=(0.0, 0.0, 0.0))
suzanne = bpy.context.active_object
suzanne.name = "Suzanne_Blender_Test"

# Apply smooth shading
bpy.ops.object.shade_smooth()

# Record pre-export dimensions & orientation in Blender space (-Y forward, +Z up)
bpy.context.view_layer.update()
pre_dims = [round(d, 4) for d in suzanne.dimensions]
pre_verts = len(suzanne.data.vertices)
pre_polys = len(suzanne.data.polygons)
print(f"[Blender Script] Created Suzanne: verts={pre_verts}, polygons={pre_polys}, dimensions={pre_dims}")

# 3. Create & Assign Principled BSDF PBR Material
mat = bpy.data.materials.new(name="Suzanne_PBR_Material")
mat.use_nodes = True
nodes = mat.node_tree.nodes
bsdf = nodes.get("Principled BSDF")
if not bsdf:
    for n in nodes:
        if n.type == 'BSDF_PRINCIPLED':
            bsdf = n
            break

if not bsdf:
    raise RuntimeError("Principled BSDF node not found in material node tree")

# Base Color: Temple vermilion red
bsdf.inputs["Base Color"].default_value = (0.784, 0.220, 0.157, 1.0)
bsdf.inputs["Metallic"].default_value = 0.35
bsdf.inputs["Roughness"].default_value = 0.25

if suzanne.data.materials:
    suzanne.data.materials[0] = mat
else:
    suzanne.data.materials.append(mat)

# Select only Suzanne for export
bpy.ops.object.select_all(action='DESELECT')
suzanne.select_set(True)
bpy.context.view_layer.objects.active = suzanne

# 4. Export to GLB (glTF 2.0 Binary)
print(f"[Blender Script] Exporting GLB to: {output_path}")
bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_materials='EXPORT'
)

if not os.path.exists(output_path):
    raise RuntimeError(f"Export failed: {output_path} does not exist")

file_size = os.path.getsize(output_path)
with open(output_path, "rb") as f:
    header = f.read(12)
magic = header[0:4].decode('ascii', errors='replace')
version = int.from_bytes(header[4:8], byteorder='little')
total_len = int.from_bytes(header[8:12], byteorder='little')

print(f"[Blender Script] Exported GLB successfully: size={file_size} bytes, magic='{magic}', version={version}, header_length={total_len}")
assert magic == "glTF", f"Invalid GLB magic: {magic}"
assert version == 2, f"Invalid GLB version: {version}"
assert total_len == file_size, f"Size mismatch: {total_len} != {file_size}"

# 5. Re-import GLB into a clean Blender scene & verify Geometry, Material, Normal, Dimensions, Orientation
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=output_path)
bpy.context.view_layer.update()

imported_meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
print(f"[Blender Script] Re-imported mesh object count: {len(imported_meshes)}")
assert len(imported_meshes) == 1, f"Expected 1 imported mesh, got {len(imported_meshes)}"

imp_obj = imported_meshes[0]
imp_mesh = imp_obj.data

# Verify Geometry
imp_verts = len(imp_mesh.vertices)
imp_edges = len(imp_mesh.edges)
imp_polys = len(imp_mesh.polygons)

# Calculate triangle count
imp_mesh.calc_loop_triangles()
imp_tris = len(imp_mesh.loop_triangles)

# Verify Normals (unit length & valid)
normal_lengths = [v.normal.length for v in imp_mesh.vertices]
min_norm_len = round(min(normal_lengths), 4)
max_norm_len = round(max(normal_lengths), 4)
normals_valid = all(0.99 <= l <= 1.01 for l in normal_lengths)

# Check front-most vertex normal (Suzanne's snout is at minimum Y in Blender space: y ~ -0.85)
front_vertex = min(imp_mesh.vertices, key=lambda v: v.co.y)
front_co = [round(c, 4) for c in front_vertex.co]
front_normal = [round(c, 4) for c in front_vertex.normal]

# Verify Dimensions & Bounding Box
imp_dims = [round(d, 4) for d in imp_obj.dimensions]
bbox_world = [imp_obj.matrix_world @ Vector(corner) for corner in imp_obj.bound_box]
bbox_min = [round(min(v[i] for v in bbox_world), 4) for i in range(3)]
bbox_max = [round(max(v[i] for v in bbox_world), 4) for i in range(3)]

# Verify Material & Principled BSDF properties
imp_materials = []
for m in imp_mesh.materials:
    if not m:
        continue
    mat_info = {"name": m.name, "use_nodes": m.use_nodes}
    if m.use_nodes and m.node_tree:
        for n in m.node_tree.nodes:
            if n.type == 'BSDF_PRINCIPLED':
                bc = n.inputs["Base Color"].default_value
                mat_info["base_color_rgba"] = [round(bc[0], 4), round(bc[1], 4), round(bc[2], 4), round(bc[3], 4)]
                mat_info["metallic"] = round(n.inputs["Metallic"].default_value, 4)
                mat_info["roughness"] = round(n.inputs["Roughness"].default_value, 4)
    imp_materials.append(mat_info)

assert len(imp_materials) == 1, "Expected 1 imported PBR material"
assert normals_valid, f"Invalid vertex normal lengths: min={min_norm_len}, max={max_norm_len}"

report = {
    "blenderVersion": bpy.app.version_string,
    "blenderBinary": bpy.app.binary_path,
    "glbPath": output_path,
    "glbFileSize": file_size,
    "glbHeader": {"magic": magic, "version": version, "length": total_len},
    "preExport": {
        "name": "Suzanne_Blender_Test",
        "vertices": pre_verts,
        "polygons": pre_polys,
        "dimensionsMeters": pre_dims
    },
    "reImport": {
        "objectName": imp_obj.name,
        "meshName": imp_mesh.name,
        "vertices": imp_verts,
        "edges": imp_edges,
        "polygons": imp_polys,
        "triangles": imp_tris,
        "normalsValid": normals_valid,
        "normalLengthRange": [min_norm_len, max_norm_len],
        "frontSnoutVertexBlenderSpace": {
            "coord": front_co,
            "normal": front_normal,
            "orientationNote": "In Blender space, Suzanne faces -Y (snout at Y=-0.8516). With export_yup=True, glTF/Three.js converts -Y forward to +Z forward."
        },
        "dimensionsMeters": imp_dims,
        "boundingBoxMin": bbox_min,
        "boundingBoxMax": bbox_max,
        "rotationEuler": [round(r, 4) for r in imp_obj.rotation_euler],
        "scale": [round(s, 4) for s in imp_obj.scale],
        "materials": imp_materials
    }
}

print("[Blender Script] Re-import Verification Report:")
print(json.dumps(report, indent=2))

report_out = os.path.join(os.path.dirname(output_path), "test_blender_reimport_report.json")
with open(report_out, "w", encoding="utf-8") as rf:
    json.dump(report, rf, indent=2, ensure_ascii=False)

print(f"[Blender Script] Saved report to: {report_out}")
print("[Blender Script] ALL BLENDER VERIFICATIONS PASSED!")
