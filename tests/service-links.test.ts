// @ts-expect-error 專案未安裝 @types/node；vitest 執行於 Node 環境可正常使用
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  DONATION_QR_SRC,
  LINE_OFFICIAL_URL,
  SERVICE_TEXT,
  renderDisclaimerStrip,
  renderLegalModal,
  renderQrLightbox,
  renderServiceModal,
  renderServiceSection,
} from '../src/ui/service-links'

describe('天心仙姑服務入口（LINE 預約・隨喜支持）', () => {
  it('LINE 官方好友連結正確，且以外部新分頁安全開啟', () => {
    expect(LINE_OFFICIAL_URL).toBe('https://lin.ee/Y32sNpjt')
    const html = renderServiceSection()
    expect(html).toContain(`href="${LINE_OFFICIAL_URL}"`)
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('加入 LINE 官方好友・預約解卦')
    expect(html).toContain('想進一步了解你的卦象嗎？')
  })

  it('收款 QR Code 為獨立資產檔案，且為有效 PNG', () => {
    const file = DONATION_QR_SRC.replace(/^\.\//, 'public/')
    expect(existsSync(file)).toBe(true)
    const sig = readFileSync(file).subarray(0, 8)
    expect([...sig]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  })

  it('隨喜區塊文案：自由隨喜、不含 Scan to Pay 字樣、不宣稱自動確認收款，並提供放大與儲存', () => {
    const html = renderServiceSection()
    const lightbox = renderQrLightbox()
    expect(html).toContain('隨喜支持・讓善意延續')
    expect(html).toContain(SERVICE_TEXT.donateFree)
    expect(html).toContain('永豐銀行')
    expect(html).not.toMatch(/scan\s*to\s*pay/i)
    expect(lightbox).not.toMatch(/scan\s*to\s*pay/i)
    expect(html).toContain('data-act="qr-zoom"')
    expect(html).toContain(`download=`)
    expect(html).toContain('不會自動確認收款')
    expect(html).not.toMatch(/最低|必須付款|付款成功/)
  })

  it('放大視窗與首頁入口視窗預設隱藏，且可關閉', () => {
    const lightbox = renderQrLightbox()
    expect(lightbox).toContain('data-qr-lightbox hidden')
    expect(lightbox).toContain('data-act="qr-close"')
    const modal = renderServiceModal()
    expect(modal).toContain('data-service-modal hidden')
    expect(modal).toContain('data-act="services-close"')
  })

  it('404.html 為獨立輕量導向頁，不含相對路徑 ./assets/ 且具備回首頁導向與連結', () => {
    const html = readFileSync('public/404.html', 'utf8')
    expect(html).not.toContain('./assets/')
    expect(html).toContain('/tianxin-temple-3d/')
    expect(html).toContain('window.location.replace')
    expect(html).toContain('返回首頁')
  })

  it('服務說明與隱私權彈窗包含民俗文化免責、localStorage 保存與自願隨喜條款', () => {
    const strip = renderDisclaimerStrip()
    expect(strip).toContain('民俗文化')
    expect(strip).toContain('data-act="open-legal"')

    const legal = renderLegalModal()
    expect(legal).toContain('data-legal-modal hidden')
    expect(legal).toContain('data-act="legal-close"')
    expect(legal).toContain('不構成且不應取代醫療診斷')
    expect(legal).toContain('法律')
    expect(legal).toContain('財務')
    expect(legal).toContain('localStorage')
    expect(legal).toContain('不設最低金額')
  })
})
