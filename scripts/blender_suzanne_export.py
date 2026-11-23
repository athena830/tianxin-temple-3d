import bpy
import os
import sys

"""
Blender Background Verification Script for Phase 3 Stage 1.5
Usage:
  blender -b -P scripts/blender_suzanne_export.py -- [output_glb_path]

Tests:
1. bpy execution in background mode
2. Suzanne monkey mesh generation
3. Principled BSDF PBR material setup
4. Export to glTF 2.0 / GLB
5. Re-import verification (mesh count, vertex count, materials)
"""

output_path = "public/assets/models/test_blender.glb"
if "--" in sys.argv:
    argv_after = sys.argv[sys.argv.index("--") + 1:]
    if argv_after:
        output_path = argv_after[0]

output_path = os.path.abspath(output_path)
os.makedirs(os.path.dirname(output_path), exist_ok=True)

print(f"[Blender Script] Running on Blender version: {bpy.app.version_string}")

# 1. Reset scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# 2. Add Suzanne
bpy.ops.mesh.primitive_monkey_add(size=2.0, location=(0, 0, 0))
suzanne = bpy.context.active_object
suzanne.name = "Suzanne_Test"

# Smooth shading
for poly in suzanne.data.polygons:
    poly.use_smooth = True

# 3. Create Principled BSDF PBR Material
mat = bpy.data.materials.new(name="Suzanne_PBR_Material")
mat.use_nodes = True
nodes = mat.node_tree.nodes
bsdf = nodes.get("Principled BSDF")
if bsdf:
    # Base Color: Temple vermilion red (#c83828)
    bsdf.inputs["Base Color"].default_value = (0.78, 0.22, 0.16, 1.0)
    # Metallic: 0.35
    bsdf.inputs["Metallic"].default_value = 0.35
    # Roughness: 0.25
    bsdf.inputs["Roughness"].default_value = 0.25

if suzanne.data.materials:
    suzanne.data.materials[0] = mat
else:
    suzanne.data.materials.append(mat)

# 4. Export to GLB
print(f"[Blender Script] Exporting to: {output_path}")
bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_materials='EXPORT',
    export_colors=True
)

file_size = os.path.getsize(output_path)
print(f"[Blender Script] GLB Exported successfully. Size: {file_size} bytes")

# 5. Re-import verification
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=output_path)

imported_objs = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
print(f"[Blender Script] Re-imported object count: {len(imported_objs)}")
for obj in imported_objs:
    print(f"  - Object: {obj.name}, Vertices: {len(obj.data.vertices)}, Polygons: {len(obj.data.polygons)}, Materials: {[m.name for m in obj.data.materials]}")

print("[Blender Script] Verification completed successfully.")
