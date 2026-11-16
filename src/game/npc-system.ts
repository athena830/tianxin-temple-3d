import * as THREE from 'three'
import { Chibi } from './chibi'

export type NpcDialogueSet = {
  idle: string[]
  worship: string[]
  approach: string[]
}

export type NpcConfig = {
  id: string
  name: string
  title: string
  palette: string
  startPos: THREE.Vector3
  startHeading: number
  homeZone: 'courtyard' | 'sanctuary' | 'wanderer'
  dialogues: NpcDialogueSet
}

export type LocationZone =
  | 'pavilion'      // 天心仙姑問事亭（問工作、事業、感情、婚姻、象棋卜卦）
  | 'guanyin'       // 觀音大殿（大慈大悲、求平安、甘露消災、闔家安康、點光明燈）
  | 'dragonGuanyin' // 昇龍觀音聖境大平台（五層樓高巨制、金龍騰雲、九龍香爐大願、震撼神蹟）
  | 'yuhuang'       // 凌霄寶殿（玉皇上帝、天官賜福、國泰民安、天恩浩蕩）
  | 'lotusPond'     // 盛景大蓮花池（滿池荷花、粉白仙蓮、太湖假山、賞蓮幽香）
  | 'wishPool'      // 蓮花許願池（投幣許願、心想事成、圓滿祈願）
  | 'goldFurnace'   // 八角金亭（焚化發財金壽金、添香油錢、生意興隆通四海）
  | 'courtyard'     // 廟埕中道與山門牌樓（進出宮門、門神威武、晨鐘暮鼓）

export type LocationDialogueSet = {
  worship: string[]
  idle: string[]
  approach: string[]
}

export const LOCATION_DIALOGUES: Record<LocationZone, LocationDialogueSet> = {
  pavilion: {
    worship: [
      '想請仙姑以象棋神卦指點，弟子這份新工作適不適合我。',
      '請問仙姑，弟子何時能遇到相知相惜的良緣正緣？',
      '最近事業經營遇到瓶頸，特來請教仙姑指引明路。',
      '弟子想轉職換跑道，求仙姑象棋占卜指點吉凶。',
      '請問仙姑，弟子與伴侶的感情能否修成正果、白頭偕老？',
      '弟子準備創業開店，特求仙姑指點迷津、趨吉避凶！',
      '求仙姑神卦開示，指點弟子未來半年的工作與前途運勢。',
      '弟子為兒女的事業與婚姻祈請仙姑指點解惑。',
    ],
    idle: [
      '聽說仙姑的象棋神卦極為靈驗，待會好好請示工作與前途。',
      '好多人都特地來問事亭排隊問姻緣，我也來請仙姑指點。',
      '近來心裡有些迷惘，來問事亭坐坐，聽聽仙姑智慧開示。',
      '象棋排盤深藏天地玄機，仙姑解卦真是一針見血！',
      '問世間情為何物，特來求仙姑指引一段好姻緣。',
    ],
    approach: [
      '您好！您也是來請天心仙姑問工作或感情的嗎？仙姑解惑很慈悲喔！',
      '嗨！天心仙姑的象棋神卦超神準的，推薦您也來抽籤卜卦問事！',
      '您好！前頭就是問事亭了，想問事業或姻緣都可以請教仙姑喔～',
    ],
  },
  guanyin: {
    worship: [
      '大慈大悲觀世音菩薩，祈求保佑一家老幼平安健康、福順吉祥。',
      '南無觀世音菩薩摩訶薩，祈賜甘露遍灑、消災解厄、諸事順遂。',
      '弟子誠心向大殿菩薩頂禮，祈願父母延年益壽、子孫孝悌安康。',
      '信士合掌虔敬禮拜，祈求大士慈悲護持，化解一切災難苦厄。',
      '在大殿佛前恭敬點上一盞光明燈，願心願成就、前途一片光明！',
      '祈求菩薩賜我智慧定力，於紛擾世間常行善念、心無掛礙。',
    ],
    idle: [
      '大殿中門完全敞開，一眼就能直視觀世音菩薩金身，太莊嚴慈悲了。',
      '殿前大門的秦叔寶與尉遲恭門神，手執鐧鞭好威風肅穆！',
      '主殿沉香繚繞，站在神龕前聞著清香，心裡說不出的踏實安寧。',
      '八角重疊藻井雕工真是出神入化，不愧是傳統大廟的大木作藝術！',
    ],
    approach: [
      '善信您好！歡迎進大殿參拜觀世音菩薩，心誠則靈，有拜有保庇！',
      '阿彌陀佛！大殿菩薩金身極為莊嚴慈祥，進去拜拜保平安喔！',
      '您好呀！大殿有提供平安符與光明燈，記得去拜拜求福喔！',
    ],
  },
  dragonGuanyin: {
    worship: [
      '仰望五層樓乘龍觀音聖像，神威赫赫，弟子誠心恭敬朝禮！',
      '在九龍青銅香爐前敬拜，祈願事業如飛龍在天、騰雲直上！',
      '乘金龍踏祥雲，大慈大悲觀音大士，保佑合境平安、消災賜福。',
      '誠心仰望昇龍觀音金身，祈求福氣滿載、鴻運當頭、心願圓滿！',
      '九龍青銅香爐青煙裊裊，祈求大威德神光護佑弟子轉運開泰。',
    ],
    idle: [
      '哇！這座昇龍觀音真的有五層樓高，金龍騰雲駕霧太震撼了！',
      '站在漢白玉八角大平台上仰望神像，立體威嚴感撲面而來！',
      '穿過那座【昇龍聖境】牌坊與松樹小徑走過來，真的像進了仙境！',
      '大平台四周的通天石燈台晝夜放光，襯托乘龍觀音更加神聖超凡。',
      '金龍身上的龍鱗刻得栩栩如生，浪花翻騰好有動態氣勢！',
    ],
    approach: [
      '你好！你有走到觀音像正前方仰望嗎？五層樓高的氣勢真的超壯觀！',
      '哈囉！這座漢白玉大平台的視野超棒，拍照起來仙氣十足！',
      '嗨！記得在九龍香爐前敬拜觀音大士，乘龍神威特別靈驗喔！',
    ],
  },
  yuhuang: {
    worship: [
      '朝拜玄穹高上玉皇大天尊，弟子恭敬叩首，沐浴九天浩蕩天恩！',
      '天公祖慈悲庇佑，祈求國泰民安、風調雨順、家宅興旺吉慶。',
      '後殿凌霄寶殿九龍金椅至尊至聖，祈願天官賜福、消災解難。',
      '至心皈命禮，玉皇大天尊玄穹高上帝，保佑全家老幼四季平順。',
    ],
    idle: [
      '後殿凌霄寶殿面寬進深好宏偉，八根天柱金龍盤繞氣宇軒昂！',
      '九龍至尊御座高懸八角藻井，整個大殿散發天宮神聖金光。',
      '從前殿過水廊穿過來就是凌霄寶殿，連通格局開闊大氣。',
    ],
    approach: [
      '善信您好！後殿是宏偉的凌霄寶殿，一定要去朝拜玉皇上帝天公祖喔！',
      '您好！玉皇大天尊至尊至聖，去大殿合掌叩首，能得九天福澤庇佑！',
    ],
  },
  lotusPond: {
    worship: [
      '滿池仙蓮映水開，弟子合掌感念天地造化之美，願心靈如蓮清淨。',
      '觀世音菩薩坐蓮台，池中仙蓮朵朵開，祈求心想事成、善緣常伴。',
    ],
    idle: [
      '東邊這座大蓮花池開得好繁盛！粉白蓮花隨風輕搖，太美了！',
      '池畔的太湖石假山與漢白玉欄杆，古色古香，好有皇家園林氣派！',
      '微風吹拂過水面，帶來陣陣清雅荷香，走在池邊把煩惱全忘光了。',
      '出淤泥而不染，濯清漣而不妖，這池仙蓮真有出塵靈氣！',
      '池水碧波如鏡，粉紅白玉荷花盛開，怎麼拍照都好看極了！',
    ],
    approach: [
      '您好呀！東側這座擴建後的大蓮花池超美的，一定要去池畔賞蓮喔！',
      '嗨！蓮花池邊微風好涼爽，聞聞荷香整個人精神都放鬆了呢！',
      '您好！池畔的漢白玉雕花欄杆跟太湖石超好拍，很推薦留念喔！',
    ],
  },
  wishPool: {
    worship: [
      '投一枚銅錢到許願池，願心中所求皆得圓滿成真！',
      '清泉泛起漣漪，撲通一聲，願望隨泉水直達天聽！',
      '誠心許願，祈求家人健康平安、事業順遂、吉星高照。',
    ],
    idle: [
      '許願池水好清澈，剛剛好多人投進硬幣許了好心願呢。',
      '池邊的金邊圓潤欄杆很漂亮，投個銅錢試試手氣與緣分！',
    ],
    approach: [
      '嗨！許願池很靈驗喔，身上有硬幣的話不妨投一枚許個願吧！',
      '您好！投幣許願心誠則靈，祝您的心願都能早日實現喔！',
    ],
  },
  goldFurnace: {
    worship: [
      '虔誠焚化一份五路發財金與祈安補運金，祈求生意興隆通四海！',
      '八角金亭爐火熊熊，象徵天心宮香火鼎盛、鴻圖大展！',
      '添點香油錢助造福田，祈願家宅安泰、四季進財、福星高照。',
    ],
    idle: [
      '八角金亭古色古香，八角重簷歇山頂配上寶頂金葫蘆真精美！',
      '爐口火光熊熊，香煙騰空，化紙祈福誠意滿滿。',
    ],
    approach: [
      '您好呀！今天金亭香火真旺，祝您萬事順利、大發利市！',
      '嗨！添香油化金紙祈求財運與平安，心誠則靈喔！',
    ],
  },
  courtyard: {
    worship: [
      '站在廟埕前庭仰望正殿，心懷敬仰，合掌祈求天地神明護佑。',
      '一炷清香敬天地，祈願風調雨順、國泰民安、善信和樂。',
    ],
    idle: [
      '穿過玉皇宮山門牌樓走進廟埕，撲鼻而來的沉香讓人心神寧靜。',
      '正殿大門秦叔寶與尉遲恭門神，手執金鐧鐵鞭好威風赫赫！',
      '前庭寬闊平整，晨鐘暮鼓聲聲迴盪，整座宮廟神聖又祥和。',
      '照壁上的紫氣東來福星高照，好有傳統福文化底蘊。',
    ],
    approach: [
      '善信您好！歡迎蒞臨天心宮，祝您今日平安順遂、法喜充滿！',
      '您好呀！今天宮廟好熱鬧，各殿都去走走拜拜，很有福氣喔！',
    ],
  },
}

export type TempleWaypoint = {
  name: string
  zone: 'courtyard' | 'sanctuary'
  pos: THREE.Vector3
  isWorship: boolean
  worshipTarget?: THREE.Vector3
}

export const TEMPLE_WAYPOINTS: TempleWaypoint[] = [
  // 1. 觀音大殿殿前（中門前）
  { name: '主殿大門', zone: 'courtyard', pos: new THREE.Vector3(0, 0, 1.2), isWorship: true, worshipTarget: new THREE.Vector3(0, 0, -6.0) },
  // 3. 觀音大殿龍邊前
  { name: '主殿龍邊', zone: 'courtyard', pos: new THREE.Vector3(4.5, 0, 1.2), isWorship: true, worshipTarget: new THREE.Vector3(4.5, 0, -4.5) },
  // 4. 觀音大殿虎邊前
  { name: '主殿虎邊', zone: 'courtyard', pos: new THREE.Vector3(-4.5, 0, 1.2), isWorship: true, worshipTarget: new THREE.Vector3(-4.5, 0, -4.5) },
  // 5. 蓮花許願池
  { name: '許願池', zone: 'courtyard', pos: new THREE.Vector3(-5.8, 0, 39.5), isWorship: true, worshipTarget: new THREE.Vector3(-9.5, 0, 39.5) },
  // 5b. 前庭東側盛景蓮花池
  { name: '盛景蓮花池', zone: 'courtyard', pos: new THREE.Vector3(5.6, 0, 38.0), isWorship: false },
  // 6. 八角金亭
  { name: '八角金亭', zone: 'courtyard', pos: new THREE.Vector3(-16.0, 0, 38.0), isWorship: true, worshipTarget: new THREE.Vector3(-19.5, 0, 38.0) },
  // 7. 天心仙姑問事亭
  { name: '問事亭', zone: 'courtyard', pos: new THREE.Vector3(-9.8, 0, 29.5), isWorship: true, worshipTarget: new THREE.Vector3(-12.0, 0, 30.0) },
  // 8. 前庭中軸石道
  { name: '前庭中道', zone: 'courtyard', pos: new THREE.Vector3(0, 0, 22.0), isWorship: false },
  // 9. 牌樓內庭廣場
  { name: '牌樓前庭', zone: 'courtyard', pos: new THREE.Vector3(0, 0, 44.0), isWorship: false },
  // 10. 西側昇龍聖境牌坊門內
  { name: '聖境牌坊東側', zone: 'courtyard', pos: new THREE.Vector3(-24.0, 0, 31.0), isWorship: false },
  // 11. 昇龍觀音青銅香爐（大平台參拜點）
  { name: '昇龍觀音香爐', zone: 'sanctuary', pos: new THREE.Vector3(-62.5, 0.545, 31.0), isWorship: true, worshipTarget: new THREE.Vector3(-68.0, 0.545, 31.0) },
  // 12. 昇龍觀音大平台北側瞻仰點
  { name: '觀音大平台北側', zone: 'sanctuary', pos: new THREE.Vector3(-68.0, 0.545, 37.5), isWorship: true, worshipTarget: new THREE.Vector3(-68.0, 0.545, 31.0) },
  // 13. 昇龍觀音大平台南側瞻仰點
  { name: '觀音大平台南側', zone: 'sanctuary', pos: new THREE.Vector3(-68.0, 0.545, 24.5), isWorship: true, worshipTarget: new THREE.Vector3(-68.0, 0.545, 31.0) },
  // 14. 昇龍觀音大平台東門步道階梯
  { name: '大平台東門階梯', zone: 'sanctuary', pos: new THREE.Vector3(-55.5, 0.36, 31.0), isWorship: false },
  // 15. 後殿凌霄寶殿前
  { name: '凌霄寶殿前', zone: 'courtyard', pos: new THREE.Vector3(0, 0, -18.0), isWorship: true, worshipTarget: new THREE.Vector3(0, 0, -25.0) },
  // 16. 西側鐘鼓樓前
  { name: '鼓樓前廣場', zone: 'courtyard', pos: new THREE.Vector3(-16.0, 0, 18.0), isWorship: false },
  // 17. 東側漫步長廊
  { name: '東側長廊', zone: 'courtyard', pos: new THREE.Vector3(12.0, 0, 16.0), isWorship: false },
]

export const NPC_DEFINITIONS: NpcConfig[] = [
  // 1. 陳阿姨（虔誠信女）
  {
    id: 'chen-auntie',
    name: '陳阿姨',
    title: '虔誠信女',
    palette: 'lavender',
    startPos: new THREE.Vector3(4.5, 0, 26.5),
    startHeading: Math.PI * 0.8,
    homeZone: 'courtyard',
    dialogues: {
      idle: [
        '大殿香火真鼎盛，心裡好安寧。',
        '誠心向觀世音菩薩、玉皇上帝祈求，平安是福。',
        '滿池荷花朵朵盛開，幽香撲鼻，真是賞心悅目。',
        '門神秦叔寶跟尉遲恭畫得真威風！',
        '今天廟裡好熱鬧，神聖祥和。',
      ],
      worship: [
        '求玉皇上帝、觀世音菩薩保佑全家老幼平安順遂。',
        '信女誠心禮拜，願家宅安康、吉星高照。',
        '合掌虔誠，有拜有保庇。',
      ],
      approach: [
        '施主您好呀！也是趁早來參拜的嗎？',
        '心誠則靈，菩薩定會庇佑您的。',
      ],
    },
  },

  // 2. 小林（求籤青年）
  {
    id: 'youth-lin',
    name: '小林',
    title: '求籤青年',
    palette: 'scholar',
    startPos: new THREE.Vector3(-5.2, 0, 38.5),
    startHeading: -Math.PI * 0.5,
    homeZone: 'wanderer',
    dialogues: {
      idle: [
        '聽說天心宮的籤詩很靈驗，待會來抽一支。',
        '東邊這座大蓮花池開得好繁盛，粉白蓮花隨風輕搖，太美了！',
        '這條松樹步道走起來好舒服，有淡淡清香～',
        '五層樓高的昇龍觀音好雄偉，氣勢非凡！',
        '漫步在宮廟裡，心情整個放鬆了。',
      ],
      worship: [
        '求今日籤詩指點迷津，祈願學業事業順遂。',
        '投入一枚銅錢到許願池，願心想事成！',
        '仰望五層樓乘龍觀音大士，誠心祈求好運。',
      ],
      approach: [
        '嗨！這裡的松樹小徑好清涼，超推薦去走走！',
        '您好！今天天氣真好，拍起照來每處都漂亮。',
      ],
    },
  },

  // 3. 遊客小明（參拜遊客）
  {
    id: 'tourist-ming',
    name: '遊客小明',
    title: '參拜遊客',
    palette: 'vermillion',
    startPos: new THREE.Vector3(-64.5, 0, 27.5),
    startHeading: 0,
    homeZone: 'sanctuary',
    dialogues: {
      idle: [
        '哇！這座昇龍觀音真的有五層樓高，乘龍騰雲太帥了！',
        '穿過那道【昇龍聖境】牌坊，好像走進世外仙境。',
        '漢白玉大平台四周的通天石燈台好有古典美。',
        '抬頭仰望觀音菩薩，好有震撼立體感！',
      ],
      worship: [
        '虔心仰望昇龍觀音金身，祈求福氣滿滿、平安吉祥。',
        '觀音菩薩慈眉善目，乘金龍踏祥雲，神威赫赫！',
        '在九龍青銅香爐前敬拜，願諸事圓滿。',
      ],
      approach: [
        '你好！你有去大平台看那尊巨型昇龍觀音了嗎？超宏偉的！',
        '這座宮廟處處都是驚喜，視野好棒！',
      ],
    },
  },

  // 4. 張居士（宮廟義工）
  {
    id: 'volunteer-zhang',
    name: '張居士',
    title: '宮廟義工',
    palette: 'amber',
    startPos: new THREE.Vector3(0, 0, 16.0),
    startHeading: Math.PI,
    homeZone: 'courtyard',
    dialogues: {
      idle: [
        '香火裊裊，天公祖慈悲庇佑十方善信。',
        '後殿是宏偉的凌霄寶殿，也可以順道去朝拜玉皇上帝喔。',
        '西側宮牆新開闢了林蔭小徑，直通昇龍觀音聖境。',
        '晨鐘暮鼓，收攝心念，處處皆是修行好境。',
      ],
      worship: [
        '祈願國泰民安、風調雨順、善信皆獲福澤。',
        '虔敬禮拜三寶，福德無量，功德圓滿。',
        '朝拜玉皇大天尊，沐浴天恩浩蕩。',
      ],
      approach: [
        '善信您好！歡迎蒞臨天心宮，心誠則靈！',
        '阿彌陀佛！願您今日福慧增長、法喜充滿。',
      ],
    },
  },

  // 5. 林小姐（問事信女）
  {
    id: 'lady-lin',
    name: '林小姐',
    title: '問事信女',
    palette: 'peach',
    startPos: new THREE.Vector3(-10.2, 0, 28.5),
    startHeading: -Math.PI * 0.4,
    homeZone: 'courtyard',
    dialogues: {
      idle: [
        '天心仙姑的象棋卜卦好特別，等一下來問事指點。',
        '微風輕輕吹過，在廟裡漫步讓人忘掉所有煩惱。',
        '八角金爐看起來古色古香，雕工好精緻。',
        '點一盞平安燈，燈火長明，心願定能成就。',
      ],
      worship: [
        '恭請天心仙姑指點迷津，解惑化吉。',
        '虔敬向仙姑合掌敬拜，願善緣永續、吉祥如意。',
        '祈願家庭和睦、平安健康。',
      ],
      approach: [
        '您好！天心仙姑問事亭就在前面，可以去看看喔。',
        '您也是來問事求福的嗎？仙姑很親切呢～',
      ],
    },
  },

  // 6. 王伯伯（早晨散步耆老）
  {
    id: 'uncle-wang',
    name: '王伯伯',
    title: '晨運耆老',
    palette: 'pine',
    startPos: new THREE.Vector3(8.0, 0, 32.0),
    startHeading: -Math.PI * 0.3,
    homeZone: 'courtyard',
    dialogues: {
      idle: [
        '每天一早來廟埕走走聞聞檀香，整天神清氣爽！',
        '這大蓮花池的漢白玉圍欄刻得真好，有皇家園林的氣度。',
        '宮廟的松柏長得真青翠，空氣裡都是木質清香。',
      ],
      worship: [
        '敬拜玉皇上帝與觀音菩薩，保佑子孫孝順、四季平安。',
        '年歲大了，身體硬朗無災無難就是最大的福氣。',
        '虔心頂禮，祈願天下太平。',
      ],
      approach: [
        '年輕人早呀！年輕就懂得來廟裡走走，很有福氣喔！',
        '多走動對身體好，這裡磁場特別祥和。',
      ],
    },
  },

  // 7. 李媽媽（祈安善信）
  {
    id: 'mama-lee',
    name: '李媽媽',
    title: '祈安善信',
    palette: 'rose',
    startPos: new THREE.Vector3(-3.5, 0, 10.0),
    startHeading: 0,
    homeZone: 'courtyard',
    dialogues: {
      idle: [
        '孩子在異鄉打拼，做媽媽的常來為他們點盞平安燈。',
        '主殿大門完全敞開，一眼就能看到菩薩金身，真莊嚴。',
        '聞到裊裊清香，心裡的牽掛都放下了。',
      ],
      worship: [
        '大慈大悲觀世音菩薩，保佑孩子出入平安、貴人相助。',
        '祈願閤家平安、無災無難，弟子叩謝神恩。',
        '願菩薩甘露遍灑，消災解厄、吉祥如意。',
      ],
      approach: [
        '您好呀！這裡的平安符很靈驗，待會記得求一個帶在身上喔。',
        '心誠則靈，有神明護佑，做什麼都順利的！',
      ],
    },
  },

  // 8. 阿凱（廟宇攝影師）
  {
    id: 'photographer-kai',
    name: '阿凱',
    title: '廟宇攝影師',
    palette: 'indigo',
    startPos: new THREE.Vector3(14.0, 0, 35.0),
    startHeading: Math.PI * 0.7,
    homeZone: 'wanderer',
    dialogues: {
      idle: [
        '陽光灑在擴建後的大蓮花池上，粉紅白蓮倒影美極了！',
        '這座宮廟的三川殿與歇山琉璃頂，線條構圖太棒了。',
        '西側昇龍觀音的立體視角震撼感，取景怎麼拍怎麼神聖！',
      ],
      worship: [
        '頂禮觀音菩薩，願用鏡頭記錄宮廟莊嚴與信仰之美。',
        '感謝神明護佑，願靈感源源不絕。',
        '祈願文化永續傳承，信徒常懷善念。',
      ],
      approach: [
        '哈囉！蓮花池那邊角度超好拍，光線很漂亮喔！',
        '今天雲彩很美，適合多拍幾張留念！',
      ],
    },
  },

  // 9. 婷婷（大考祈願生）
  {
    id: 'student-ting',
    name: '婷婷',
    title: '大考祈願生',
    palette: 'moon',
    startPos: new THREE.Vector3(2.0, 0, 4.0),
    startHeading: Math.PI * 0.9,
    homeZone: 'courtyard',
    dialogues: {
      idle: [
        '快要考試了，心情有點緊張，特地來拜拜求定心。',
        '在正殿前深呼吸幾口，感覺心情平靜多了。',
        '等一下去許願池許個金榜題名的心願！',
      ],
      worship: [
        '求玉皇上帝、文昌帝君賜我聰明智慧、考試順利！',
        '信女誠心祈求，願考試臨場不亂、題題發揮實力。',
        '保佑我考上理想志願，定來備香花還願！',
      ],
      approach: [
        '您好！您也是來求好運的嗎？一起加油喔！',
        '這裡好安靜，讓人可以沉澱思緒呢。',
      ],
    },
  },

  // 10. 趙老闆（還願商人）
  {
    id: 'boss-chao',
    name: '趙老闆',
    title: '還願商人',
    palette: 'gold',
    startPos: new THREE.Vector3(-14.0, 0, 36.0),
    startHeading: -Math.PI * 0.6,
    homeZone: 'courtyard',
    dialogues: {
      idle: [
        '今年公司業績順暢，全靠神明暗中相助與庇佑。',
        '八角金爐爐火熊熊，象徵生意興隆通四海。',
        '做生意講究誠信，拜神明更要誠心感恩。',
      ],
      worship: [
        '弟子特備香油金帛前來還願，叩謝玉皇上帝、觀世音菩薩大恩。',
        '祈願來年開源節流、員工平安、生意興隆通四海！',
        '財源廣進、福澤綿長，感謝神明護佑。',
      ],
      approach: [
        '老闆您好！大家發財、事業大展鴻圖啊！',
        '有拜有保庇，心正則財發，祝您萬事亨通！',
      ],
    },
  },

  // 11. 宏伯（廟祝副執事）
  {
    id: 'elder-hong',
    name: '宏伯',
    title: '廟祝執事',
    palette: 'terracotta',
    startPos: new THREE.Vector3(3.2, 0, 8.0),
    startHeading: -Math.PI * 0.8,
    homeZone: 'courtyard',
    dialogues: {
      idle: [
        '敬奉神明，最重心中一念至誠。',
        '晨鐘暮鼓，宮廟鐘聲能洗滌世人塵勞雜念。',
        '正殿觀音大士千處祈求千處應，苦海常作度人舟。',
      ],
      worship: [
        '頂禮三寶玉皇天尊，祈願風調雨順、社稷安寧。',
        '願今日蒞廟參拜善信皆蒙護佑、災厄化為吉祥。',
        '一心虔敬，香煙達九天。',
      ],
      approach: [
        '善信大德您好！請進殿參拜，隨喜添香油。',
        '若需指點神殿參拜禮儀，老朽隨時為您效勞。',
      ],
    },
  },

  // 12. 香燈腳阿偉（環島朝聖者）
  {
    id: 'pilgrim-wei',
    name: '香燈腳阿偉',
    title: '環島朝聖者',
    palette: 'ochre',
    startPos: new THREE.Vector3(-18.0, 0, 42.0),
    startHeading: Math.PI * 0.2,
    homeZone: 'wanderer',
    dialogues: {
      idle: [
        '徒步環島參拜各大名剎，天心宮的氣場真的特別清淨神聖。',
        '一步一腳印，走在青石路上，內心好踏實。',
        '這條通往昇龍觀音的松林小徑，走起來身心暢快！',
      ],
      worship: [
        '信士阿偉誠心朝禮，祈求行腳路上步步平安。',
        '感謝眾神明護持，願一切有情眾生遠離苦難。',
        '祈求合境平安，人人安居樂業。',
      ],
      approach: [
        '嗨！平安！一起走一段路吧，行善走正道最自在！',
        '您好！天心宮的松樹步道一定要去走，超棒的！',
      ],
    },
  },

  // 13. 孫婆婆（還願老信徒）
  {
    id: 'grandma-sun',
    name: '孫婆婆',
    title: '還願老信徒',
    palette: 'plum',
    startPos: new THREE.Vector3(-6.0, 0, 18.0),
    startHeading: Math.PI * 0.5,
    homeZone: 'courtyard',
    dialogues: {
      idle: [
        '我從小就在這座廟拜到大，菩薩最照顧我們老百姓了。',
        '看看這新修的大蓮花池，開滿粉粉白白的荷花，真好啊。',
        '心中有佛，處處皆是吉祥地。',
      ],
      worship: [
        '叩謝觀世音菩薩大慈大悲，保佑孫兒健康長大、成家立業。',
        '老身誠心叩首，願家家平安、鄰里和睦。',
        '千叩首、萬叩首，感謝神恩浩蕩。',
      ],
      approach: [
        '乖孩子好呀！常來拜拜菩薩會保佑你平安順遂喔。',
        '慢慢走、心平氣和，神明最喜歡善良的孩子。',
      ],
    },
  },

  // 14. 陳大哥（添油祈福者）
  {
    id: 'brother-chen',
    name: '陳大哥',
    title: '添油祈福者',
    palette: 'jade',
    startPos: new THREE.Vector3(7.5, 0, 20.0),
    startHeading: -Math.PI * 0.4,
    homeZone: 'courtyard',
    dialogues: {
      idle: [
        '今天休假特地載全家人來拜拜，空氣真好。',
        '添點香油錢維護廟宇道場，功德一件。',
        '這大殿門神秦叔寶跟尉遲恭，威嚴又莊重。',
      ],
      worship: [
        '祈求觀音菩薩保佑一家大小平安健康、工作順遂。',
        '弟子信誠禮拜，祈願災消吉至、四季發財。',
        '合掌向玉皇大帝請安，祈賜合家吉祥。',
      ],
      approach: [
        '兄弟您好呀！假日帶家人來走走拜拜，真的很舒服！',
        '祝您今天事事順心如意！',
      ],
    },
  },

  // 15. 劉老師（文史訪客）
  {
    id: 'teacher-liu',
    name: '劉老師',
    title: '文史訪客',
    palette: 'charcoal',
    startPos: new THREE.Vector3(-12.0, 0, 15.0),
    startHeading: Math.PI * 0.3,
    homeZone: 'wanderer',
    dialogues: {
      idle: [
        '這座正殿採八角重疊藻井與三踩斗栱大木作，極具建築美學！',
        '影壁上的紫氣東來雕刻，正是傳統道教祥瑞精髓。',
        '宮殿融合了閩南紅磚與北式歇山琉璃頂，非常珍貴。',
      ],
      worship: [
        '致敬天地神明，願傳統民俗文化代代綿延流傳。',
        '虔心禮敬先賢智慧與神明威靈。',
        '祈願文運昌隆、世道清明。',
      ],
      approach: [
        '您好！這座宮廟的大木作榫卯結構相當講究，值得細細欣賞！',
        '您也是對古建築感興趣的同好嗎？幸會幸會！',
      ],
    },
  },

  // 16. 小涵（祈緣少女）
  {
    id: 'girl-han',
    name: '小涵',
    title: '祈緣少女',
    palette: 'peach',
    startPos: new THREE.Vector3(-7.5, 0, 36.0),
    startHeading: -Math.PI * 0.7,
    homeZone: 'courtyard',
    dialogues: {
      idle: [
        '許願池的水好清澈，剛剛投進一枚硬幣許了願望～',
        '這座荷花池好浪漫，粉紅色的花朵好像仙女的裙擺！',
        '在廟裡走一圈，整個人元氣滿滿！',
      ],
      worship: [
        '祈求菩薩賜我善緣，遇見正直善良、相知相惜的良緣！',
        '願身邊每個人都幸福美滿、開開心心。',
        '信女誠心祈禱，願心願成真！',
      ],
      approach: [
        '嗨～您好呀！你有去蓮花池看花嗎？超漂亮的！',
        '祝你今天也有好心情、好運氣喔！',
      ],
    },
  },

  // 17. 孝順女兒小佳（代親祈福）
  {
    id: 'daughter-chia',
    name: '小佳',
    title: '代親祈福',
    palette: 'azure',
    startPos: new THREE.Vector3(1.5, 0, 12.0),
    startHeading: Math.PI,
    homeZone: 'courtyard',
    dialogues: {
      idle: [
        '媽媽最近常常膝蓋疼，今天特地來替她老人家拜拜求安康。',
        '點一盞藥師光明燈，燈光映在心裡好溫暖。',
        '但願雙親福壽綿長，為人子女最大的心願就是長輩安康。',
      ],
      worship: [
        '大慈大悲觀世音菩薩，弟子為父母祈福，求賜長輩身體安康、無病無痛！',
        '願神光普照，消災延壽，弟子願廣行善事以報親恩。',
        '祈求玉皇上帝慈悲護佑，二老平安喜樂。',
      ],
      approach: [
        '您好呀！天心宮的神明真的很慈悲，有心願誠心祈求一定能感應。',
        '祝您與家人都平平安安、健健康康！',
      ],
    },
  },

  // 18. 約翰 John（文化體驗客）
  {
    id: 'tourist-john',
    name: '約翰 John',
    title: '文化體驗客',
    palette: 'silver',
    startPos: new THREE.Vector3(-66.0, 0, 33.0),
    startHeading: Math.PI * 0.5,
    homeZone: 'sanctuary',
    dialogues: {
      idle: [
        'This 5-story Dragon Guanyin is breathtaking and impressive!',
        'The architecture and incense smell make me feel so peaceful.',
        '這座台灣傳統宮廟太神奇、太壯麗了！',
      ],
      worship: [
        'Respectfully paying tribute to the sacred Guanyin Bodhisattva.',
        'Praying for world peace, health, and harmony for all mankind.',
        '虔誠向乘龍觀音合掌，感受莊嚴神聖氣場。',
      ],
      approach: [
        'Hello! The giant golden dragon statue is so magnificent, right?',
        '你好！I love this temple culture very much, so beautiful!',
      ],
    },
  },

  // 19. 周居士（早課行者）
  {
    id: 'practitioner-chou',
    name: '周居士',
    title: '早課行者',
    palette: 'teal',
    startPos: new THREE.Vector3(-14.0, 0, 22.0),
    startHeading: Math.PI * 0.4,
    homeZone: 'wanderer',
    dialogues: {
      idle: [
        '清晨隨眾誦經早課，木魚鐘磬聲聲入心。',
        '萬緣放下，一心向道，處處皆是清涼蓮華國。',
        '漫步前庭，心境如這廣闊石道般坦然清澄。',
      ],
      worship: [
        '稽首皈依蘇悉帝，頂禮觀世音菩薩摩訶薩。',
        '願消三障諸煩惱，願得智慧真明了。',
        '普願罪障悉消除，世世常行菩薩道。',
      ],
      approach: [
        '居士阿彌陀佛！願您身心康泰、智慧光明。',
        '善念一啟，福德無量，祝您福慧雙修。',
      ],
    },
  },

  // 20. 蔡阿婆（虔誠壽星）
  {
    id: 'grandma-tsai',
    name: '蔡阿婆',
    title: '虔誠壽星',
    palette: 'crimson',
    startPos: new THREE.Vector3(0, 0, 2.5),
    startHeading: Math.PI,
    homeZone: 'courtyard',
    dialogues: {
      idle: [
        '今天老身滿七十大壽，特地來給天公祖、觀音菩薩請安祝壽！',
        '看到廟裡這麼熱鬧祥和，心裡真是高興呀。',
        '一輩子敬天拜神，子孝孫賢，心滿意足囉。',
      ],
      worship: [
        '弟子蔡氏感恩玉皇上帝、觀世音菩薩賜福，保佑全家老幼吉祥！',
        '願神明繼續看顧子孫出入平安、事業成家順順遂遂。',
        '信女誠心感恩神恩，叩謝恩澤！',
      ],
      approach: [
        '年輕人好啊！今天阿婆生日來拜拜，分你一點壽氣跟福氣喔！',
        '平安就是福，看到年輕人來廟裡拜拜，心裡真歡喜！',
      ],
    },
  },
]

/**
 * 2.5D 精緻對話泡泡文字（Speech Bubble Billboard）
 * 100% 在世界空間運作，永遠平行垂直面向玩家螢幕視角，徹底根除傾斜與透視失真！
 * 配備 1024x440 2x Retina 級解析度、純白底色、粗金彩邊框與大字號純黑清晰排版。
 */
export class NpcSpeechBubble {
  readonly mesh: THREE.Mesh
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly texture: THREE.CanvasTexture
  private timer = 0
  private currentScale = 0
  private targetScale = 0

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = 1024
    this.canvas.height = 440
    this.ctx = this.canvas.getContext('2d')!
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.generateMipmaps = true
    this.texture.minFilter = THREE.LinearMipmapLinearFilter
    this.texture.magFilter = THREE.LinearFilter

    const mat = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    // 3.3m x 1.42m 平面，大氣清晰，正常相機遠距下一目了然
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 1.42), mat)
    this.mesh.scale.set(0, 0, 0)
    this.mesh.visible = false
  }

  show(speaker: string, text: string, duration = 5.2): void {
    this.timer = duration
    this.targetScale = 1.0
    this.mesh.visible = true
    this.renderCanvas(speaker, text)
  }

  hide(): void {
    this.timer = 0
    this.targetScale = 0
  }

  private renderCanvas(speaker: string, text: string): void {
    const ctx = this.ctx
    ctx.clearRect(0, 0, 1024, 440)

    const x = 30
    const y = 24
    const w = 964
    const h = 310
    const r = 36
    const tailX = 512
    const tailY = 415

    // 1. 柔和深色陰影
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
    ctx.shadowBlur = 20
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 8

    // 2. 圓角對話框主體與向下的倒三角箭頭
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(tailX + 36, y + h)
    ctx.lineTo(tailX, tailY)
    ctx.lineTo(tailX - 36, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()

    // 純白明亮底色（高對比度，徹底擺脫背景遮擋與灰暗感）
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.restore()

    // 3. 粗黑/金色彩邊框 (極致清晰)
    ctx.strokeStyle = '#c88f28'
    ctx.lineWidth = 7
    ctx.stroke()
    ctx.strokeStyle = '#fbf0cd'
    ctx.lineWidth = 2.5
    ctx.stroke()

    // 4. 發言人名牌徽章 (如 【 陳阿姨 】)
    ctx.fillStyle = '#a9281a'
    ctx.beginPath()
    ctx.roundRect(60, 45, 230, 56, 14)
    ctx.fill()
    ctx.strokeStyle = '#ffdf88'
    ctx.lineWidth = 2.5
    ctx.stroke()

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 30px "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(speaker, 175, 73)

    // 5. 說話對話內容（純黑粗體，極高對比，一眼看清）
    ctx.fillStyle = '#0a0503'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'

    if (text.length <= 13) {
      ctx.font = 'bold 46px "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif'
      ctx.fillText(text, 68, 205)
    } else {
      const splitIdx = Math.ceil(text.length / 2)
      const line1 = text.slice(0, splitIdx)
      const line2 = text.slice(splitIdx)
      ctx.font = 'bold 38px "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif'
      ctx.fillText(line1, 68, 168)
      ctx.fillText(line2, 68, 242)
    }

    this.texture.needsUpdate = true
  }

  update(worldPos: THREE.Vector3, dt: number, time: number, camera?: THREE.Camera): void {
    if (this.timer > 0) {
      this.timer -= dt
      if (this.timer <= 0) {
        this.targetScale = 0
      }
    }

    this.currentScale = THREE.MathUtils.damp(this.currentScale, this.targetScale, 10, dt)
    this.mesh.scale.setScalar(this.currentScale)

    if (this.currentScale > 0.005) {
      this.mesh.visible = true
      // 世界坐標懸浮於 NPC 頭頂上方 2.25 米處，平滑呼吸上下浮動
      this.mesh.position.set(worldPos.x, worldPos.y + 2.25 + Math.sin(time * 2.8) * 0.04, worldPos.z)
      // 在世界空間中直接拷貝攝影機四元數，100% 永遠垂直面向鏡頭，絕對無任何傾斜或透視失真！
      if (camera) {
        this.mesh.quaternion.copy(camera.quaternion)
      }
    } else {
      this.mesh.visible = false
    }
  }

  get isSpeaking(): boolean {
    return this.timer > 0 || this.currentScale > 0.1
  }
}

export type NpcLifecycle = 'dormant' | 'entering' | 'active' | 'leaving'

/**
 * 獨立 NPC 實例：擁有 Chibi 模型身軀、狀態機（閒逛、走動、合掌參拜）、尋路與頭頂對話泡泡。
 */
export class NpcInstance {
  readonly root = new THREE.Group()
  readonly chibi = new Chibi()
  readonly bubble = new NpcSpeechBubble()
  readonly config: NpcConfig

  onSpeak?: (speaker: string, text: string) => void

  lifecycle: NpcLifecycle = 'dormant'
  private visitTimeRemaining = 60.0
  private worshipsDone = 0

  private state: 'idle' | 'walk' | 'worship' = 'idle'
  private stateTimer = 2.0
  private pos = new THREE.Vector3()
  private heading = 0
  private targetHeading = 0
  private pathWaypoints: THREE.Vector3[] = []
  private currentWaypoint: TempleWaypoint | null = null
  private walkSpeed = 1.8
  private totalWorshipTime = 6.0
  private worshipSaid = false
  private speechCooldown = 5.0
  private approachCooldown = 8.0
  private lastPlayerPos = new THREE.Vector3()

  constructor(config: NpcConfig) {
    this.config = config
    this.pos.copy(config.startPos)
    this.heading = config.startHeading
    this.targetHeading = config.startHeading

    this.chibi.setPalette(config.palette)
    this.root.add(this.chibi.root)

    this.root.position.copy(this.pos)
    this.root.rotation.y = this.heading

    this.stateTimer = 2.0 + Math.random() * 4.0
    this.speechCooldown = 3.0 + Math.random() * 6.0
  }

  /**
   * 喚醒 NPC 登場：
   * 開局時少數香客已在殿前參拜；後續香客一律由山門牌樓外（z = 54.5）步行穿過宮門進場，
   * 絕不在廟埕地面憑空冒出！
   */
  spawn(startPos?: THREE.Vector3, heading = Math.PI, initialActive = false): void {
    if (startPos) {
      this.pos.copy(startPos)
    } else {
      const enterX = (Math.random() - 0.5) * 3.2
      this.pos.set(enterX, 0, 54.5)
    }
    this.heading = heading
    this.targetHeading = heading
    this.root.position.copy(this.pos)
    this.root.rotation.y = this.heading
    this.root.visible = true
    this.root.scale.set(1, 1, 1)

    this.worshipsDone = 0
    this.speechCooldown = 4.0 + Math.random() * 6.0
    this.approachCooldown = 6.0

    if (initialActive) {
      this.lifecycle = 'active'
      this.visitTimeRemaining = 45.0 + Math.random() * 55.0
      this.pathWaypoints = []
      this.currentWaypoint = null
      this.state = 'idle'
      this.stateTimer = 1.0 + Math.random() * 3.0
      this.pickNextDestination()
    } else {
      // 自山門牌樓外真實步入宮門
      this.lifecycle = 'entering'
      this.visitTimeRemaining = 60.0 + Math.random() * 60.0
      this.state = 'walk'
      this.walkSpeed = 1.5 + Math.random() * 0.3
      const enterX = this.pos.x
      this.pathWaypoints = [
        new THREE.Vector3(enterX * 0.7, 0, 49.5),
        new THREE.Vector3(enterX * 0.5, 0, 48.0),
        new THREE.Vector3(enterX * 0.5, 0, 44.0),
      ]
      this.currentWaypoint = null
    }
  }

  /**
   * 信眾完成參拜，動身步向山門牌樓出口離去
   */
  startLeaving(): void {
    if (this.lifecycle === 'leaving' || this.lifecycle === 'dormant') return
    this.lifecycle = 'leaving'
    const exitX = (Math.random() - 0.5) * 3.2
    const exitPos = new THREE.Vector3(exitX, 0, 54.5)
    this.pathWaypoints = this.planPath(this.pos, exitPos)
    this.state = 'walk'
    this.walkSpeed = 1.5 + Math.random() * 0.3
  }

  /**
   * 完全步出山門外後，功德圓滿隱退至後備庫
   */
  despawn(): void {
    this.lifecycle = 'dormant'
    this.root.visible = false
    this.bubble.hide()
    this.bubble.mesh.visible = false
    this.pathWaypoints = []
    this.currentWaypoint = null
  }

  /** 規劃導航路徑（包含自山門進出、跨區穿越西側月亮門牌坊，沿步道前行絕不穿牆） */
  private planPath(start: THREE.Vector3, dest: THREE.Vector3): THREE.Vector3[] {
    const isStartCourtyard = start.x > -28.0 && start.z <= 48.0
    const isDestCourtyard = dest.x > -28.0 && dest.z <= 48.0
    const isStartSanctuary = start.x < -54.0
    const isDestSanctuary = dest.x < -54.0
    const isDestExit = dest.z > 48.0

    // 1. 步向山門牌樓出口離開宮廟
    if (isDestExit) {
      if (isStartSanctuary) {
        return [
          new THREE.Vector3(-55.5, 0.36, 31.0),
          new THREE.Vector3(-53.5, 0.18, 31.0),
          new THREE.Vector3(-42.0, 0, 31.0),
          new THREE.Vector3(-29.6, 0, 31.0),
          new THREE.Vector3(-24.0, 0, 31.0),
          new THREE.Vector3(dest.x * 0.5, 0, 44.0),
          new THREE.Vector3(dest.x * 0.5, 0, 48.0),
          dest.clone(),
        ]
      }
      return [
        new THREE.Vector3(dest.x * 0.5, 0, 44.0),
        new THREE.Vector3(dest.x * 0.5, 0, 48.0),
        dest.clone(),
      ]
    }

    // 2. 自山門外進場
    if (start.z > 48.0) {
      const gateWaypoints = [
        new THREE.Vector3(start.x * 0.7, 0, 49.5),
        new THREE.Vector3(start.x * 0.5, 0, 48.0),
        new THREE.Vector3(start.x * 0.5, 0, 44.0),
      ]
      if (isDestSanctuary) {
        return [
          ...gateWaypoints,
          new THREE.Vector3(-24.0, 0, 31.0),
          new THREE.Vector3(-29.6, 0, 31.0),
          new THREE.Vector3(-42.0, 0, 31.0),
          new THREE.Vector3(-53.5, 0.18, 31.0),
          new THREE.Vector3(-55.5, 0.36, 31.0),
          dest.clone(),
        ]
      }
      return [...gateWaypoints, dest.clone()]
    }

    // 3. 同在前庭或同在聖境大平台，直接走直線
    if ((isStartCourtyard && isDestCourtyard) || (isStartSanctuary && isDestSanctuary)) {
      return [dest.clone()]
    }

    // 4. 前庭 -> 聖境大平台：循序經由月亮門與松林小徑登階上台
    if (isStartCourtyard && isDestSanctuary) {
      return [
        new THREE.Vector3(-24.0, 0, 31.0),
        new THREE.Vector3(-29.6, 0, 31.0),
        new THREE.Vector3(-42.0, 0, 31.0),
        new THREE.Vector3(-53.5, 0.18, 31.0),
        new THREE.Vector3(-55.5, 0.36, 31.0),
        dest.clone(),
      ]
    }

    // 5. 聖境大平台 -> 前庭：循序下階穿過小徑回到前庭
    if (isStartSanctuary && isDestCourtyard) {
      return [
        new THREE.Vector3(-55.5, 0.36, 31.0),
        new THREE.Vector3(-53.5, 0.18, 31.0),
        new THREE.Vector3(-42.0, 0, 31.0),
        new THREE.Vector3(-29.6, 0, 31.0),
        new THREE.Vector3(-24.0, 0, 31.0),
        dest.clone(),
      ]
    }

    return [dest.clone()]
  }

  private pickNextDestination(): void {
    let pool = TEMPLE_WAYPOINTS.slice()
    if (this.config.homeZone === 'courtyard') {
      if (Math.random() < 0.8) {
        pool = pool.filter(w => w.zone === 'courtyard')
      }
    } else if (this.config.homeZone === 'sanctuary') {
      if (Math.random() < 0.8) {
        pool = pool.filter(w => w.zone === 'sanctuary')
      }
    }

    // 排除當前離自身過近的點
    const candidates = pool.filter(w => this.pos.distanceTo(w.pos) > 3.0)
    if (candidates.length === 0) {
      this.stateTimer = 3.0
      return
    }

    const next = candidates[Math.floor(Math.random() * candidates.length)]
    this.currentWaypoint = next

    // 增加適度隨機偏移，防止 NPC 重疊聚集在同一點
    const targetPos = next.pos.clone()
    if (!next.isWorship) {
      targetPos.x += (Math.random() - 0.5) * 2.2
      targetPos.z += (Math.random() - 0.5) * 2.2
    } else {
      targetPos.x += (Math.random() - 0.5) * 1.4
    }

    this.pathWaypoints = this.planPath(this.pos, targetPos)
    this.walkSpeed = 1.5 + Math.random() * 0.4
    this.state = 'walk'
  }

  /**
   * 智慧判定當前身處之地點分區（問事亭、觀音殿、昇龍聖境、凌霄寶殿、蓮花池、金亭、許願池、前庭廟埕）
   */
  getLocationZone(): LocationZone {
    const pos = this.pos
    // 1. 西側昇龍聖境大平台（x < -48.0）
    if (pos.x < -48.0) {
      return 'dragonGuanyin'
    }
    // 2. 後殿凌霄寶殿（z < -10.0）
    if (pos.z < -10.0) {
      return 'yuhuang'
    }
    // 3. 天心仙姑問事亭（x ~ -12, z ~ 30）
    const distToPavilion = Math.hypot(pos.x - (-12.0), pos.z - 30.0)
    if (distToPavilion < 5.8) {
      return 'pavilion'
    }
    // 4. 盛景大蓮花池（x ~ 12.0, z ~ 38.0）
    const distToLotus = Math.hypot(pos.x - 12.0, pos.z - 38.0)
    if (distToLotus < 6.8) {
      return 'lotusPond'
    }
    // 5. 蓮花許願池（x ~ -9.5, z ~ 39.5）
    const distToWish = Math.hypot(pos.x - (-9.5), pos.z - 39.5)
    if (distToWish < 4.8) {
      return 'wishPool'
    }
    // 6. 八角金亭（x ~ -19.5, z ~ 38.0）
    const distToFurnace = Math.hypot(pos.x - (-19.5), pos.z - 38.0)
    if (distToFurnace < 5.2) {
      return 'goldFurnace'
    }
    // 7. 觀音大殿正殿（|x| < 8, z in [-10, 6]）
    if (Math.abs(pos.x) < 8.0 && pos.z >= -10.0 && pos.z <= 6.0) {
      return 'guanyin'
    }
    // 8. 廟埕中道、前庭廣場、牌樓
    return 'courtyard'
  }

  say(category: 'idle' | 'worship' | 'approach', force = false): void {
    if (this.lifecycle === 'dormant' || this.lifecycle === 'leaving') return
    if (!force && this.bubble.isSpeaking) return

    const zone = this.getLocationZone()
    const locSet = LOCATION_DIALOGUES[zone]
    const locLines = locSet ? locSet[category] : undefined
    const charLines = this.config.dialogues[category]

    let candidates: string[] = []
    if (locLines && locLines.length > 0) {
      // 85% 機率嚴格使用當前地點專屬台詞（問事亭問工作感情、觀音殿求平安甘露等），15% 融入個人身分台詞
      if (Math.random() < 0.85 || !charLines || charLines.length === 0) {
        candidates = locLines
      } else {
        candidates = charLines
      }
    } else if (charLines && charLines.length > 0) {
      candidates = charLines
    }

    if (candidates.length === 0) return
    const line = candidates[Math.floor(Math.random() * candidates.length)]
    this.bubble.show(this.config.name, line, 5.0)
    this.speechCooldown = 12.0 + Math.random() * 10.0

    // 若玩家在聽覺範圍內 (18 米內)，同步播報至螢幕底部高清晰字幕列
    if (this.pos.distanceTo(this.lastPlayerPos) <= 18.0) {
      this.onSpeak?.(this.config.name, line)
    }
  }

  update(dt: number, time: number, playerPos: THREE.Vector3, camera?: THREE.Camera): void {
    if (this.lifecycle === 'dormant') {
      return
    }

    // 香客在宮廟漫步參拜時效倒數，時間到自然動身步向山門出廟
    if (this.lifecycle === 'active') {
      this.visitTimeRemaining -= dt
      if (this.visitTimeRemaining <= 0 || this.worshipsDone >= 2) {
        this.startLeaving()
      }
    } else if (this.lifecycle === 'leaving') {
      // 走出山門牌樓外廣場（z >= 53.8），功德圓滿淡出休眠
      if (this.pos.z >= 53.8) {
        this.despawn()
        return
      }
    }

    this.lastPlayerPos.copy(playerPos)
    this.bubble.update(this.pos, dt, time, camera)

    if (this.speechCooldown > 0) this.speechCooldown -= dt
    if (this.approachCooldown > 0) this.approachCooldown -= dt

    // 1. 善信玩家靠近問候機制 (Proximity Interaction)
    const distToPlayer = this.pos.distanceTo(playerPos)
    if (distToPlayer < 3.2 && this.approachCooldown <= 0 && !this.bubble.isSpeaking && this.state !== 'worship' && this.lifecycle === 'active') {
      this.say('approach')
      this.approachCooldown = 22.0
    }

    // 2. 狀態機處理
    if (this.state === 'idle') {
      this.chibi.animate(dt, time, 0, false, 0)
      this.stateTimer -= dt

      if (this.speechCooldown <= 0 && Math.random() < 0.008 && this.lifecycle === 'active') {
        this.say('idle')
      }

      if (this.stateTimer <= 0) {
        if (this.lifecycle === 'leaving') {
          this.startLeaving()
        } else {
          this.pickNextDestination()
        }
      }
    } else if (this.state === 'walk') {
      if (this.pathWaypoints.length === 0) {
        if (this.lifecycle === 'entering') {
          // 已完全穿過山門牌樓步入前庭，正式成為活躍香客
          this.lifecycle = 'active'
          this.pickNextDestination()
          return
        }

        if (this.lifecycle === 'leaving') {
          if (this.pos.z >= 53.5) {
            this.despawn()
          } else {
            this.pathWaypoints = [new THREE.Vector3(this.pos.x, 0, 54.5)]
          }
          return
        }

        if (this.currentWaypoint?.isWorship) {
          this.state = 'worship'
          this.totalWorshipTime = 6.0 + Math.random() * 2.5
          this.stateTimer = this.totalWorshipTime
          this.worshipSaid = false
          if (this.currentWaypoint.worshipTarget) {
            const wt = this.currentWaypoint.worshipTarget
            this.targetHeading = Math.atan2(wt.x - this.pos.x, wt.z - this.pos.z)
          }
        } else {
          this.state = 'idle'
          this.stateTimer = 3.5 + Math.random() * 5.0
        }
        return
      }

      const target = this.pathWaypoints[0]
      const dx = target.x - this.pos.x
      const dz = target.z - this.pos.z
      const dist = Math.hypot(dx, dz)

      if (dist < 0.3) {
        this.pathWaypoints.shift()
      } else {
        const moveHeading = Math.atan2(dx, dz)
        this.heading = THREE.MathUtils.damp(this.heading, moveHeading, 9, dt)
        this.root.rotation.y = this.heading

        const step = Math.min(this.walkSpeed * dt, dist)
        this.pos.x += Math.sin(this.heading) * step
        this.pos.z += Math.cos(this.heading) * step
        this.root.position.copy(this.pos)

        this.chibi.animate(dt, time, this.walkSpeed, false, 0)
      }
    } else if (this.state === 'worship') {
      this.heading = THREE.MathUtils.damp(this.heading, this.targetHeading, 7, dt)
      this.root.rotation.y = this.heading

      this.stateTimer -= dt
      const k = 1 - Math.max(0, this.stateTimer / this.totalWorshipTime)
      this.chibi.animate(dt, time, 0, false, k)

      if (!this.worshipSaid && k > 0.12 && this.lifecycle === 'active') {
        this.worshipSaid = true
        this.say('worship', true)
      }

      if (this.stateTimer <= 0) {
        this.worshipsDone += 1
        this.state = 'idle'
        this.stateTimer = 3.0 + Math.random() * 4.0
      }
    }
  }
}

/**
 * NPC 總管理器：管理整個宮廟世界的 20 位信眾角色庫，
 * 維持每次同時在場約 5 到 8 人，全部嚴格由山門牌樓入口步行進出宮廟！
 */
export class NpcManager {
  readonly npcs: NpcInstance[] = []
  onSpeak?: (speaker: string, text: string) => void

  private spawnCooldown = 5.0
  private readonly TARGET_MIN = 5
  private readonly TARGET_MAX = 8

  constructor(private readonly scene: THREE.Scene) {
    // 1. 預先建立全部 20 位 NPC 實例與世界空間泡泡
    for (const def of NPC_DEFINITIONS) {
      const npc = new NpcInstance(def)
      npc.onSpeak = (speaker, text) => this.onSpeak?.(speaker, text)
      this.npcs.push(npc)
      this.scene.add(npc.root)
      this.scene.add(npc.bubble.mesh)
      npc.despawn()
    }

    // 2. 開局隨機挑選 6 位 NPC 預先就位在宮廟各神殿前參拜，其餘均由大門進出
    const shuffled = this.npcs.slice().sort(() => Math.random() - 0.5)
    const initialCount = 6
    for (let i = 0; i < initialCount; i += 1) {
      const npc = shuffled[i]
      const wp = TEMPLE_WAYPOINTS[i % TEMPLE_WAYPOINTS.length]
      const startP = wp.pos.clone()
      startP.x += (Math.random() - 0.5) * 2.0
      startP.z += (Math.random() - 0.5) * 2.0
      npc.spawn(startP, Math.random() * Math.PI * 2, true)
    }
  }

  update(dt: number, time: number, playerPos: THREE.Vector3, camera?: THREE.Camera): void {
    let activeCount = 0

    // 更新所有非休眠的在場 NPC
    for (const npc of this.npcs) {
      if (npc.lifecycle !== 'dormant') {
        npc.update(dt, time, playerPos, camera)
        if (npc.lifecycle === 'active' || npc.lifecycle === 'entering') {
          activeCount += 1
        }
      }
    }

    this.spawnCooldown -= dt

    // 若在場人數未滿上限且生成間隔已到，自後備庫挑選新香客從山門牌樓大門步入！
    if (activeCount < this.TARGET_MIN || (activeCount < this.TARGET_MAX && this.spawnCooldown <= 0)) {
      const dormant = this.npcs.filter(n => n.lifecycle === 'dormant')
      if (dormant.length > 0) {
        const nextNpc = dormant[Math.floor(Math.random() * dormant.length)]
        // 自山門牌樓門外廣場步入宮門（絕非平白從地上冒出！）
        const spawnX = (Math.random() - 0.5) * 3.2
        const spawnPos = new THREE.Vector3(spawnX, 0, 54.5)
        nextNpc.spawn(spawnPos, Math.PI, false)
        this.spawnCooldown = 12.0 + Math.random() * 10.0
      }
    }
  }
}
