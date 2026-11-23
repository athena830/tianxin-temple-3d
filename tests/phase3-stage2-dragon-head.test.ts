import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'

describe('Phase 3 Stage 2 Stylized Realism Dragon Head Asset Verification', () => {
  it('verifies dragon-head.blend and temple-dragon-head-preview.glb exist with valid Blender glTF 2.0 header', () => {
    const blendPath = 'assets/source/dragon-head.blend'
    const glbPath = 'public/assets/models/temple-dragon-head-preview.glb'
    const reportPath = 'public/assets/models/temple-dragon-head-report.json'

    expect(existsSync(blendPath)).toBe(true)
    expect(existsSync(glbPath)).toBe(true)
    expect(existsSync(reportPath)).toBe(true)

    const glbBuffer = readFileSync(glbPath)
    expect(glbBuffer.length).toBeGreaterThan(50000)

    const magic = glbBuffer.readUInt32LE(0)
    const version = glbBuffer.readUInt32LE(4)
    const totalLength = glbBuffer.readUInt32LE(8)

    expect(magic).toBe(0x46546c67) // 'glTF'
    expect(version).toBe(2)
    expect(totalLength).toBe(glbBuffer.length)

    // Verify JSON chunk generator is Khronos glTF Blender I/O
    const jsonLen = glbBuffer.readUInt32LE(12)
    const jsonType = glbBuffer.readUInt32LE(16)
    expect(jsonType).toBe(0x4e4f534a) // 'JSON'
    const gltfJson = JSON.parse(glbBuffer.subarray(20, 20 + jsonLen).toString('utf8'))
    expect(gltfJson.asset?.version).toBe('2.0')
    expect(gltfJson.asset?.generator).toMatch(/Blender/i)
  })

  it('verifies Blender re-import report confirms all anatomical components, valid normals, and Principled BSDF materials', () => {
    const report = JSON.parse(readFileSync('public/assets/models/temple-dragon-head-report.json', 'utf8'))
    expect(report.blenderVersion).toBe('5.3.0')
    expect(report.reImportSummary.meshObjectCount).toBeGreaterThanOrEqual(8)
    expect(report.reImportSummary.totalVertices).toBeGreaterThan(10000)
    expect(report.reImportSummary.totalTriangles).toBeGreaterThan(15000)

    // Verify all meshes have valid unit normals
    for (const mesh of report.reImportSummary.meshes) {
      expect(mesh.normalsValid).toBe(true)
    }

    // Verify Taiwanese temple Jiannian PBR material palette
    const mats = report.reImportSummary.uniqueMaterials
    expect(mats).toContain('Jiannian_Vermilion_Ceramic')
    expect(mats).toContain('Jiannian_Imperial_Gold')
    expect(mats).toContain('Jiannian_Emerald_Glaze')
    expect(mats).toContain('Jiannian_Fang_Ivory')
    expect(mats).toContain('Jiannian_Oral_Crimson')
    expect(mats).toContain('Jiannian_Eye_Obsidian')
  })
})
