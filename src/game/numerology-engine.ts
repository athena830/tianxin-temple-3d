/**
 * 生命靈數（Numerology）演算法與解析字典
 * 依據古希臘畢達哥拉斯生命密碼計算：
 * 1. 西元出生年月日相加得出天賦數與主命數（1 ~ 9 號人）
 * 2. 統計 1 ~ 9 在生日盤與命數中的九宮格能量分布次數
 * 3. 提供 1 ~ 9 號人的溫馨療癒天賦與心靈指引
 */

export interface NumerologyResult {
  birthDate: string // YYYY-MM-DD
  birthDigits: number[]
  sum1: number // 第一階段總和，如 1996-08-22 -> 37
  sum2: number // 第二階段總和，如 37 -> 10
  sum3?: number // 第三階段總和（若 sum2 > 9），如 10 -> 1
  lifePathNumber: number // 主命數 (1 ~ 9)
  talentNumbers: number[] // 天賦數，如 [3, 7]
  formula: string // 算式，如 "1+9+9+6+0+8+2+2 = 37 → 3+7 = 10 → 1+0 = 1"
  gridCounts: Record<number, number> // 九宮格 1~9 出現次數（含生日數字、天賦數與主命數）
  birthdayCounts: Record<number, number> // 僅生日數字中的 1~9 出現次數
  profile: LifePathProfile
}

export interface LifePathProfile {
  number: number
  title: string
  archetype: string
  keywords: string[]
  strengths: string[]
  healingMessage: string
  careerGifts: string
  color: string
}

export const LIFE_PATH_PROFILES: Record<number, LifePathProfile> = {
  1: {
    number: 1,
    title: '1 號人・創始開拓領導者',
    archetype: '獨立開拓的靈魂先鋒',
    keywords: ['獨立', '原創', '領導', '自信', '果決'],
    strengths: ['天生具備開創新局的領袖氣魄', '目標明確且執行力極強', '勇於突破常規、開闢全新道路'],
    healingMessage: '親愛的 1 號人，你的獨立是宇宙賜予的禮物，但也請記得：適時示弱與信任夥伴，不是失去主導，而是讓溫暖的力量走進你的世界。允許自己放慢腳步，你已經足夠堅強優秀。',
    careerGifts: '創業者、專案發起人、企業主管、設計總監、獨立研究者',
    color: '#ff5252',
  },
  2: {
    number: 2,
    title: '2 號人・協調共感和平使者',
    archetype: '溫柔細膩的心靈調音師',
    keywords: ['同理', '協調', '敏銳', '優雅', '包容'],
    strengths: ['極高直覺與情感共感力', '善於傾聽並化解人際分歧', '細膩捕捉他人不易察覺的感受'],
    healingMessage: '溫暖的 2 號人，你總是先照顧身旁所有人的情緒，但請別忘了把溫柔留一份給自己。學會溫和而堅定地設立界線，你的敏銳與善良值得被同樣細心溫柔地對待。',
    careerGifts: '心理諮商師、公共關係、外交協商、藝術策展、人力資源導師',
    color: '#ff9800',
  },
  3: {
    number: 3,
    title: '3 號人・創意表達熱情精靈',
    archetype: '照亮世界的樂觀創造者',
    keywords: ['創意', '熱情', '表達', '幽默', '靈動'],
    strengths: ['天馬行空的靈感與美感天賦', '感染力十足的語言與表達能力', '在任何情境中都能看見希望與樂趣'],
    healingMessage: '靈動的 3 號人，你的熱情就像一道陽光，能溫暖身邊所有人。當偶爾感到靈感枯竭或內心脆弱時，不必勉強維持開心微笑；給自己安靜沉澱的空間，你的真實就是最大的光芒。',
    careerGifts: '文字創作者、表演藝術、廣告行銷、主持演說、品牌視覺設計',
    color: '#ffd600',
  },
  4: {
    number: 4,
    title: '4 號人・穩健築基踏實守護者',
    archetype: '建構安全感的堅定基石',
    keywords: ['務實', '秩序', '承諾', '專注', '可靠'],
    strengths: ['無懈可擊的邏輯架構與組織力', '言出必行、值得百分之百信賴', '能將抽象理念落地為具體可行的系統'],
    healingMessage: '踏實的 4 號人，你為身邊的人建構了無比安全的天地。但生命的美好往往藏在計劃之外的驚喜中；試著放下對完美的掌控，放鬆深呼吸，宇宙會穩穩接住每一刻真實的你。',
    careerGifts: '架構工程師、財務管理、法務規劃、營運管理、專案監造師',
    color: '#4caf50',
  },
  5: {
    number: 5,
    title: '5 號人・自由探索冒險先鋒',
    archetype: '熱愛自由的跨界旅人',
    keywords: ['自由', '適應', '冒險', '好奇', '無拘'],
    strengths: ['極強環境適應力與危機應變力', '敢於打破框架挑戰未知的勇氣', '對多元文化與跨領域知識充滿好奇'],
    healingMessage: '自在的 5 號人，世界是你的遊樂場。自由並非沒有拘束，而是擁有自主選擇並承擔的力量；在奔赴下一個山海之前，先在心靈中錨定一個家，你的冒險將更有深度與力量。',
    careerGifts: '國際貿易、旅行探險家、跨領域講師、自媒體創作者、自由接案者',
    color: '#00e5ff',
  },
  6: {
    number: 6,
    title: '6 號人・慈愛療癒靈性守護者',
    archetype: '撫慰心靈的溫暖療癒師',
    keywords: ['關懷', '同理', '美感', '責任', '奉獻'],
    strengths: ['天生具備溫暖人心的撫慰力量', '敏銳的品味與和諧美感', '深厚的家庭價值與責任擔當感'],
    healingMessage: '慈愛的 6 號人，你對世界的愛如此純粹深厚。但記得，你無法背負所有人的命運與功課；尊重他人的生命歷程，把自己放在愛的第一位，你的付出才不會化為心靈的重擔。',
    careerGifts: '醫護身心療癒、教育育兒、室內設計、美學藝術、非營利慈善志業',
    color: '#2979ff',
  },
  7: {
    number: 7,
    title: '7 號人・智慧洞察真理哲思者',
    archetype: '探究宇宙本質的智者',
    keywords: ['洞察', '哲理', '真理', '直覺', '分析'],
    strengths: ['穿透表面看見本質的深刻智慧', '嚴謹的邏輯思辨與直覺連結', '喜愛深層精神修煉與知識探索'],
    healingMessage: '深邃的 7 號人，你的心智是一座深海，藏著許多人未曾見過的珍珠。別讓過度的理性懷疑築起孤獨的高牆；把智慧轉化為對人間的溫柔，在連結中你會找到最深刻的平靜。',
    careerGifts: '哲學研究、數據分析師、玄學命理師、科學家、策略顧問',
    color: '#651fff',
  },
  8: {
    number: 8,
    title: '8 號人・宏觀豐盛實踐大師',
    archetype: '顯化豐盛的實踐格局者',
    keywords: ['豐盛', '魄力', '格局', '整合', '影響'],
    strengths: ['敏銳的商業眼光與資源整合力', '強大的心理素質與抗壓韌性', '將崇高願景轉化為豐碩果實的實踐魄力'],
    healingMessage: '宏大的 8 號人，你擁有轉化物質與精神世界的巨大能量。真正的豐盛是內心的富足與分享；當你帶著利他與慈悲的心運用力量，財富與成就將會以最豐盛的姿態自然流向你。',
    careerGifts: '企業領袖、金融投資、大型組織決策者、實業家、慈善基金會主持',
    color: '#ff6d00',
  },
  9: {
    number: 9,
    title: '9 號人・慈悲博愛靈性夢想家',
    archetype: '啟發世界的靈性燈塔',
    keywords: ['博愛', '慈悲', '大格局', '啟發', '超越'],
    strengths: ['跨越族群與界限的宏大慈悲心', '天生具備超然的靈性悟性', '善於激勵他人並傳遞崇高理想'],
    healingMessage: '純淨的 9 號人，你是靈魂輪迴的集大成者，懷抱著對世界的深深善意。學會放下過去的執念與沉重，允許不完美存在；你只需安然做這世間的一道光，世界便已因你而更美麗。',
    careerGifts: '心靈導師、公益組織領袖、文化傳播者、環保生態家、跨國人道救援',
    color: '#e040fb',
  },
}

/**
 * 九宮格位置定義（畢達哥拉斯標準 3x3 能量排列）
 */
export const NINE_GRID_META: { num: number; row: number; col: number; label: string }[] = [
  { num: 1, row: 0, col: 0, label: '領導・開拓' },
  { num: 2, row: 1, col: 0, label: '溝通・協調' },
  { num: 3, row: 2, col: 0, label: '創意・表達' },
  { num: 4, row: 0, col: 1, label: '穩健・安全' },
  { num: 5, row: 1, col: 1, label: '自由・探索' },
  { num: 6, row: 2, col: 1, label: '關懷・療癒' },
  { num: 7, row: 0, col: 2, label: '智慧・真理' },
  { num: 8, row: 1, col: 2, label: '豐盛・實踐' },
  { num: 9, row: 2, col: 2, label: '博愛・靈性' },
]

/**
 * 依西元生日計算生命靈數全套結果
 * @param dateStr "YYYY-MM-DD" 或 "YYYYMMDD"
 */
export function calculateNumerology(dateStr: string): NumerologyResult {
  if (typeof dateStr !== 'string' || dateStr.length > 32) {
    throw new Error('請輸入正確的西元出生年月日（格式 YYYY-MM-DD，共 8 碼數字）')
  }
  const clean = dateStr.replace(/\D/g, '')
  if (clean.length !== 8) {
    throw new Error('請輸入正確的西元出生年月日（格式 YYYY-MM-DD，共 8 碼數字）')
  }
  const year = Number(clean.slice(0, 4))
  const month = Number(clean.slice(4, 6))
  const day = Number(clean.slice(6, 8))
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (
    year < 1800 || year > 2200 ||
    month < 1 || month > 12 ||
    day < 1 || day > 31 ||
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new Error('請輸入有效的西元出生日期（例如 1996-08-22）')
  }

  const birthDigits = clean.split('').map(Number)
  const sum1 = birthDigits.reduce((acc, d) => acc + d, 0)

  // 計算第二階段總和 (天賦數來源)
  const sum1Digits = String(sum1).split('').map(Number)
  const sum2 = sum1Digits.reduce((acc, d) => acc + d, 0)

  let lifePath = sum2
  let sum3: number | undefined
  if (sum2 > 9) {
    const sum2Digits = String(sum2).split('').map(Number)
    sum3 = sum2Digits.reduce((acc, d) => acc + d, 0)
    lifePath = sum3
  }

  // 天賦數提取（第一階段兩位數 + 第二階段若為兩位數）
  const talentNumbers: number[] = [...sum1Digits]
  if (sum2 > 9) {
    talentNumbers.push(...String(sum2).split('').map(Number))
  }

  // 算式字串
  const step1Str = birthDigits.join('+') + ' = ' + sum1
  const step2Str = sum1Digits.join('+') + ' = ' + sum2
  let formula = `${step1Str} → ${step2Str}`
  if (sum3 !== undefined) {
    formula += ` → ${String(sum2).split('').join('+')} = ${sum3}`
  }

  // 統計生日數字九宮格
  const birthdayCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 }
  for (const d of birthDigits) {
    if (d >= 1 && d <= 9) birthdayCounts[d] += 1
  }

  // 統計總能量九宮格（含生日數字 + 天賦數 + 主命數）
  const gridCounts: Record<number, number> = { ...birthdayCounts }
  for (const t of talentNumbers) {
    if (t >= 1 && t <= 9) gridCounts[t] += 1
  }
  if (lifePath >= 1 && lifePath <= 9) {
    gridCounts[lifePath] += 1
  }

  const profile = LIFE_PATH_PROFILES[lifePath] ?? LIFE_PATH_PROFILES[1]

  const formattedDate = `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`

  return {
    birthDate: formattedDate,
    birthDigits,
    sum1,
    sum2,
    sum3,
    lifePathNumber: lifePath,
    talentNumbers: Array.from(new Set(talentNumbers)),
    formula,
    gridCounts,
    birthdayCounts,
    profile,
  }
}
