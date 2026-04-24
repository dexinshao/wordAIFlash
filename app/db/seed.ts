import { getDb } from "../api/queries/connection";
import { wordLibraries, words, libraryWords } from "./schema";
import { eq } from "drizzle-orm";

const db = getDb();

const libraries = [
  { name: "四级词汇", description: "大学英语四级考试核心词汇", category: "cet4" },
  { name: "六级词汇", description: "大学英语六级考试核心词汇", category: "cet6" },
  { name: "托福词汇", description: "托福考试必备词汇", category: "toefl" },
  { name: "雅思词汇", description: "雅思考试高频词汇", category: "ielts" },
  { name: "英语八级", description: "英语专业八级考试词汇", category: "tem8" },
  { name: "BEC商务", description: "商务英语考试核心词汇", category: "bec" },
  { name: "高中词汇", description: "高考英语大纲词汇", category: "high_school" },
  { name: "高频10000", description: "全球文本词频前10000单词", category: "top10000" },
];

const cet4Words = [
  { word: "abandon", phonetic: "/əˈbændən/", definitions: [{ pos: "v.", meaning: "放弃，抛弃" }], phrases: [{ phrase: "abandon oneself to", meaning: "沉溺于" }, { phrase: "abandon ship", meaning: "弃船" }], examples: [{ sentence: "The crew had to abandon the sinking ship.", translation: "船员们不得不弃船。" }] },
  { word: "ability", phonetic: "/əˈbɪləti/", definitions: [{ pos: "n.", meaning: "能力，才能" }], phrases: [{ phrase: "have the ability to", meaning: "有能力做..." }], examples: [{ sentence: "She has the ability to speak four languages.", translation: "她有能力说四种语言。" }] },
  { word: "absence", phonetic: "/ˈæbsəns/", definitions: [{ pos: "n.", meaning: "缺席，缺乏" }], phrases: [{ phrase: "in the absence of", meaning: "在...不在时；缺乏" }], examples: [{ sentence: "In the absence of any evidence, he was released.", translation: "在没有任何证据的情况下，他被释放了。" }] },
  { word: "absolute", phonetic: "/ˈæbsəluːt/", definitions: [{ pos: "adj.", meaning: "绝对的，完全的" }], phrases: [{ phrase: "absolute zero", meaning: "绝对零度" }], examples: [{ sentence: "I have absolute confidence in your ability.", translation: "我对你有绝对的信心。" }] },
  { word: "absorb", phonetic: "/əbˈsɔːrb/", definitions: [{ pos: "v.", meaning: "吸收；使全神贯注" }], phrases: [{ phrase: "be absorbed in", meaning: "全神贯注于" }], examples: [{ sentence: "The sponge can absorb a lot of water.", translation: "海绵能吸收大量的水。" }] },
  { word: "abstract", phonetic: "/ˈæbstrækt/", definitions: [{ pos: "adj.", meaning: "抽象的" }, { pos: "n.", meaning: "摘要" }], phrases: [{ phrase: "abstract art", meaning: "抽象艺术" }], examples: [{ sentence: "Truth and beauty are abstract concepts.", translation: "真理和美是抽象概念。" }] },
  { word: "abundant", phonetic: "/əˈbʌndənt/", definitions: [{ pos: "adj.", meaning: "丰富的，大量的" }], phrases: [{ phrase: "abundant in", meaning: "富于..." }], examples: [{ sentence: "The region is abundant in wildlife.", translation: "这个地区野生动物丰富。" }] },
  { word: "academic", phonetic: "/ˌækəˈdemɪk/", definitions: [{ pos: "adj.", meaning: "学术的" }, { pos: "n.", meaning: "大学教师" }], phrases: [{ phrase: "academic year", meaning: "学年" }], examples: [{ sentence: "She has a strong academic background.", translation: "她有很强的学术背景。" }] },
  { word: "academy", phonetic: "/əˈkædəmi/", definitions: [{ pos: "n.", meaning: "学院，研究院" }], phrases: [{ phrase: "military academy", meaning: "军事学院" }], examples: [{ sentence: "He graduated from a naval academy.", translation: "他毕业于海军学院。" }] },
  { word: "accelerate", phonetic: "/əkˈseləreɪt/", definitions: [{ pos: "v.", meaning: "加速，促进" }], phrases: [{ phrase: "accelerate growth", meaning: "加速增长" }], examples: [{ sentence: "The car accelerated to overtake the bus.", translation: "汽车加速超越公交车。" }] },
  { word: "accent", phonetic: "/ˈæksent/", definitions: [{ pos: "n.", meaning: "口音，重音" }], phrases: [{ phrase: "put the accent on", meaning: "强调..." }], examples: [{ sentence: "She speaks English with a French accent.", translation: "她讲英语带有法国口音。" }] },
  { word: "accept", phonetic: "/əkˈsept/", definitions: [{ pos: "v.", meaning: "接受，同意" }], phrases: [{ phrase: "accept responsibility", meaning: "承担责任" }], examples: [{ sentence: "I accept your apology.", translation: "我接受你的道歉。" }] },
  { word: "access", phonetic: "/ˈækses/", definitions: [{ pos: "n.", meaning: "通道，访问" }, { pos: "v.", meaning: "访问，存取" }], phrases: [{ phrase: "have access to", meaning: "有权使用..." }], examples: [{ sentence: "Students have access to the library.", translation: "学生可以使用图书馆。" }] },
  { word: "accident", phonetic: "/ˈæksɪdənt/", definitions: [{ pos: "n.", meaning: "事故，意外" }], phrases: [{ phrase: "by accident", meaning: "偶然地" }], examples: [{ sentence: "The accident happened yesterday.", translation: "事故昨天发生了。" }] },
  { word: "accompany", phonetic: "/əˈkʌmpəni/", definitions: [{ pos: "v.", meaning: "陪伴，伴随" }], phrases: [{ phrase: "accompany by", meaning: "由...伴奏/陪同" }], examples: [{ sentence: "She accompanied me to the hospital.", translation: "她陪我去医院。" }] },
  { word: "accomplish", phonetic: "/əˈkʌmplɪʃ/", definitions: [{ pos: "v.", meaning: "完成，实现" }], phrases: [{ phrase: "accomplish a goal", meaning: "实现目标" }], examples: [{ sentence: "We accomplished the task ahead of schedule.", translation: "我们提前完成了任务。" }] },
  { word: "accord", phonetic: "/əˈkɔːrd/", definitions: [{ pos: "v.", meaning: "一致，符合" }, { pos: "n.", meaning: "协议" }], phrases: [{ phrase: "in accord with", meaning: "与...一致" }], examples: [{ sentence: "His views are in accord with mine.", translation: "他的观点与我的一致。" }] },
  { word: "account", phonetic: "/əˈkaʊnt/", definitions: [{ pos: "n.", meaning: "账户，描述" }, { pos: "v.", meaning: "解释" }], phrases: [{ phrase: "take into account", meaning: "考虑到" }, { phrase: "on account of", meaning: "由于" }], examples: [{ sentence: "You should take the cost into account.", translation: "你应该把成本考虑进去。" }] },
  { word: "accumulate", phonetic: "/əˈkjuːmjəleɪt/", definitions: [{ pos: "v.", meaning: "积累，堆积" }], phrases: [{ phrase: "accumulate wealth", meaning: "积累财富" }], examples: [{ sentence: "Dust accumulated on the bookshelf.", translation: "灰尘堆积在书架上。" }] },
  { word: "accurate", phonetic: "/ˈækjərət/", definitions: [{ pos: "adj.", meaning: "精确的，准确的" }], phrases: [{ phrase: "accurate measurement", meaning: "精确测量" }], examples: [{ sentence: "The weather forecast was quite accurate.", translation: "天气预报相当准确。" }] },
  { word: "accuse", phonetic: "/əˈkjuːz/", definitions: [{ pos: "v.", meaning: "指控，指责" }], phrases: [{ phrase: "accuse of", meaning: "指控..." }], examples: [{ sentence: "He was accused of stealing.", translation: "他被指控偷窃。" }] },
  { word: "achieve", phonetic: "/əˈtʃiːv/", definitions: [{ pos: "v.", meaning: "达到，实现" }], phrases: [{ phrase: "achieve success", meaning: "取得成功" }], examples: [{ sentence: "She worked hard to achieve her goal.", translation: "她努力工作以实现目标。" }] },
  { word: "achievement", phonetic: "/əˈtʃiːvmənt/", definitions: [{ pos: "n.", meaning: "成就，成绩" }], phrases: [{ phrase: "sense of achievement", meaning: "成就感" }], examples: [{ sentence: "Winning the medal was a great achievement.", translation: "赢得奖牌是一项伟大的成就。" }] },
  { word: "acknowledge", phonetic: "/əkˈnɑːlɪdʒ/", definitions: [{ pos: "v.", meaning: "承认，致谢" }], phrases: [{ phrase: "acknowledge receipt", meaning: "确认收到" }], examples: [{ sentence: "He acknowledged his mistake.", translation: "他承认了自己的错误。" }] },
  { word: "acquire", phonetic: "/əˈkwaɪər/", definitions: [{ pos: "v.", meaning: "获得，学到" }], phrases: [{ phrase: "acquire knowledge", meaning: "获取知识" }], examples: [{ sentence: "She acquired a new skill during training.", translation: "她在培训期间学到了一项新技能。" }] },
  { word: "adapt", phonetic: "/əˈdæpt/", definitions: [{ pos: "v.", meaning: "适应，改编" }], phrases: [{ phrase: "adapt to", meaning: "适应..." }, { phrase: "adapt for", meaning: "为...改编" }], examples: [{ sentence: "It took time to adapt to the new environment.", translation: "适应新环境需要时间。" }] },
  { word: "adequate", phonetic: "/ˈædɪkwət/", definitions: [{ pos: "adj.", meaning: "足够的，适当的" }], phrases: [{ phrase: "adequate preparation", meaning: "充分准备" }], examples: [{ sentence: "The food was adequate for ten people.", translation: "食物足够十个人吃。" }] },
  { word: "adjust", phonetic: "/əˈdʒʌst/", definitions: [{ pos: "v.", meaning: "调整，适应" }], phrases: [{ phrase: "adjust to", meaning: "适应..." }], examples: [{ sentence: "It takes time to adjust to college life.", translation: "适应大学生活需要时间。" }] },
  { word: "admire", phonetic: "/ədˈmaɪər/", definitions: [{ pos: "v.", meaning: "钦佩，赞赏" }], phrases: [{ phrase: "admire for", meaning: "因...而钦佩" }], examples: [{ sentence: "I admire her courage.", translation: "我钦佩她的勇气。" }] },
  { word: "admit", phonetic: "/ədˈmɪt/", definitions: [{ pos: "v.", meaning: "承认，准许进入" }], phrases: [{ phrase: "admit to", meaning: "承认..." }], examples: [{ sentence: "He admitted breaking the window.", translation: "他承认打破了窗户。" }] },
];

const cet6Words = [
  { word: "abbreviate", phonetic: "/əˈbriːvieɪt/", definitions: [{ pos: "v.", meaning: "缩写，缩短" }], phrases: [{ phrase: "abbreviate to", meaning: "缩写为" }], examples: [{ sentence: "The name Robert is often abbreviated to Bob.", translation: "Robert 这个名字常被缩写为 Bob。" }] },
  { word: "abnormal", phonetic: "/æbˈnɔːrml/", definitions: [{ pos: "adj.", meaning: "异常的，反常的" }], phrases: [{ phrase: "abnormal behavior", meaning: "异常行为" }], examples: [{ sentence: "The test showed an abnormal level of cholesterol.", translation: "检测显示胆固醇水平异常。" }] },
  { word: "abolish", phonetic: "/əˈbɑːlɪʃ/", definitions: [{ pos: "v.", meaning: "废除，取消" }], phrases: [{ phrase: "abolish slavery", meaning: "废除奴隶制" }], examples: [{ sentence: "Slavery was abolished in the 19th century.", translation: "奴隶制在19世纪被废除。" }] },
  { word: "abrupt", phonetic: "/əˈbrʌpt/", definitions: [{ pos: "adj.", meaning: "突然的，唐突的" }], phrases: [{ phrase: "abrupt change", meaning: "突然变化" }], examples: [{ sentence: "The bus came to an abrupt stop.", translation: "公交车突然停了下来。" }] },
  { word: "abuse", phonetic: "/əˈbjuːs/", definitions: [{ pos: "n./v.", meaning: "滥用；虐待" }], phrases: [{ phrase: "drug abuse", meaning: "药物滥用" }, { phrase: "verbal abuse", meaning: "言语虐待" }], examples: [{ sentence: "Child abuse is a serious problem.", translation: "虐待儿童是一个严重的问题。" }] },
  { word: "accommodate", phonetic: "/əˈkɑːmədeɪt/", definitions: [{ pos: "v.", meaning: "容纳；适应；提供住宿" }], phrases: [{ phrase: "accommodate to", meaning: "适应..." }], examples: [{ sentence: "The hotel can accommodate 500 guests.", translation: "这家酒店能容纳500位客人。" }] },
  { word: "accordance", phonetic: "/əˈkɔːrdns/", definitions: [{ pos: "n.", meaning: "一致，按照" }], phrases: [{ phrase: "in accordance with", meaning: "依照，与...一致" }], examples: [{ sentence: "In accordance with your request, we have sent the documents.", translation: "按照您的要求，我们已经发送了文件。" }] },
  { word: "acid", phonetic: "/ˈæsɪd/", definitions: [{ pos: "n.", meaning: "酸" }, { pos: "adj.", meaning: "酸的，尖刻的" }], phrases: [{ phrase: "amino acid", meaning: "氨基酸" }], examples: [{ sentence: "Vinegar contains acetic acid.", translation: "醋含有乙酸。" }] },
  { word: "acknowledgement", phonetic: "/əkˈnɑːlɪdʒmənt/", definitions: [{ pos: "n.", meaning: "承认；致谢" }], phrases: [{ phrase: "in acknowledgement of", meaning: "为感谢..." }], examples: [{ sentence: "He waved in acknowledgement of my greeting.", translation: "他挥手回应我的问候。" }] },
  { word: "acquaint", phonetic: "/əˈkweɪnt/", definitions: [{ pos: "v.", meaning: "使熟悉，使了解" }], phrases: [{ phrase: "acquaint with", meaning: "使熟悉..." }], examples: [{ sentence: "Let me acquaint you with the facts.", translation: "让我使你了解事实。" }] },
  { word: "acquaintance", phonetic: "/əˈkweɪntəns/", definitions: [{ pos: "n.", meaning: "相识，熟人" }], phrases: [{ phrase: "make the acquaintance of", meaning: "结识..." }], examples: [{ sentence: "He is a casual acquaintance of mine.", translation: "他是我的一位泛泛之交。" }] },
  { word: "acquisition", phonetic: "/ˌækwɪˈzɪʃn/", definitions: [{ pos: "n.", meaning: "获得，习得；收购" }], phrases: [{ phrase: "language acquisition", meaning: "语言习得" }], examples: [{ sentence: "The company announced the acquisition of a rival firm.", translation: "该公司宣布收购一家竞争对手。" }] },
  { word: "addict", phonetic: "/ˈædɪkt/", definitions: [{ pos: "n.", meaning: "上瘾的人" }, { pos: "v.", meaning: "使上瘾" }], phrases: [{ phrase: "drug addict", meaning: "吸毒者" }, { phrase: "addict to", meaning: "沉迷于..." }], examples: [{ sentence: "He is a recovering drug addict.", translation: "他是一个正在康复的吸毒者。" }] },
  { word: "adhere", phonetic: "/ədˈhɪr/", definitions: [{ pos: "v.", meaning: "坚持；粘附" }], phrases: [{ phrase: "adhere to", meaning: "坚持；遵守" }], examples: [{ sentence: "We must adhere to the rules.", translation: "我们必须遵守规则。" }] },
  { word: "adjacent", phonetic: "/əˈdʒeɪsnt/", definitions: [{ pos: "adj.", meaning: "邻近的，毗邻的" }], phrases: [{ phrase: "adjacent to", meaning: "与...相邻" }], examples: [{ sentence: "The parking lot is adjacent to the building.", translation: "停车场毗邻大楼。" }] },
  { word: "administer", phonetic: "/ədˈmɪnɪstər/", definitions: [{ pos: "v.", meaning: "管理；执行；给予" }], phrases: [{ phrase: "administer medicine", meaning: "给药" }], examples: [{ sentence: "The nurse administered the injection.", translation: "护士进行了注射。" }] },
  { word: "adolescent", phonetic: "/ˌædəˈlesnt/", definitions: [{ pos: "n.", meaning: "青少年" }, { pos: "adj.", meaning: "青春期的" }], phrases: [{ phrase: "adolescent development", meaning: "青春期发育" }], examples: [{ sentence: "Adolescents need guidance from adults.", translation: "青少年需要成年人的引导。" }] },
  { word: "advantageous", phonetic: "/ˌædvənˈteɪdʒəs/", definitions: [{ pos: "adj.", meaning: "有利的，有益的" }], phrases: [{ phrase: "advantageous position", meaning: "有利位置" }], examples: [{ sentence: "The location is advantageous for business.", translation: "这个位置对商业有利。" }] },
  { word: "adverse", phonetic: "/ədˈvɜːrs/", definitions: [{ pos: "adj.", meaning: "不利的，敌对的" }], phrases: [{ phrase: "adverse effects", meaning: "副作用" }, { phrase: "adverse weather", meaning: "恶劣天气" }], examples: [{ sentence: "The drug has no adverse side effects.", translation: "这种药没有不良副作用。" }] },
  { word: "advocate", phonetic: "/ˈædvəkeɪt/", definitions: [{ pos: "v.", meaning: "提倡，主张" }, { pos: "n.", meaning: "倡导者" }], phrases: [{ phrase: "advocate for", meaning: "为...倡导" }], examples: [{ sentence: "She advocates for equal rights.", translation: "她倡导平等权利。" }] },
  { word: "aesthetic", phonetic: "/esˈθetɪk/", definitions: [{ pos: "adj.", meaning: "美学的，审美的" }, { pos: "n.", meaning: "美学" }], phrases: [{ phrase: "aesthetic value", meaning: "审美价值" }], examples: [{ sentence: "The building has great aesthetic appeal.", translation: "这座建筑具有很高的审美价值。" }] },
  { word: "affirm", phonetic: "/əˈfɜːrm/", definitions: [{ pos: "v.", meaning: "肯定，断言" }], phrases: [{ phrase: "affirm one's commitment", meaning: "重申承诺" }], examples: [{ sentence: "The court affirmed the lower court's decision.", translation: "法院维持了下级法院的判决。" }] },
  { word: "afflict", phonetic: "/əˈflɪkt/", definitions: [{ pos: "v.", meaning: "使痛苦，折磨" }], phrases: [{ phrase: "be afflicted with", meaning: "受...折磨" }], examples: [{ sentence: "Famine afflicted the region.", translation: "饥荒折磨着这个地区。" }] },
  { word: "agenda", phonetic: "/əˈdʒendə/", definitions: [{ pos: "n.", meaning: "议程，议事日程" }], phrases: [{ phrase: "on the agenda", meaning: "在议程上" }], examples: [{ sentence: "The first item on the agenda was the budget.", translation: "议程上的第一项是预算。" }] },
  { word: "agony", phonetic: "/ˈæɡəni/", definitions: [{ pos: "n.", meaning: "极度痛苦" }], phrases: [{ phrase: "in agony", meaning: "处于极度痛苦中" }], examples: [{ sentence: "He was in agony after the injury.", translation: "受伤后他处于极度痛苦中。" }] },
  { word: "aircraft", phonetic: "/ˈerkræft/", definitions: [{ pos: "n.", meaning: "飞机，航空器" }], phrases: [{ phrase: "military aircraft", meaning: "军用飞机" }], examples: [{ sentence: "All aircraft must maintain a safe distance.", translation: "所有飞机必须保持安全距离。" }] },
  { word: "allege", phonetic: "/əˈledʒ/", definitions: [{ pos: "v.", meaning: "断言，指控" }], phrases: [{ phrase: "allege that", meaning: "声称..." }], examples: [{ sentence: "He alleged that he had been mistreated.", translation: "他声称自己受到了虐待。" }] },
  { word: "allocate", phonetic: "/ˈæləkeɪt/", definitions: [{ pos: "v.", meaning: "分配，配置" }], phrases: [{ phrase: "allocate resources", meaning: "分配资源" }], examples: [{ sentence: "The government allocated funds for education.", translation: "政府为教育拨款。" }] },
  { word: "ally", phonetic: "/ˈælaɪ/", definitions: [{ pos: "n.", meaning: "盟友" }, { pos: "v.", meaning: "结盟" }], phrases: [{ phrase: "ally with", meaning: "与...结盟" }], examples: [{ sentence: "Britain was an ally of France in the war.", translation: "战争中英国是法国的盟友。" }] },
  { word: "ambiguity", phonetic: "/ˌæmbɪˈɡjuːəti/", definitions: [{ pos: "n.", meaning: "模棱两可，歧义" }], phrases: [{ phrase: "resolve ambiguity", meaning: "消除歧义" }], examples: [{ sentence: "The contract is full of ambiguity.", translation: "这份合同充满了歧义。" }] },
];

const toeflWords = [
  { word: "aberration", phonetic: "/ˌæbəˈreɪʃn/", definitions: [{ pos: "n.", meaning: "异常，脱离常规" }], phrases: [{ phrase: "temporary aberration", meaning: "暂时性偏差" }], examples: [{ sentence: "The drop in sales was just a temporary aberration.", translation: "销售额下降只是暂时的异常。" }] },
  { word: "abet", phonetic: "/əˈbet/", definitions: [{ pos: "v.", meaning: "教唆，怂恿" }], phrases: [{ phrase: "aid and abet", meaning: "协助和教唆" }], examples: [{ sentence: "He was accused of aiding and abetting the crime.", translation: "他被指控协助和教唆犯罪。" }] },
  { word: "abhor", phonetic: "/əbˈhɔːr/", definitions: [{ pos: "v.", meaning: "憎恶，厌恶" }], phrases: [{ phrase: "abhor violence", meaning: "憎恶暴力" }], examples: [{ sentence: "I abhor cruelty to animals.", translation: "我憎恶虐待动物。" }] },
  { word: "abrasive", phonetic: "/əˈbreɪsɪv/", definitions: [{ pos: "adj.", meaning: "粗糙的；粗鲁的" }, { pos: "n.", meaning: "研磨剂" }], phrases: [{ phrase: "abrasive personality", meaning: "粗鲁的性格" }], examples: [{ sentence: "His abrasive manner offended many people.", translation: "他粗鲁的举止冒犯了很多人。" }] },
  { word: "abreast", phonetic: "/əˈbrest/", definitions: [{ pos: "adv.", meaning: "并肩地，并排" }], phrases: [{ phrase: "keep abreast of", meaning: "跟上，了解...最新情况" }], examples: [{ sentence: "Keep abreast of the latest developments.", translation: "跟上最新的发展。" }] },
  { word: "abridge", phonetic: "/əˈbrɪdʒ/", definitions: [{ pos: "v.", meaning: "删节，缩短" }], phrases: [{ phrase: "abridged edition", meaning: "删节版" }], examples: [{ sentence: "The novel was abridged for radio.", translation: "这部小说被删节用于广播。" }] },
  { word: "absolve", phonetic: "/əbˈzɑːlv/", definitions: [{ pos: "v.", meaning: "赦免，免除" }], phrases: [{ phrase: "absolve from", meaning: "免除..." }], examples: [{ sentence: "The court absolved him of all responsibility.", translation: "法院免除了他的一切责任。" }] },
  { word: "abstain", phonetic: "/əbˈsteɪn/", definitions: [{ pos: "v.", meaning: "弃权；戒除" }], phrases: [{ phrase: "abstain from", meaning: "戒除..." }], examples: [{ sentence: "He decided to abstain from voting.", translation: "他决定弃权投票。" }] },
  { word: "abstracted", phonetic: "/æbˈstræktɪd/", definitions: [{ pos: "adj.", meaning: "心不在焉的" }], phrases: [{ phrase: "abstracted look", meaning: "心不在焉的表情" }], examples: [{ sentence: "She had an abstracted look on her face.", translation: "她脸上带着心不在焉的表情。" }] },
  { word: "abstruse", phonetic: "/æbˈstruːs/", definitions: [{ pos: "adj.", meaning: "深奥的，难懂的" }], phrases: [{ phrase: "abstruse theory", meaning: "深奥的理论" }], examples: [{ sentence: "The professor's lecture was too abstruse for most students.", translation: "教授的讲座对大多数学生来说太深奥了。" }] },
  { word: "abut", phonetic: "/əˈbʌt/", definitions: [{ pos: "v.", meaning: "毗邻，紧靠" }], phrases: [{ phrase: "abut on", meaning: "与...接壤" }], examples: [{ sentence: "Their property abuts ours.", translation: "他们的地产与我们的接壤。" }] },
  { word: "abysmal", phonetic: "/əˈbɪzməl/", definitions: [{ pos: "adj.", meaning: "极坏的，深不可测的" }], phrases: [{ phrase: "abysmal ignorance", meaning: "极端无知" }], examples: [{ sentence: "The food at that restaurant is abysmal.", translation: "那家餐厅的食物糟糕透顶。" }] },
  { word: "accede", phonetic: "/əkˈsiːd/", definitions: [{ pos: "v.", meaning: "同意，加入" }], phrases: [{ phrase: "accede to", meaning: "同意..." }], examples: [{ sentence: "The government acceded to the demands.", translation: "政府同意了要求。" }] },
  { word: "acclimate", phonetic: "/ˈækləmeɪt/", definitions: [{ pos: "v.", meaning: "使适应，使习惯" }], phrases: [{ phrase: "acclimate to", meaning: "适应..." }], examples: [{ sentence: "It takes time to acclimate to a new climate.", translation: "适应新气候需要时间。" }] },
  { word: "accomplice", phonetic: "/əˈkʌmplɪs/", definitions: [{ pos: "n.", meaning: "共犯，同谋" }], phrases: [{ phrase: "accomplice in crime", meaning: "犯罪同谋" }], examples: [{ sentence: "He was arrested as an accomplice to murder.", translation: "他作为谋杀共犯被捕。" }] },
  { word: "accost", phonetic: "/əˈkɔːst/", definitions: [{ pos: "v.", meaning: "上前搭话，招呼" }], phrases: [{ phrase: "accost a stranger", meaning: "跟陌生人搭话" }], examples: [{ sentence: "He was accosted by a beggar on the street.", translation: "他在街上被一个乞丐拦住了。" }] },
  { word: "accretion", phonetic: "/əˈkriːʃn/", definitions: [{ pos: "n.", meaning: "累积，积聚" }], phrases: [{ phrase: "accretion of wealth", meaning: "财富积累" }], examples: [{ sentence: "The rock formed through the slow accretion of sediment.", translation: "岩石是通过沉积物的缓慢积累形成的。" }] },
  { word: "acumen", phonetic: "/əˈkjuːmən/", definitions: [{ pos: "n.", meaning: "敏锐，精明" }], phrases: [{ phrase: "business acumen", meaning: "商业头脑" }], examples: [{ sentence: "She has demonstrated considerable business acumen.", translation: "她展现了相当的商业头脑。" }] },
  { word: "adamant", phonetic: "/ˈædəmənt/", definitions: [{ pos: "adj.", meaning: "坚定不移的" }], phrases: [{ phrase: "adamant refusal", meaning: "坚决拒绝" }], examples: [{ sentence: "She was adamant that she would not resign.", translation: "她坚决表示不会辞职。" }] },
  { word: "adjunct", phonetic: "/ˈædʒʌŋkt/", definitions: [{ pos: "n.", meaning: "附属物，附件" }, { pos: "adj.", meaning: "附属的" }], phrases: [{ phrase: "adjunct professor", meaning: "兼职教授" }], examples: [{ sentence: "He works as an adjunct professor at the university.", translation: "他在大学担任兼职教授。" }] },
  { word: "admonish", phonetic: "/ədˈmɑːnɪʃ/", definitions: [{ pos: "v.", meaning: "告诫，警告" }], phrases: [{ phrase: "admonish against", meaning: "警告不要..." }], examples: [{ sentence: "The teacher admonished him for being late.", translation: "老师因他迟到而告诫他。" }] },
  { word: "adulterate", phonetic: "/əˈdʌltəreɪt/", definitions: [{ pos: "v.", meaning: "掺杂，掺假" }], phrases: [{ phrase: "adulterated food", meaning: "掺假食品" }], examples: [{ sentence: "The milk had been adulterated with water.", translation: "牛奶里掺了水。" }] },
  { word: "adversary", phonetic: "/ˈædvərseri/", definitions: [{ pos: "n.", meaning: "对手，敌手" }], phrases: [{ phrase: "political adversary", meaning: "政敌" }], examples: [{ sentence: "He defeated his old adversary in the debate.", translation: "他在辩论中击败了他的老对手。" }] },
  { word: "advocacy", phonetic: "/ˈædvəkəsi/", definitions: [{ pos: "n.", meaning: "拥护，提倡" }], phrases: [{ phrase: "advocacy group", meaning: "倡导团体" }], examples: [{ sentence: "She is known for her advocacy of human rights.", translation: "她以倡导人权而闻名。" }] },
  { word: "affable", phonetic: "/ˈæfəbl/", definitions: [{ pos: "adj.", meaning: "和蔼可亲的，友善的" }], phrases: [{ phrase: "affable smile", meaning: "亲切的微笑" }], examples: [{ sentence: "He has an affable manner that puts people at ease.", translation: "他和蔼可亲的态度让人感到轻松。" }] },
  { word: "affinity", phonetic: "/əˈfɪnəti/", definitions: [{ pos: "n.", meaning: "亲和力，密切关系" }], phrases: [{ phrase: "natural affinity", meaning: "天然的亲和力" }], examples: [{ sentence: "She has a natural affinity for languages.", translation: "她对语言有天生的亲和力。" }] },
  { word: "affluent", phonetic: "/ˈæfluənt/", definitions: [{ pos: "adj.", meaning: "富裕的" }], phrases: [{ phrase: "affluent society", meaning: "富裕社会" }], examples: [{ sentence: "He comes from an affluent family.", translation: "他来自一个富裕的家庭。" }] },
  { word: "aggrandize", phonetic: "/əˈɡrændaɪz/", definitions: [{ pos: "v.", meaning: "扩大，增强" }], phrases: [{ phrase: "self-aggrandizement", meaning: "自我扩张" }], examples: [{ sentence: "He used his position to aggrandize himself.", translation: "他利用职位来扩大自己的权力。" }] },
  { word: "agile", phonetic: "/ˈædʒl/", definitions: [{ pos: "adj.", meaning: "敏捷的，灵活的" }], phrases: [{ phrase: "agile mind", meaning: "敏捷的思维" }], examples: [{ sentence: "The agile cat leaped onto the fence.", translation: "敏捷的猫跳上了栅栏。" }] },
];

const ieltsWords = [
  { word: "abide", phonetic: "/əˈbaɪd/", definitions: [{ pos: "v.", meaning: "忍受，遵守" }], phrases: [{ phrase: "abide by", meaning: "遵守..." }], examples: [{ sentence: "You must abide by the law.", translation: "你必须遵守法律。" }] },
  { word: "abolition", phonetic: "/ˌæbəˈlɪʃn/", definitions: [{ pos: "n.", meaning: "废除，废止" }], phrases: [{ phrase: "abolition of slavery", meaning: "废除奴隶制" }], examples: [{ sentence: "The abolition of slavery was a milestone.", translation: "废除奴隶制是一个里程碑。" }] },
  { word: "abound", phonetic: "/əˈbaʊnd/", definitions: [{ pos: "v.", meaning: "大量存在，充满" }], phrases: [{ phrase: "abound with", meaning: "充满..." }], examples: [{ sentence: "The forest abounds with wildlife.", translation: "森林里野生动物众多。" }] },
  { word: "absolve", phonetic: "/əbˈzɑːlv/", definitions: [{ pos: "v.", meaning: "赦免，免除" }], phrases: [{ phrase: "absolve from blame", meaning: "免除责备" }], examples: [{ sentence: "The evidence absolved him from suspicion.", translation: "证据消除了对他的怀疑。" }] },
  { word: "abundance", phonetic: "/əˈbʌndəns/", definitions: [{ pos: "n.", meaning: "丰富，充裕" }], phrases: [{ phrase: "in abundance", meaning: "丰富地" }], examples: [{ sentence: "The region has an abundance of natural resources.", translation: "这个地区有丰富的自然资源。" }] },
  { word: "acceleration", phonetic: "/əkˌseləˈreɪʃn/", definitions: [{ pos: "n.", meaning: "加速，加速度" }], phrases: [{ phrase: "economic acceleration", meaning: "经济加速" }], examples: [{ sentence: "The car's acceleration was impressive.", translation: "这辆车的加速令人印象深刻。" }] },
  { word: "accessible", phonetic: "/əkˈsesəbl/", definitions: [{ pos: "adj.", meaning: "可到达的，易接近的" }], phrases: [{ phrase: "accessible to", meaning: "对...可接近" }], examples: [{ sentence: "The museum is accessible to wheelchair users.", translation: "轮椅使用者可以进入博物馆。" }] },
  { word: "acclaim", phonetic: "/əˈkleɪm/", definitions: [{ pos: "n./v.", meaning: "称赞，喝彩" }], phrases: [{ phrase: "critical acclaim", meaning: "评论界的好评" }], examples: [{ sentence: "The film received widespread acclaim.", translation: "这部电影获得了广泛好评。" }] },
  { word: "accommodating", phonetic: "/əˈkɑːmədeɪtɪŋ/", definitions: [{ pos: "adj.", meaning: "乐于助人的，随和的" }], phrases: [{ phrase: "accommodating attitude", meaning: "随和的态度" }], examples: [{ sentence: "The staff were very accommodating.", translation: "员工非常乐于助人。" }] },
  { word: "accomplishment", phonetic: "/əˈkʌmplɪʃmənt/", definitions: [{ pos: "n.", meaning: "成就，完成" }], phrases: [{ phrase: "sense of accomplishment", meaning: "成就感" }], examples: [{ sentence: "Finishing the marathon was a real accomplishment.", translation: "完成马拉松是一项真正的成就。" }] },
  { word: "accumulation", phonetic: "/əˌkjuːmjəˈleɪʃn/", definitions: [{ pos: "n.", meaning: "积累，堆积" }], phrases: [{ phrase: "accumulation of wealth", meaning: "财富积累" }], examples: [{ sentence: "The accumulation of debt became a serious problem.", translation: "债务累积成为一个严重问题。" }] },
  { word: "accustomed", phonetic: "/əˈkʌstəmd/", definitions: [{ pos: "adj.", meaning: "习惯的" }], phrases: [{ phrase: "be accustomed to", meaning: "习惯于..." }], examples: [{ sentence: "I am accustomed to getting up early.", translation: "我习惯早起。" }] },
  { word: "acquainted", phonetic: "/əˈkweɪntɪd/", definitions: [{ pos: "adj.", meaning: "熟悉的" }], phrases: [{ phrase: "get acquainted with", meaning: "熟悉..." }], examples: [{ sentence: "Are you acquainted with the rules?", translation: "你熟悉规则吗？" }] },
  { word: "adaptation", phonetic: "/ˌædæpˈteɪʃn/", definitions: [{ pos: "n.", meaning: "适应，改编" }], phrases: [{ phrase: "adaptation to", meaning: "对...的适应" }], examples: [{ sentence: "The film is an adaptation of a novel.", translation: "这部电影改编自一部小说。" }] },
  { word: "adhere", phonetic: "/ədˈhɪr/", definitions: [{ pos: "v.", meaning: "坚持，粘附" }], phrases: [{ phrase: "adhere to principles", meaning: "坚持原则" }], examples: [{ sentence: "We must adhere to safety standards.", translation: "我们必须遵守安全标准。" }] },
  { word: "adjacent", phonetic: "/əˈdʒeɪsnt/", definitions: [{ pos: "adj.", meaning: "邻近的" }], phrases: [{ phrase: "adjacent rooms", meaning: "相邻的房间" }], examples: [{ sentence: "We stayed in adjacent rooms at the hotel.", translation: "我们在酒店住在相邻的房间。" }] },
  { word: "adjustment", phonetic: "/əˈdʒʌstmənt/", definitions: [{ pos: "n.", meaning: "调整，适应" }], phrases: [{ phrase: "make adjustments", meaning: "做出调整" }], examples: [{ sentence: "Moving abroad requires a big adjustment.", translation: "移居国外需要很大的调整。" }] },
  { word: "administration", phonetic: "/ədˌmɪnɪˈstreɪʃn/", definitions: [{ pos: "n.", meaning: "管理，行政部门" }], phrases: [{ phrase: "public administration", meaning: "公共行政" }], examples: [{ sentence: "The administration of the hospital needs improvement.", translation: "医院的管理需要改进。" }] },
  { word: "adverse", phonetic: "/ədˈvɜːrs/", definitions: [{ pos: "adj.", meaning: "不利的，有害的" }], phrases: [{ phrase: "adverse conditions", meaning: "不利条件" }], examples: [{ sentence: "The project was delayed by adverse weather.", translation: "项目因恶劣天气而推迟。" }] },
  { word: "advocate", phonetic: "/ˈædvəkeɪt/", definitions: [{ pos: "v.", meaning: "提倡" }, { pos: "n.", meaning: "倡导者" }], phrases: [{ phrase: "advocate for change", meaning: "倡导变革" }], examples: [{ sentence: "Many people advocate for stricter gun laws.", translation: "许多人主张更严格的枪支法律。" }] },
  { word: "aesthetic", phonetic: "/esˈθetɪk/", definitions: [{ pos: "adj.", meaning: "审美的" }], phrases: [{ phrase: "aesthetic appeal", meaning: "审美吸引力" }], examples: [{ sentence: "The building has little aesthetic value.", translation: "这座建筑没有什么审美价值。" }] },
  { word: "affirmative", phonetic: "/əˈfɜːrmətɪv/", definitions: [{ pos: "adj.", meaning: "肯定的" }, { pos: "n.", meaning: "肯定" }], phrases: [{ phrase: "affirmative action", meaning: "平权措施" }], examples: [{ sentence: "She answered in the affirmative.", translation: "她给出了肯定回答。" }] },
  { word: "affliction", phonetic: "/əˈflɪkʃn/", definitions: [{ pos: "n.", meaning: "痛苦，苦难" }], phrases: [{ phrase: "suffer an affliction", meaning: "遭受苦难" }], examples: [{ sentence: "Disease and famine are terrible afflictions.", translation: "疾病和饥荒是可怕的苦难。" }] },
  { word: "aggravate", phonetic: "/ˈæɡrəveɪt/", definitions: [{ pos: "v.", meaning: "加重，恶化" }], phrases: [{ phrase: "aggravate the situation", meaning: "恶化局势" }], examples: [{ sentence: "His rude behavior aggravated the situation.", translation: "他粗鲁的行为恶化了局势。" }] },
  { word: "aggression", phonetic: "/əˈɡreʃn/", definitions: [{ pos: "n.", meaning: "侵略，攻击性" }], phrases: [{ phrase: "act of aggression", meaning: "侵略行为" }], examples: [{ sentence: "The dog showed signs of aggression.", translation: "狗表现出攻击性的迹象。" }] },
  { word: "albeit", phonetic: "/ˌɔːlˈbiːɪt/", definitions: [{ pos: "conj.", meaning: "尽管，虽然" }], phrases: [], examples: [{ sentence: "He finally agreed, albeit reluctantly.", translation: "他最终同意了，尽管不太情愿。" }] },
  { word: "allocate", phonetic: "/ˈæləkeɪt/", definitions: [{ pos: "v.", meaning: "分配，配置" }], phrases: [{ phrase: "allocate time", meaning: "分配时间" }], examples: [{ sentence: "We need to allocate more resources to marketing.", translation: "我们需要为营销分配更多资源。" }] },
  { word: "ambiguous", phonetic: "/æmˈbɪɡjuəs/", definitions: [{ pos: "adj.", meaning: "模棱两可的，含糊的" }], phrases: [{ phrase: "ambiguous statement", meaning: "模棱两可的声明" }], examples: [{ sentence: "His answer was deliberately ambiguous.", translation: "他的回答故意模棱两可。" }] },
  { word: "amendment", phonetic: "/əˈmendmənt/", definitions: [{ pos: "n.", meaning: "修正案，修改" }], phrases: [{ phrase: "constitutional amendment", meaning: "宪法修正案" }], examples: [{ sentence: "The amendment was passed by Congress.", translation: "修正案在国会获得通过。" }] },
];

const tem8Words = [
  { word: "abeyance", phonetic: "/əˈbeɪəns/", definitions: [{ pos: "n.", meaning: "中止，暂停" }], phrases: [{ phrase: "in abeyance", meaning: "暂停中" }], examples: [{ sentence: "The plan is in abeyance until funding is secured.", translation: "该计划暂停执行，直到资金到位。" }] },
  { word: "abjure", phonetic: "/əbˈdʒʊr/", definitions: [{ pos: "v.", meaning: "发誓放弃，公开放弃" }], phrases: [{ phrase: "abjure one's religion", meaning: "放弃宗教信仰" }], examples: [{ sentence: "He abjured his former beliefs.", translation: "他发誓放弃以前的信仰。" }] },
  { word: "ablution", phonetic: "/əˈbluːʃn/", definitions: [{ pos: "n.", meaning: "沐浴，（宗教）洗礼" }], phrases: [{ phrase: "perform ablutions", meaning: "行沐浴礼" }], examples: [{ sentence: "He performed his morning ablutions.", translation: "他完成了晨间沐浴。" }] },
  { word: "abnegation", phonetic: "/ˌæbnɪˈɡeɪʃn/", definitions: [{ pos: "n.", meaning: "克制，放弃" }], phrases: [{ phrase: "self-abnegation", meaning: "自我克制" }], examples: [{ sentence: "Her life was one of self-abnegation.", translation: "她的一生是自我克制的一生。" }] },
  { word: "abominate", phonetic: "/əˈbɑːmɪneɪt/", definitions: [{ pos: "v.", meaning: "憎恶，厌恶" }], phrases: [{ phrase: "abominate cruelty", meaning: "憎恶残忍" }], examples: [{ sentence: "He abominates all forms of injustice.", translation: "他憎恶一切形式的不公正。" }] },
  { word: "aboriginal", phonetic: "/ˌæbəˈrɪdʒənl/", definitions: [{ pos: "adj.", meaning: "土著的，原始的" }, { pos: "n.", meaning: "土著居民" }], phrases: [{ phrase: "aboriginal culture", meaning: "土著文化" }], examples: [{ sentence: "The aboriginal people have lived here for thousands of years.", translation: "土著居民在这里生活了数千年。" }] },
  { word: "abrade", phonetic: "/əˈbreɪd/", definitions: [{ pos: "v.", meaning: "磨损，擦伤" }], phrases: [{ phrase: "abrade the surface", meaning: "磨损表面" }], examples: [{ sentence: "The rocks were abraded by constant wave action.", translation: "岩石被持续的海浪冲刷磨损。" }] },
  { word: "abrogate", phonetic: "/ˈæbrəɡeɪt/", definitions: [{ pos: "v.", meaning: "废除（法律等）" }], phrases: [{ phrase: "abrogate a treaty", meaning: "废除条约" }], examples: [{ sentence: "The government abrogated the old law.", translation: "政府废除了旧法律。" }] },
  { word: "abscond", phonetic: "/əbˈskɑːnd/", definitions: [{ pos: "v.", meaning: "潜逃，逃避" }], phrases: [{ phrase: "abscond with", meaning: "携带...潜逃" }], examples: [{ sentence: "The treasurer absconded with the funds.", translation: "财务主管携带资金潜逃了。" }] },
  { word: "absolution", phonetic: "/ˌæbsəˈluːʃn/", definitions: [{ pos: "n.", meaning: "赦免，免罪" }], phrases: [{ phrase: "grant absolution", meaning: "给予赦免" }], examples: [{ sentence: "He sought absolution for his sins.", translation: "他寻求对他罪行的赦免。" }] },
  { word: "abstemious", phonetic: "/əbˈstiːmiəs/", definitions: [{ pos: "adj.", meaning: "有节制的，节俭的" }], phrases: [{ phrase: "abstemious diet", meaning: "节制的饮食" }], examples: [{ sentence: "He leads an abstemious life.", translation: "他过着节制的生活。" }] },
  { word: "accelerator", phonetic: "/əkˈseləreɪtər/", definitions: [{ pos: "n.", meaning: "加速器，油门" }], phrases: [{ phrase: "particle accelerator", meaning: "粒子加速器" }], examples: [{ sentence: "He pressed the accelerator to speed up.", translation: "他踩下油门加速。" }] },
  { word: "accentuate", phonetic: "/əkˈsentʃueɪt/", definitions: [{ pos: "v.", meaning: "强调，突出" }], phrases: [{ phrase: "accentuate the positive", meaning: "强调积极的方面" }], examples: [{ sentence: "The lighting accentuated the painting's colors.", translation: "灯光突出了画作的色彩。" }] },
  { word: "accession", phonetic: "/əkˈseʃn/", definitions: [{ pos: "n.", meaning: "就职，加入；增加" }], phrases: [{ phrase: "accession to power", meaning: "上台执政" }], examples: [{ sentence: "The museum's latest accession is a rare painting.", translation: "博物馆最新收藏的是一幅稀有画作。" }] },
  { word: "acclamation", phonetic: "/ˌækləˈmeɪʃn/", definitions: [{ pos: "n.", meaning: "欢呼，喝彩" }], phrases: [{ phrase: "by acclamation", meaning: "以欢呼方式" }], examples: [{ sentence: "The leader was chosen by acclamation.", translation: "领袖以欢呼方式被选出。" }] },
  { word: "accolade", phonetic: "/ˈækəleɪd/", definitions: [{ pos: "n.", meaning: "荣誉，嘉奖" }], phrases: [{ phrase: "receive accolades", meaning: "获得荣誉" }], examples: [{ sentence: "The film received numerous accolades.", translation: "这部电影获得了众多荣誉。" }] },
  { word: "acrid", phonetic: "/ˈækrɪd/", definitions: [{ pos: "adj.", meaning: "辛辣的，刻薄的" }], phrases: [{ phrase: "acrid smell", meaning: "刺鼻的气味" }], examples: [{ sentence: "An acrid smell came from the laboratory.", translation: "从实验室传来刺鼻的气味。" }] },
  { word: "acrimonious", phonetic: "/ˌækrɪˈmoʊniəs/", definitions: [{ pos: "adj.", meaning: "尖刻的，激烈的" }], phrases: [{ phrase: "acrimonious dispute", meaning: "激烈争论" }], examples: [{ sentence: "The divorce was acrimonious.", translation: "这场离婚充满敌意。" }] },
  { word: "adage", phonetic: "/ˈædɪdʒ/", definitions: [{ pos: "n.", meaning: "格言，谚语" }], phrases: [{ phrase: "old adage", meaning: "古老的格言" }], examples: [{ sentence: "Remember the old adage: practice makes perfect.", translation: "记住古老的格言：熟能生巧。" }] },
  { word: "adduce", phonetic: "/əˈduːs/", definitions: [{ pos: "v.", meaning: "引证，举出" }], phrases: [{ phrase: "adduce evidence", meaning: "引证证据" }], examples: [{ sentence: "He adduced several examples to support his argument.", translation: "他举出几个例子来支持他的论点。" }] },
  { word: "adjudicate", phonetic: "/əˈdʒuːdɪkeɪt/", definitions: [{ pos: "v.", meaning: "判决，裁定" }], phrases: [{ phrase: "adjudicate a dispute", meaning: "裁决争端" }], examples: [{ sentence: "The court will adjudicate the case next week.", translation: "法庭将于下周审理此案。" }] },
  { word: "admonition", phonetic: "/ˌædməˈnɪʃn/", definitions: [{ pos: "n.", meaning: "告诫，警告" }], phrases: [{ phrase: "gentle admonition", meaning: "温和的告诫" }], examples: [{ sentence: "He ignored his mother's admonitions.", translation: "他无视母亲的告诫。" }] },
  { word: "adulation", phonetic: "/ˌædʒuˈleɪʃn/", definitions: [{ pos: "n.", meaning: "谄媚，奉承" }], phrases: [], examples: [{ sentence: "The star was embarrassed by the adulation of fans.", translation: "明星对粉丝的奉承感到尴尬。" }] },
  { word: "adulteration", phonetic: "/əˌdʌltəˈreɪʃn/", definitions: [{ pos: "n.", meaning: "掺杂，掺假" }], phrases: [{ phrase: "food adulteration", meaning: "食品掺假" }], examples: [{ sentence: "The government cracked down on food adulteration.", translation: "政府严厉打击食品掺假。" }] },
  { word: "adumbrate", phonetic: "/ˈædʌmbreɪt/", definitions: [{ pos: "v.", meaning: "预示，勾画轮廓" }], phrases: [], examples: [{ sentence: "The report adumbrates the challenges ahead.", translation: "报告预示了未来的挑战。" }] },
  { word: "adventitious", phonetic: "/ˌædvenˈtɪʃəs/", definitions: [{ pos: "adj.", meaning: "偶然的，外来的" }], phrases: [], examples: [{ sentence: "The plant's adventitious roots helped it survive.", translation: "植物的不定根帮助它存活下来。" }] },
  { word: "aegis", phonetic: "/ˈiːdʒɪs/", definitions: [{ pos: "n.", meaning: "保护，庇护" }], phrases: [{ phrase: "under the aegis of", meaning: "在...的庇护下" }], examples: [{ sentence: "The project was conducted under the aegis of UNESCO.", translation: "该项目在联合国教科文组织的支持下进行。" }] },
];

const becWords = [
  { word: "acquisition", phonetic: "/ˌækwɪˈzɪʃn/", definitions: [{ pos: "n.", meaning: "收购，并购" }], phrases: [{ phrase: "merger and acquisition", meaning: "兼并与收购" }], examples: [{ sentence: "The acquisition of the rival company cost $2 billion.", translation: "收购竞争对手的公司花费了20亿美元。" }] },
  { word: "affiliate", phonetic: "/əˈfɪlieɪt/", definitions: [{ pos: "n.", meaning: "分公司，附属机构" }, { pos: "v.", meaning: "使隶属" }], phrases: [{ phrase: "affiliate company", meaning: "关联公司" }], examples: [{ sentence: "Our affiliate in Tokyo handles Asian operations.", translation: "我们在东京的分公司负责亚洲业务。" }] },
  { word: "aggregate", phonetic: "/ˈæɡrɪɡət/", definitions: [{ pos: "n.", meaning: "总计，合计" }, { pos: "adj.", meaning: "合计的" }], phrases: [{ phrase: "in the aggregate", meaning: "总体上" }], examples: [{ sentence: "The aggregate sales exceeded our targets.", translation: "总销售额超过了我们的目标。" }] },
  { word: "allocate", phonetic: "/ˈæləkeɪt/", definitions: [{ pos: "v.", meaning: "分配，拨款" }], phrases: [{ phrase: "allocate budget", meaning: "分配预算" }], examples: [{ sentence: "We need to allocate funds for marketing.", translation: "我们需要为市场营销拨款。" }] },
  { word: "amortize", phonetic: "/ˈæmərtaɪz/", definitions: [{ pos: "v.", meaning: "摊销，分期偿还" }], phrases: [{ phrase: "amortize a loan", meaning: "分期偿还贷款" }], examples: [{ sentence: "The company decided to amortize the debt over five years.", translation: "公司决定在五年内摊销债务。" }] },
  { word: "arbitrage", phonetic: "/ˈɑːrbɪtrɑːʒ/", definitions: [{ pos: "n.", meaning: "套利" }], phrases: [{ phrase: "currency arbitrage", meaning: "货币套利" }], examples: [{ sentence: "Arbitrage opportunities exist in foreign exchange markets.", translation: "外汇市场中存在套利机会。" }] },
  { word: "asset", phonetic: "/ˈæset/", definitions: [{ pos: "n.", meaning: "资产，财产" }], phrases: [{ phrase: "fixed asset", meaning: "固定资产" }, { phrase: "tangible asset", meaning: "有形资产" }], examples: [{ sentence: "Real estate is considered a stable long-term asset.", translation: "房地产被认为是稳定的长期资产。" }] },
  { word: "audit", phonetic: "/ˈɔːdɪt/", definitions: [{ pos: "n./v.", meaning: "审计，审查" }], phrases: [{ phrase: "annual audit", meaning: "年度审计" }], examples: [{ sentence: "The financial statements are subject to annual audit.", translation: "财务报表需接受年度审计。" }] },
  { word: "benchmark", phonetic: "/ˈbentʃmɑːrk/", definitions: [{ pos: "n.", meaning: "基准，标杆" }, { pos: "v.", meaning: "以...为基准" }], phrases: [{ phrase: "benchmark against", meaning: "以...为基准" }], examples: [{ sentence: "We benchmark our performance against industry leaders.", translation: "我们以行业领导者为基准评估我们的表现。" }] },
  { word: "blue chip", phonetic: "/ˌbluː ˈtʃɪp/", definitions: [{ pos: "n.", meaning: "蓝筹股" }], phrases: [{ phrase: "blue chip stock", meaning: "蓝筹股" }], examples: [{ sentence: "Investors prefer blue chip stocks for stability.", translation: "投资者偏好蓝筹股的稳定性。" }] },
  { word: "bond", phonetic: "/bɑːnd/", definitions: [{ pos: "n.", meaning: "债券，契约" }], phrases: [{ phrase: "government bond", meaning: "政府债券" }, { phrase: "junk bond", meaning: "垃圾债券" }], examples: [{ sentence: "The company issued bonds to raise capital.", translation: "公司发行债券以筹集资金。" }] },
  { word: "broker", phonetic: "/ˈbroʊkər/", definitions: [{ pos: "n.", meaning: "经纪人" }, { pos: "v.", meaning: "安排，协商" }], phrases: [{ phrase: "insurance broker", meaning: "保险经纪人" }], examples: [{ sentence: "We hired a broker to negotiate the deal.", translation: "我们聘请了经纪人来协商这笔交易。" }] },
  { word: "buffer", phonetic: "/ˈbʌfər/", definitions: [{ pos: "n.", meaning: "缓冲" }, { pos: "v.", meaning: "缓冲" }], phrases: [{ phrase: "buffer zone", meaning: "缓冲区" }], examples: [{ sentence: "Cash reserves act as a buffer against losses.", translation: "现金储备作为损失的缓冲。" }] },
  { word: "bull market", phonetic: "/ˈbʊl ˌmɑːrkɪt/", definitions: [{ pos: "n.", meaning: "牛市" }], phrases: [{ phrase: "bull market trend", meaning: "牛市趋势" }], examples: [{ sentence: "The bull market has lasted for three years.", translation: "牛市已经持续了三年。" }] },
  { word: "buyout", phonetic: "/ˈbaɪaʊt/", definitions: [{ pos: "n.", meaning: "收购，买断" }], phrases: [{ phrase: "management buyout", meaning: "管理层收购" }], examples: [{ sentence: "The management buyout was financed by a bank loan.", translation: "管理层收购由银行贷款融资。" }] },
  { word: "capital", phonetic: "/ˈkæpɪtl/", definitions: [{ pos: "n.", meaning: "资本，资金" }, { pos: "adj.", meaning: "首都的，大写的" }], phrases: [{ phrase: "working capital", meaning: "营运资本" }, { phrase: "venture capital", meaning: "风险投资" }], examples: [{ sentence: "We need more capital to expand the business.", translation: "我们需要更多资金来扩展业务。" }] },
  { word: "commodity", phonetic: "/kəˈmɑːdəti/", definitions: [{ pos: "n.", meaning: "商品，原材料" }], phrases: [{ phrase: "commodity market", meaning: "商品市场" }], examples: [{ sentence: "Oil is the most traded commodity in the world.", translation: "石油是世界上交易量最大的商品。" }] },
  { word: "consortium", phonetic: "/kənˈsɔːrtiəm/", definitions: [{ pos: "n.", meaning: "财团，联合企业" }], phrases: [{ phrase: "banking consortium", meaning: "银行财团" }], examples: [{ sentence: "A consortium of banks funded the project.", translation: "银行财团为该项目提供资金。" }] },
  { word: "creditor", phonetic: "/ˈkredɪtər/", definitions: [{ pos: "n.", meaning: "债权人，贷方" }], phrases: [{ phrase: "secured creditor", meaning: "有担保债权人" }], examples: [{ sentence: "Creditors are demanding repayment of the loan.", translation: "债权人要求偿还贷款。" }] },
  { word: "deficit", phonetic: "/ˈdefɪsɪt/", definitions: [{ pos: "n.", meaning: "赤字，逆差" }], phrases: [{ phrase: "trade deficit", meaning: "贸易逆差" }, { phrase: "budget deficit", meaning: "预算赤字" }], examples: [{ sentence: "The country faces a growing trade deficit.", translation: "该国面临日益增长的贸易逆差。" }] },
  { word: "dividend", phonetic: "/ˈdɪvɪdend/", definitions: [{ pos: "n.", meaning: "红利，股息" }], phrases: [{ phrase: "pay a dividend", meaning: "支付股息" }], examples: [{ sentence: "The company announced a quarterly dividend.", translation: "公司宣布发放季度股息。" }] },
  { word: "entity", phonetic: "/ˈentəti/", definitions: [{ pos: "n.", meaning: "实体，单位" }], phrases: [{ phrase: "business entity", meaning: "商业实体" }], examples: [{ sentence: "Each subsidiary is a separate legal entity.", translation: "每个子公司都是独立的法律实体。" }] },
  { word: "equity", phonetic: "/ˈekwəti/", definitions: [{ pos: "n.", meaning: "股权，权益" }], phrases: [{ phrase: "private equity", meaning: "私募股权" }, { phrase: "brand equity", meaning: "品牌资产" }], examples: [{ sentence: "The firm invested in private equity.", translation: "该公司投资了私募股权。" }] },
  { word: "fiscal", phonetic: "/ˈfɪskl/", definitions: [{ pos: "adj.", meaning: "财政的，会计的" }], phrases: [{ phrase: "fiscal year", meaning: "财政年度" }, { phrase: "fiscal policy", meaning: "财政政策" }], examples: [{ sentence: "The fiscal year ends on March 31.", translation: "财政年度于3月31日结束。" }] },
  { word: "franchise", phonetic: "/ˈfræntʃaɪz/", definitions: [{ pos: "n.", meaning: "特许经营权" }, { pos: "v.", meaning: "授予特许权" }], phrases: [{ phrase: "franchise business", meaning: "特许经营业务" }], examples: [{ sentence: "They expanded through a franchise model.", translation: "他们通过特许经营模式扩张。" }] },
  { word: "incentive", phonetic: "/ɪnˈsentɪv/", definitions: [{ pos: "n.", meaning: "激励，动机" }], phrases: [{ phrase: "financial incentive", meaning: "经济激励" }], examples: [{ sentence: "Bonuses provide an incentive for better performance.", translation: "奖金为更好的表现提供激励。" }] },
  { word: "liability", phonetic: "/ˌlaɪəˈbɪləti/", definitions: [{ pos: "n.", meaning: "负债，责任" }], phrases: [{ phrase: "limited liability", meaning: "有限责任" }], examples: [{ sentence: "The company's liabilities exceeded its assets.", translation: "公司的负债超过了资产。" }] },
  { word: "liquidate", phonetic: "/ˈlɪkwɪdeɪt/", definitions: [{ pos: "v.", meaning: "清算，变现" }], phrases: [{ phrase: "liquidate assets", meaning: "清算资产" }], examples: [{ sentence: "The court ordered the company to liquidate.", translation: "法院命令该公司进行清算。" }] },
  { word: "merger", phonetic: "/ˈmɜːrdʒər/", definitions: [{ pos: "n.", meaning: "合并，兼并" }], phrases: [{ phrase: "merger and acquisition", meaning: "兼并与收购" }], examples: [{ sentence: "The merger created the largest bank in the country.", translation: "合并创建了全国最大的银行。" }] },
  { word: "subsidiary", phonetic: "/səbˈsɪdieri/", definitions: [{ pos: "n.", meaning: "子公司" }, { pos: "adj.", meaning: "辅助的" }], phrases: [{ phrase: "wholly-owned subsidiary", meaning: "全资子公司" }], examples: [{ sentence: "The parent company owns several subsidiaries.", translation: "母公司拥有几个子公司。" }] },
];

const highSchoolWords = [
  { word: "apple", phonetic: "/ˈæpl/", definitions: [{ pos: "n.", meaning: "苹果" }], phrases: [{ phrase: "apple tree", meaning: "苹果树" }, { phrase: "the Big Apple", meaning: "纽约" }], examples: [{ sentence: "An apple a day keeps the doctor away.", translation: "一天一苹果，医生远离我。" }] },
  { word: "beautiful", phonetic: "/ˈbjuːtɪfl/", definitions: [{ pos: "adj.", meaning: "美丽的" }], phrases: [{ phrase: "beautiful scenery", meaning: "美丽的风景" }], examples: [{ sentence: "The sunset was beautiful.", translation: "日落很美。" }] },
  { word: "challenge", phonetic: "/ˈtʃælɪndʒ/", definitions: [{ pos: "n.", meaning: "挑战" }, { pos: "v.", meaning: "挑战" }], phrases: [{ phrase: "face a challenge", meaning: "面对挑战" }], examples: [{ sentence: "Learning a new language is a challenge.", translation: "学习一门新语言是一个挑战。" }] },
  { word: "develop", phonetic: "/dɪˈveləp/", definitions: [{ pos: "v.", meaning: "发展，开发" }], phrases: [{ phrase: "develop skills", meaning: "培养技能" }], examples: [{ sentence: "Children develop at different rates.", translation: "孩子的成长速度各不相同。" }] },
  { word: "education", phonetic: "/ˌedʒuˈkeɪʃn/", definitions: [{ pos: "n.", meaning: "教育" }], phrases: [{ phrase: "higher education", meaning: "高等教育" }], examples: [{ sentence: "Education is the key to success.", translation: "教育是成功的关键。" }] },
  { word: "friend", phonetic: "/frend/", definitions: [{ pos: "n.", meaning: "朋友" }], phrases: [{ phrase: "best friend", meaning: "最好的朋友" }, { phrase: "make friends", meaning: "交朋友" }], examples: [{ sentence: "A friend in need is a friend indeed.", translation: "患难见真情。" }] },
  { word: "global", phonetic: "/ˈɡloʊbl/", definitions: [{ pos: "adj.", meaning: "全球的" }], phrases: [{ phrase: "global warming", meaning: "全球变暖" }], examples: [{ sentence: "Climate change is a global issue.", translation: "气候变化是一个全球性问题。" }] },
  { word: "history", phonetic: "/ˈhɪstri/", definitions: [{ pos: "n.", meaning: "历史" }], phrases: [{ phrase: "make history", meaning: "创造历史" }], examples: [{ sentence: "We study history to learn from the past.", translation: "我们学习历史以借鉴过去。" }] },
  { word: "improve", phonetic: "/ɪmˈpruːv/", definitions: [{ pos: "v.", meaning: "改善，提高" }], phrases: [{ phrase: "improve English", meaning: "提高英语" }], examples: [{ sentence: "Practice will improve your skills.", translation: "练习会提高你的技能。" }] },
  { word: "journey", phonetic: "/ˈdʒɜːrni/", definitions: [{ pos: "n.", meaning: "旅行，旅程" }], phrases: [{ phrase: "go on a journey", meaning: "去旅行" }], examples: [{ sentence: "Life is a journey, not a destination.", translation: "人生是一场旅程，不是终点。" }] },
  { word: "knowledge", phonetic: "/ˈnɑːlɪdʒ/", definitions: [{ pos: "n.", meaning: "知识" }], phrases: [{ phrase: "gain knowledge", meaning: "获取知识" }], examples: [{ sentence: "Knowledge is power.", translation: "知识就是力量。" }] },
  { word: "language", phonetic: "/ˈlæŋɡwɪdʒ/", definitions: [{ pos: "n.", meaning: "语言" }], phrases: [{ phrase: "body language", meaning: "肢体语言" }], examples: [{ sentence: "English is a global language.", translation: "英语是全球语言。" }] },
  { word: "memory", phonetic: "/ˈmeməri/", definitions: [{ pos: "n.", meaning: "记忆，回忆" }], phrases: [{ phrase: "in memory of", meaning: "纪念..." }], examples: [{ sentence: "I have fond memories of childhood.", translation: "我有美好的童年回忆。" }] },
  { word: "nature", phonetic: "/ˈneɪtʃər/", definitions: [{ pos: "n.", meaning: "自然，本质" }], phrases: [{ phrase: "mother nature", meaning: "大自然" }], examples: [{ sentence: "We should protect nature.", translation: "我们应该保护自然。" }] },
  { word: "opportunity", phonetic: "/ˌɑːpərˈtuːnəti/", definitions: [{ pos: "n.", meaning: "机会" }], phrases: [{ phrase: "seize the opportunity", meaning: "抓住机会" }], examples: [{ sentence: "Every challenge is an opportunity.", translation: "每个挑战都是一个机会。" }] },
  { word: "practice", phonetic: "/ˈpræktɪs/", definitions: [{ pos: "n.", meaning: "练习，实践" }, { pos: "v.", meaning: "练习" }], phrases: [{ phrase: "put into practice", meaning: "付诸实践" }], examples: [{ sentence: "Practice makes perfect.", translation: "熟能生巧。" }] },
  { word: "quality", phonetic: "/ˈkwɑːləti/", definitions: [{ pos: "n.", meaning: "质量，品质" }, { pos: "adj.", meaning: "优质的" }], phrases: [{ phrase: "high quality", meaning: "高质量" }], examples: [{ sentence: "Quality is more important than quantity.", translation: "质量比数量更重要。" }] },
  { word: "responsibility", phonetic: "/rɪˌspɑːnsəˈbɪləti/", definitions: [{ pos: "n.", meaning: "责任" }], phrases: [{ phrase: "take responsibility", meaning: "承担责任" }], examples: [{ sentence: "With freedom comes responsibility.", translation: "自由伴随着责任。" }] },
  { word: "success", phonetic: "/səkˈses/", definitions: [{ pos: "n.", meaning: "成功" }], phrases: [{ phrase: "key to success", meaning: "成功的关键" }], examples: [{ sentence: "Hard work leads to success.", translation: "努力工作通向成功。" }] },
  { word: "technology", phonetic: "/tekˈnɑːlədʒi/", definitions: [{ pos: "n.", meaning: "技术" }], phrases: [{ phrase: "information technology", meaning: "信息技术" }], examples: [{ sentence: "Technology is changing our lives.", translation: "技术正在改变我们的生活。" }] },
  { word: "universe", phonetic: "/ˈjuːnɪvɜːrs/", definitions: [{ pos: "n.", meaning: "宇宙" }], phrases: [{ phrase: "in the universe", meaning: "在宇宙中" }], examples: [{ sentence: "The universe is vast and mysterious.", translation: "宇宙浩瀚而神秘。" }] },
  { word: "volunteer", phonetic: "/ˌvɑːlənˈtɪr/", definitions: [{ pos: "n.", meaning: "志愿者" }, { pos: "v.", meaning: "自愿做" }], phrases: [{ phrase: "volunteer for", meaning: "自愿承担" }], examples: [{ sentence: "She works as a volunteer at the hospital.", translation: "她在医院做志愿者。" }] },
  { word: "wonderful", phonetic: "/ˈwʌndərfl/", definitions: [{ pos: "adj.", meaning: "精彩的，极好的" }], phrases: [{ phrase: "wonderful time", meaning: "美好时光" }], examples: [{ sentence: "We had a wonderful vacation.", translation: "我们度过了一个美好的假期。" }] },
  { word: "youth", phonetic: "/juːθ/", definitions: [{ pos: "n.", meaning: "青年，青春" }], phrases: [{ phrase: "in one's youth", meaning: "在某人年轻时" }], examples: [{ sentence: "Youth is the time to dream big.", translation: "青春是大胆做梦的时候。" }] },
  { word: "abroad", phonetic: "/əˈbrɔːd/", definitions: [{ pos: "adv.", meaning: "在国外" }], phrases: [{ phrase: "study abroad", meaning: "出国留学" }], examples: [{ sentence: "She went abroad to study medicine.", translation: "她出国学习医学。" }] },
  { word: "balance", phonetic: "/ˈbæləns/", definitions: [{ pos: "n.", meaning: "平衡" }, { pos: "v.", meaning: "使平衡" }], phrases: [{ phrase: "work-life balance", meaning: "工作与生活的平衡" }], examples: [{ sentence: "You need to balance work and rest.", translation: "你需要平衡工作和休息。" }] },
  { word: "career", phonetic: "/kəˈrɪr/", definitions: [{ pos: "n.", meaning: "事业，职业" }], phrases: [{ phrase: "career path", meaning: "职业道路" }], examples: [{ sentence: "She has a successful career in law.", translation: "她在法律领域有成功的事业。" }] },
  { word: "diversity", phonetic: "/daɪˈvɜːrsəti/", definitions: [{ pos: "n.", meaning: "多样性" }], phrases: [{ phrase: "cultural diversity", meaning: "文化多样性" }], examples: [{ sentence: "Our school values diversity.", translation: "我们学校重视多样性。" }] },
  { word: "effort", phonetic: "/ˈefərt/", definitions: [{ pos: "n.", meaning: "努力" }], phrases: [{ phrase: "make an effort", meaning: "努力" }], examples: [{ sentence: "Success requires effort and determination.", translation: "成功需要努力和决心。" }] },
  { word: "zeal", phonetic: "/ziːl/", definitions: [{ pos: "n.", meaning: "热情，热忱" }], phrases: [{ phrase: "with zeal", meaning: "热情地" }], examples: [{ sentence: "He pursued his goal with zeal.", translation: "他热情地追求目标。" }] },
];

const top10000Words = [
  { word: "the", phonetic: "/ðə; ðiː/", definitions: [{ pos: "art.", meaning: "这，那（定冠词）" }], phrases: [], examples: [{ sentence: "The sun rises in the east.", translation: "太阳从东方升起。" }] },
  { word: "be", phonetic: "/biː/", definitions: [{ pos: "v.", meaning: "是，存在" }], phrases: [{ phrase: "be going to", meaning: "将要" }], examples: [{ sentence: "To be or not to be, that is the question.", translation: "生存还是毁灭，这是一个问题。" }] },
  { word: "have", phonetic: "/hæv; həv/", definitions: [{ pos: "v.", meaning: "有，拥有" }], phrases: [{ phrase: "have to", meaning: "必须" }, { phrase: "have fun", meaning: "玩得开心" }], examples: [{ sentence: "I have a dream.", translation: "我有一个梦想。" }] },
  { word: "say", phonetic: "/seɪ/", definitions: [{ pos: "v.", meaning: "说" }], phrases: [{ phrase: "It goes without saying", meaning: "不言而喻" }], examples: [{ sentence: "They say practice makes perfect.", translation: "他们说熟能生巧。" }] },
  { word: "get", phonetic: "/ɡet/", definitions: [{ pos: "v.", meaning: "得到，变得" }], phrases: [{ phrase: "get up", meaning: "起床" }, { phrase: "get along", meaning: "相处" }], examples: [{ sentence: "I need to get some sleep.", translation: "我需要睡一会儿。" }] },
  { word: "make", phonetic: "/meɪk/", definitions: [{ pos: "v.", meaning: "制作，使" }], phrases: [{ phrase: "make up", meaning: "组成；化妆" }, { phrase: "make sense", meaning: "有意义" }], examples: [{ sentence: "Let's make a plan.", translation: "我们制定一个计划吧。" }] },
  { word: "go", phonetic: "/ɡoʊ/", definitions: [{ pos: "v.", meaning: "去，走" }], phrases: [{ phrase: "go on", meaning: "继续" }, { phrase: "go away", meaning: "离开" }], examples: [{ sentence: "Let's go to the park.", translation: "我们去公园吧。" }] },
  { word: "know", phonetic: "/noʊ/", definitions: [{ pos: "v.", meaning: "知道，了解" }], phrases: [{ phrase: "know about", meaning: "了解" }, { phrase: "as far as I know", meaning: "据我所知" }], examples: [{ sentence: "I know the answer.", translation: "我知道答案。" }] },
  { word: "think", phonetic: "/θɪŋk/", definitions: [{ pos: "v.", meaning: "想，认为" }], phrases: [{ phrase: "think about", meaning: "考虑" }, { phrase: "think of", meaning: "想起" }], examples: [{ sentence: "I think therefore I am.", translation: "我思故我在。" }] },
  { word: "take", phonetic: "/teɪk/", definitions: [{ pos: "v.", meaning: "拿，取，花费" }], phrases: [{ phrase: "take care", meaning: "保重" }, { phrase: "take place", meaning: "发生" }], examples: [{ sentence: "Please take a seat.", translation: "请坐。" }] },
  { word: "see", phonetic: "/siː/", definitions: [{ pos: "v.", meaning: "看见，理解" }], phrases: [{ phrase: "see you", meaning: "再见" }, { phrase: "see to", meaning: "处理" }], examples: [{ sentence: "I see what you mean.", translation: "我明白你的意思。" }] },
  { word: "come", phonetic: "/kʌm/", definitions: [{ pos: "v.", meaning: "来" }], phrases: [{ phrase: "come back", meaning: "回来" }, { phrase: "come up with", meaning: "想出" }], examples: [{ sentence: "Come here, please.", translation: "请过来。" }] },
  { word: "want", phonetic: "/wɑːnt/", definitions: [{ pos: "v.", meaning: "想要" }], phrases: [{ phrase: "want to", meaning: "想要..." }], examples: [{ sentence: "I want to learn English.", translation: "我想学英语。" }] },
  { word: "look", phonetic: "/lʊk/", definitions: [{ pos: "v.", meaning: "看" }, { pos: "n.", meaning: "样子" }], phrases: [{ phrase: "look for", meaning: "寻找" }, { phrase: "look after", meaning: "照顾" }], examples: [{ sentence: "Look at the beautiful sky.", translation: "看美丽的天空。" }] },
  { word: "use", phonetic: "/juːz/", definitions: [{ pos: "v.", meaning: "使用" }, { pos: "n.", meaning: "用途" }], phrases: [{ phrase: "make use of", meaning: "利用" }], examples: [{ sentence: "Can I use your pen?", translation: "我能用你的笔吗？" }] },
  { word: "find", phonetic: "/faɪnd/", definitions: [{ pos: "v.", meaning: "找到，发现" }], phrases: [{ phrase: "find out", meaning: "查明" }], examples: [{ sentence: "I can't find my keys.", translation: "我找不到我的钥匙了。" }] },
  { word: "give", phonetic: "/ɡɪv/", definitions: [{ pos: "v.", meaning: "给" }], phrases: [{ phrase: "give up", meaning: "放弃" }, { phrase: "give away", meaning: "赠送" }], examples: [{ sentence: "Give me a hand, please.", translation: "请帮我一下。" }] },
  { word: "tell", phonetic: "/tel/", definitions: [{ pos: "v.", meaning: "告诉，分辨" }], phrases: [{ phrase: "tell the truth", meaning: "说实话" }], examples: [{ sentence: "Tell me a story.", translation: "给我讲个故事。" }] },
  { word: "work", phonetic: "/wɜːrk/", definitions: [{ pos: "v.", meaning: "工作" }, { pos: "n.", meaning: "工作" }], phrases: [{ phrase: "at work", meaning: "在工作" }, { phrase: "work out", meaning: "解决；锻炼" }], examples: [{ sentence: "I work in an office.", translation: "我在办公室工作。" }] },
  { word: "call", phonetic: "/kɔːl/", definitions: [{ pos: "v.", meaning: "叫，打电话" }, { pos: "n.", meaning: "电话" }], phrases: [{ phrase: "call back", meaning: "回电话" }, { phrase: "call for", meaning: "需要" }], examples: [{ sentence: "I'll call you tomorrow.", translation: "我明天给你打电话。" }] },
  { word: "try", phonetic: "/traɪ/", definitions: [{ pos: "v.", meaning: "尝试，努力" }], phrases: [{ phrase: "try on", meaning: "试穿" }, { phrase: "try out", meaning: "试验" }], examples: [{ sentence: "Don't be afraid to try.", translation: "不要害怕尝试。" }] },
  { word: "need", phonetic: "/niːd/", definitions: [{ pos: "v./n.", meaning: "需要" }], phrases: [{ phrase: "in need", meaning: "在困难中" }], examples: [{ sentence: "I need your help.", translation: "我需要你的帮助。" }] },
  { word: "feel", phonetic: "/fiːl/", definitions: [{ pos: "v.", meaning: "感觉，觉得" }], phrases: [{ phrase: "feel like", meaning: "想要" }], examples: [{ sentence: "I feel happy today.", translation: "我今天感觉很开心。" }] },
  { word: "become", phonetic: "/bɪˈkʌm/", definitions: [{ pos: "v.", meaning: "变成，成为" }], phrases: [{ phrase: "become aware of", meaning: "意识到" }], examples: [{ sentence: "She wants to become a doctor.", translation: "她想成为一名医生。" }] },
  { word: "leave", phonetic: "/liːv/", definitions: [{ pos: "v.", meaning: "离开，留下" }], phrases: [{ phrase: "leave out", meaning: "遗漏" }, { phrase: "leave behind", meaning: "留下" }], examples: [{ sentence: "Please leave the door open.", translation: "请让门开着。" }] },
  { word: "put", phonetic: "/pʊt/", definitions: [{ pos: "v.", meaning: "放，放置" }], phrases: [{ phrase: "put on", meaning: "穿上" }, { phrase: "put off", meaning: "推迟" }], examples: [{ sentence: "Put the book on the table.", translation: "把书放在桌上。" }] },
  { word: "mean", phonetic: "/miːn/", definitions: [{ pos: "v.", meaning: "意思是，意味着" }, { pos: "adj.", meaning: "吝啬的" }], phrases: [{ phrase: "mean to", meaning: "打算" }], examples: [{ sentence: "What does this word mean?", translation: "这个词是什么意思？" }] },
  { word: "keep", phonetic: "/kiːp/", definitions: [{ pos: "v.", meaning: "保持，保留" }], phrases: [{ phrase: "keep up", meaning: "保持" }, { phrase: "keep on", meaning: "继续" }], examples: [{ sentence: "Keep calm and carry on.", translation: "保持冷静，继续前进。" }] },
  { word: "let", phonetic: "/let/", definitions: [{ pos: "v.", meaning: "让，允许" }], phrases: [{ phrase: "let go", meaning: "放手" }, { phrase: "let alone", meaning: "更不用说" }], examples: [{ sentence: "Let me help you.", translation: "让我帮你。" }] },
  { word: "begin", phonetic: "/bɪˈɡɪn/", definitions: [{ pos: "v.", meaning: "开始" }], phrases: [{ phrase: "begin with", meaning: "以...开始" }], examples: [{ sentence: "Let's begin the meeting.", translation: "让我们开始会议吧。" }] },
];

async function seed() {
  console.log("Starting seed...");

  // Insert libraries
  for (const lib of libraries) {
    await db.insert(wordLibraries).values(lib);
  }
  console.log(`Inserted ${libraries.length} libraries`);

  // Get all inserted libraries
  const allLibs = await db.select().from(wordLibraries);
  const libMap: Record<string, number> = {};
  for (const lib of allLibs) {
    libMap[lib.category!] = lib.id;
  }

  async function insertWordsForLib(wordList: typeof cet4Words, category: string) {
    const libId = libMap[category];
    if (!libId) return;

    // Batch insert words
    const inserted = await db.insert(words).values(wordList);
    const firstId = Number(inserted[0].insertId);

    // Create library-word associations
    const associations = wordList.map((_, i) => ({
      libraryId: libId,
      wordId: firstId + i,
    }));
    await db.insert(libraryWords).values(associations);

    // Update word count
    await db.update(wordLibraries)
      .set({ wordCount: wordList.length })
      .where(eq(wordLibraries.id, libId));

    console.log(`Inserted ${wordList.length} words for ${category}`);
  }

  await insertWordsForLib(cet4Words, "cet4");
  await insertWordsForLib(cet6Words, "cet6");
  await insertWordsForLib(toeflWords, "toefl");
  await insertWordsForLib(ieltsWords, "ielts");
  await insertWordsForLib(tem8Words, "tem8");
  await insertWordsForLib(becWords, "bec");
  await insertWordsForLib(highSchoolWords, "high_school");
  await insertWordsForLib(top10000Words, "top10000");

  console.log("Seed completed!");
}

seed().catch(console.error);
