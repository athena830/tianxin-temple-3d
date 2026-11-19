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

/** 卜卦頁與問事頁底部免責與條款簡潔入口 */
export function renderDisclaimerStrip(): string {
  return `
    <div class="legal-strip">
      <p>象棋卜卦與籤詩屬民俗文化與自我探索參考，不構成且不應取代醫療、法律或財務專業判斷。</p>
      <button type="button" class="legal-link-btn" data-act="open-legal">服務說明、免責聲明與隱私權政策</button>
    </div>
  `
}

/** 服務說明、免責聲明與隱私權政策彈窗 HTML */
export function renderLegalModal(): string {
  return `
    <div class="legal-modal" data-legal-modal hidden role="dialog" aria-modal="true" aria-label="服務說明、免責聲明與隱私權政策">
      <div class="legal-modal-card">
        <button type="button" class="close" data-act="legal-close" aria-label="關閉">×</button>
        <p class="eyebrow">天心仙姑・玉皇宮線上 3D 宮廟</p>
        <h3>服務說明、使用條款與隱私權政策</h3>
        <div class="legal-body">
          <h4>一、民俗文化與專業免責聲明</h4>
          <p>本網站提供之象棋卜卦、格局解析、每日抽籤、擲筊請示與互動祈福體驗，皆屬於傳統民俗文化與自我探索之參考內容，<strong>不構成且不應取代醫療診斷、心理諮商、法律意見、財務規劃或投資決策等專業判斷</strong>。如遇身心健康、法律糾紛或重大財務決策，請務必尋求合格專業人員協助。</p>
          <h4>二、隱私權政策與資料保存方式</h4>
          <p>本網站無須註冊或登入，不主動蒐集您的真實姓名、生日、聯絡方式或身分證字號，亦不會將您的祈願文字或卜卦紀錄傳送至遠端伺服器。所有個人互動與卜卦摘要紀錄皆僅儲存在您目前裝置瀏覽器的本機儲存空間（<code>localStorage</code>），<strong>清除瀏覽器快取／資料、使用無痕模式或更換瀏覽器／裝置將無法保留</strong>；「祈福紀錄」最多保留 100 筆（超過將自動移除最舊紀錄），重要卦象建議隨時透過頁面上的複製或匯出功能自行備份。</p>
          <h4>三、使用條款與外部服務（LINE 預約・隨喜支持）</h4>
          <p>透過本網站前往「天心仙姑 LINE 官方好友」預約人工解卦，或透過永豐銀行收款 QR Code 進行「自由隨喜支持」，皆完全出於您的自由意願，本站不設最低金額、不強制付款，亦不會自動確認收款；隨喜與否均不影響本網站之任何免費卜卦與參拜功能。當您點擊前往 LINE 或銀行支付頁面時，將適用各該第三方平台之服務條款與隱私權政策。</p>
        </div>
        <div class="legal-footer">
          <button type="button" class="btn primary small" data-act="legal-close">我已了解</button>
        </div>
      </div>
    </div>
  `
}
