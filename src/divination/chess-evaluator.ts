import type { CrossGuaResult, CrossSlot, GuaLevel } from './chess-types'
import { getPieceAspectText } from './chess-dictionary'

export function evaluateCrossGua(slots: Record<string, CrossSlot>): CrossGuaResult {
  const centerSlot = slots.center
  const topSlot = slots.top
  const bottomSlot = slots.bottom
  const leftSlot = slots.left
  const rightSlot = slots.right

  const allPieces = [centerSlot.piece, topSlot.piece, bottomSlot.piece, leftSlot.piece, rightSlot.piece]
  const redCount = allPieces.filter(p => p.color === 'red').length
  const blackCount = allPieces.length - redCount

  const centerPiece = centerSlot.piece

  // 檢查特殊格局
  let patternName = ''
  let level: GuaLevel = '吉'
  let summary = ''
  let advice = ''

  const names = allPieces.map(p => p.name)
  const hasShuai = names.includes('帥')
  const hasJiang = names.includes('將')
  const cheCount = names.filter(n => n === '俥' || n === '車').length
  const maCount = names.filter(n => n === '傌' || n === '馬').length
  const paoCount = names.filter(n => n === '炮' || n === '包').length
  const bingCount = names.filter(n => n === '兵' || n === '卒').length

  if (hasShuai && hasJiang) {
    patternName = '將帥相逢・風雲際會'
    level = '大吉'
    summary = '棋盤至尊齊聚，陰陽相濟、乾坤定位。所謀之事格局弘大，能遇旗鼓相當之強大貴人或關鍵轉機。'
    advice = '此卦宜開展大計，凡事胸襟宜寬大包容，以大局為念，切忌為微小利益相爭。'
  } else if (cheCount >= 2) {
    patternName = '雙車縱橫・破陣開局'
    level = '大吉'
    summary = '雙車並馳，長驅直入。代表行動力與突破力處於頂峰，一切阻力皆能迎刃而解。'
    advice = '目標明確即刻放手一搏，把握當前黃金衝刺期，乘勝追擊。'
  } else if (paoCount >= 2) {
    patternName = '雙炮轟鳴・聲名遠播'
    level = '吉'
    summary = '雙炮相呼，聲勢浩大。所求之事利於名聲傳播、宣傳行銷或借助外在平台打響名氣。'
    advice = '注重人際樞紐與宣傳通路，言行謹慎保持誠信，善用媒體與外力槓桿。'
  } else if (maCount >= 2) {
    patternName = '萬馬奔騰・另闢蹊徑'
    level = '吉'
    summary = '八面受敵亦能跳脫重圍，善於在變局中尋找生機，轉角便有柳暗花明。'
    advice = '不拘泥於舊思維，大膽嘗試跨界合作或新做法，靈活調整應對策略。'
  } else if (bingCount >= 3) {
    patternName = '群兵列陣・積厚流光'
    level = '平'
    summary = '卒兵過河步步為營，看似緩慢卻底氣堅實。所求之事需以恆心毅力慢慢推進。'
    advice = '切勿妄想一步登天，專注於每天的細節累積與踏實付出，時間必予回報。'
  } else if (redCount === 5) {
    patternName = '五曜純陽・光明普照'
    level = '大吉'
    summary = '五子皆紅，至陽之象。貴人多助、事業暢通，陰霾消散、萬象更新。'
    advice = '吉星高照之時當惜福感恩，廣結善緣多行善事，運勢方能長久綿延。'
  } else if (blackCount === 5) {
    patternName = '玄武鎮守・厚德載物'
    level = '守中'
    summary = '五子皆黑，至陰蓄力之象。防禦周全、沉穩如山，利於內部修持、鞏固基礎與保守經營。'
    advice = '此時宜守不宜動，深耕實力、韜光養晦，待春雷震動方顯威力。'
  } else if (centerPiece.rank >= 6) {
    patternName = `中宮坐${centerPiece.name}・威震四方`
    level = '吉'
    summary = `核心得【${centerPiece.name}】坐鎮，自身能力強悍、主動權在握，居中調度有條不紊。`
    advice = '堅定自我立場，勇於承擔決策責任，同理傾聽周遭夥伴意見。'
  } else {
    patternName = `四象拱衛・${centerPiece.name}定乾坤`
    level = redCount >= 3 ? '吉' : '平'
    summary = `以【${centerPiece.name}】為核心，四方星宿相護。局勢平穩之中蘊含生機，各司其職自然順遂。`
    advice = '保持平常心，穩健行事，順應外在環境變化而靈活調整節奏。'
  }

  const revealedCount = Object.values(slots).filter(s => s.revealed).length

  return {
    slots: slots as Record<string, CrossSlot>,
    revealedCount,
    allRevealed: revealedCount === 5,
    patternName,
    level,
    summary,
    advice,
    posInterpretations: {
      center: getPieceAspectText(centerSlot.piece, 'center'),
      top: getPieceAspectText(topSlot.piece, 'top'),
      bottom: getPieceAspectText(bottomSlot.piece, 'bottom'),
      left: getPieceAspectText(leftSlot.piece, 'left'),
      right: getPieceAspectText(rightSlot.piece, 'right'),
    },
  }
}
