/**
 * 天心仙姑 服務入口設定（LINE 預約解卦、隨喜支持）
 * 集中管理外部連結、收款 QR Code 資產路徑與文案，日後更換僅需修改此檔。
 * 本模組為純設定與 HTML 片段，不涉及象棋卜卦引擎與任何計分規則。
 */

/** 天心仙姑 LINE 官方帳號（加入好友） */
export const LINE_OFFICIAL_URL = 'https://lin.ee/Y32sNpjt'

/**
 * 永豐銀行收款 QR Code 圖片
 * 內容為永豐官方票卡所載之收款連結（經使用者同意由官方連結轉製，已解碼核對一致）：
 * https://trustpay.hitrust.com.tw/TRUSTPAY/EasyPay2?checktoken=&storeid=6P839
 */
export const DONATION_QR_SRC = './assets/payment/sinopac-scan-to-pay.png'
export const DONATION_QR_DOWNLOAD_NAME = '天心仙姑-隨喜支持-永豐銀行.png'

export const SERVICE_TEXT = {
  lineTitle: '想進一步了解你的卦象嗎？',
  lineDesc: '若想進一步詢問卦象或預約人工解卦，歡迎加入天心仙姑 LINE 官方好友。',
  lineButton: '加入 LINE 官方好友・預約解卦',
  donateTitle: '隨喜支持・讓善意延續',
  donateDesc: '若這次卜卦或網站內容對你有所幫助，歡迎隨喜支持，讓天心仙姑有更多力量持續維護網站與分享服務。金額隨心，感謝每一份心意。',
  donateFree: '自由隨喜，金額不限',
  donateMethod: '永豐銀行',
  donateNotice: '本站不會自動確認收款，亦無任何付款義務；隨喜與否皆不影響卜卦服務。',
} as const

const esc = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** LINE 預約 + 隨喜支持 區塊 HTML（卜卦結果頁、首頁入口視窗共用） */
export function renderServiceSection(): string {
  const t = SERVICE_TEXT
  return `
    <section class="service-section" aria-label="預約解卦與隨喜支持">
      <div class="service-card service-line">
        <h4 class="service-title">${esc(t.lineTitle)}</h4>
        <p class="service-desc">${esc(t.lineDesc)}</p>
        <a class="btn-line" href="${LINE_OFFICIAL_URL}" target="_blank" rel="noopener noreferrer">
          <span class="btn-line-icon" aria-hidden="true">LINE</span>${esc(t.lineButton)}
        </a>
      </div>
      <div class="service-card service-donate">
        <h4 class="service-title">${esc(t.donateTitle)}</h4>
        <p class="service-desc">${esc(t.donateDesc)}</p>
        <button type="button" class="donate-qr-thumb" data-act="qr-zoom" aria-label="點擊放大收款 QR Code">
          <img src="${DONATION_QR_SRC}" alt="${esc(t.donateMethod)} 隨喜支持 QR Code" width="180" height="180" loading="lazy" decoding="async" />
          <span class="donate-qr-hint">點擊放大</span>
        </button>
        <p class="donate-free">${esc(t.donateFree)}</p>
        <p class="donate-method">${esc(t.donateMethod)}</p>
        <a class="donate-save" href="${DONATION_QR_SRC}" download="${DONATION_QR_DOWNLOAD_NAME}">儲存 QR Code 圖片</a>
        <p class="donate-notice">${esc(t.donateNotice)}</p>
      </div>
    </section>
  `
}

/** QR Code 放大檢視視窗 HTML（掛載於 UI 根節點一次） */
export function renderQrLightbox(): string {
  const t = SERVICE_TEXT
  return `
    <div class="qr-lightbox" data-qr-lightbox hidden role="dialog" aria-modal="true" aria-label="隨喜支持 QR Code">
      <div class="qr-lightbox-card">
        <button type="button" class="close" data-act="qr-close" aria-label="關閉">×</button>
        <p class="qr-lightbox-title">${esc(t.donateTitle)}</p>
        <img src="${DONATION_QR_SRC}" alt="${esc(t.donateMethod)} 隨喜支持 QR Code（放大）" />
        <p class="donate-free">${esc(t.donateFree)}・${esc(t.donateMethod)}</p>
        <a class="donate-save" href="${DONATION_QR_SRC}" download="${DONATION_QR_DOWNLOAD_NAME}">儲存 QR Code 圖片</a>
        <p class="donate-notice">手機亦可長按圖片儲存，再以銀行或支付 App 掃描。</p>
      </div>
    </div>
  `
}

/** 首頁服務入口視窗 HTML */
export function renderServiceModal(): string {
  return `
    <div class="service-modal" data-service-modal hidden role="dialog" aria-modal="true" aria-label="預約解卦與隨喜支持">
      <div class="service-modal-card">
        <button type="button" class="close" data-act="services-close" aria-label="關閉">×</button>
        <p class="eyebrow">天心仙姑・服務</p>
        ${renderServiceSection()}
      </div>
    </div>
  `
}
