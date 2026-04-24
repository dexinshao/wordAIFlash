import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const dbPath = process.env.DATABASE_URL?.replace("sqlite:", "") || "./data/wordflash.db";
const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// 创建表
db.exec(`
  CREATE TABLE IF NOT EXISTS word_libraries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT(100) NOT NULL,
    description TEXT,
    word_count INTEGER DEFAULT 0,
    category TEXT(50),
    is_builtin INTEGER DEFAULT 1,
    is_shared INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT(100) NOT NULL,
    phonetic TEXT(200),
    pronunciation_url TEXT(500),
    definitions TEXT,
    phrases TEXT,
    examples TEXT,
    frequency_rank INTEGER,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS library_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    library_id INTEGER NOT NULL REFERENCES word_libraries(id),
    word_id INTEGER NOT NULL REFERENCES words(id),
    added_at TEXT NOT NULL,
    UNIQUE(library_id, word_id)
  );

  CREATE TABLE IF NOT EXISTS word_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    word_id INTEGER NOT NULL,
    library_id INTEGER NOT NULL,
    mastery_score REAL DEFAULT 0,
    last_feedback TEXT(20),
    review_count INTEGER DEFAULT 0,
    streak_correct INTEGER DEFAULT 0,
    is_mastered INTEGER DEFAULT 0,
    last_reviewed_at TEXT,
    next_review_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, word_id, library_id)
  );
`);

// 清空数据
db.exec("DELETE FROM library_words");
db.exec("DELETE FROM word_progress");
db.exec("DELETE FROM words");
db.exec("DELETE FROM word_libraries");

const now = new Date().toISOString();

// 插入词库
const libs = [
  ["四级词汇", "大学英语四级考试核心词汇", "cet4"],
  ["六级词汇", "大学英语六级考试核心词汇", "cet6"],
  ["托福词汇", "托福考试必备词汇", "toefl"],
  ["雅思词汇", "雅思考试高频词汇", "ielts"],
  ["英语八级", "英语专业八级考试词汇", "tem8"],
  ["BEC商务", "商务英语考试核心词汇", "bec"],
  ["高中词汇", "高考英语大纲词汇", "high_school"],
  ["高频10000", "全球文本词频前10000单词", "top10000"],
];

const insertLib = db.prepare(
  "INSERT INTO word_libraries (name, description, category, is_builtin, word_count, created_at, updated_at) VALUES (?, ?, ?, 1, 0, ?, ?)"
);

for (const [name, desc, cat] of libs) {
  insertLib.run(name, desc, cat, now, now);
}

const libRows = db.prepare("SELECT id, category FROM word_libraries").all() as any[];
const libMap: Record<string, number> = {};
for (const r of libRows) libMap[r.category] = r.id;

// 插入单词
type WordEntry = [string, string, string, string, string];

const allData: { lib: string; words: WordEntry[] }[] = [
  {
    lib: "cet4",
    words: [
      ["abandon", "/əˈbændən/", '[{"pos":"v.","meaning":"放弃，抛弃"}]', '[{"phrase":"abandon ship","meaning":"弃船"}]', '[{"sentence":"The crew had to abandon the sinking ship.","translation":"船员们不得不弃船。"}]'],
      ["ability", "/əˈbɪləti/", '[{"pos":"n.","meaning":"能力，才能"}]', '[{"phrase":"have the ability to","meaning":"有能力做..."}]', '[{"sentence":"She has the ability to speak four languages.","translation":"她有能力说四种语言。"}]'],
      ["absence", "/ˈæbsəns/", '[{"pos":"n.","meaning":"缺席，缺乏"}]', '[{"phrase":"in the absence of","meaning":"在...不在时；缺乏"}]', '[{"sentence":"In the absence of any evidence, he was released.","translation":"在没有任何证据的情况下，他被释放了。"}]'],
      ["absolute", "/ˈæbsəluːt/", '[{"pos":"adj.","meaning":"绝对的，完全的"}]', '[{"phrase":"absolute zero","meaning":"绝对零度"}]', '[{"sentence":"I have absolute confidence in your ability.","translation":"我对你有绝对的信心。"}]'],
      ["absorb", "/əbˈsɔːrb/", '[{"pos":"v.","meaning":"吸收；使全神贯注"}]', '[{"phrase":"be absorbed in","meaning":"全神贯注于"}]', '[{"sentence":"The sponge can absorb a lot of water.","translation":"海绵能吸收大量的水。"}]'],
      ["abstract", "/ˈæbstrækt/", '[{"pos":"adj.","meaning":"抽象的"},{"pos":"n.","meaning":"摘要"}]', '[{"phrase":"abstract art","meaning":"抽象艺术"}]', '[{"sentence":"Truth and beauty are abstract concepts.","translation":"真理和美是抽象概念。"}]'],
      ["abundant", "/əˈbʌndənt/", '[{"pos":"adj.","meaning":"丰富的，大量的"}]', '[{"phrase":"abundant in","meaning":"富于..."}]', '[{"sentence":"The region is abundant in wildlife.","translation":"这个地区野生动物丰富。"}]'],
      ["academic", "/ˌækəˈdemɪk/", '[{"pos":"adj.","meaning":"学术的"}]', '[{"phrase":"academic year","meaning":"学年"}]', '[{"sentence":"She has a strong academic background.","translation":"她有很强的学术背景。"}]'],
      ["accelerate", "/əkˈseləreɪt/", '[{"pos":"v.","meaning":"加速，促进"}]', '[{"phrase":"accelerate growth","meaning":"加速增长"}]', '[{"sentence":"The car accelerated to overtake the bus.","translation":"汽车加速超越公交车。"}]'],
      ["accept", "/əkˈsept/", '[{"pos":"v.","meaning":"接受，同意"}]', '[{"phrase":"accept responsibility","meaning":"承担责任"}]', '[{"sentence":"I accept your apology.","translation":"我接受你的道歉。"}]'],
    ],
  },
  {
    lib: "cet6",
    words: [
      ["abnormal", "/æbˈnɔːrml/", '[{"pos":"adj.","meaning":"异常的，反常的"}]', '[{"phrase":"abnormal behavior","meaning":"异常行为"}]', '[{"sentence":"The test showed an abnormal level of cholesterol.","translation":"检测显示胆固醇水平异常。"}]'],
      ["abolish", "/əˈbɑːlɪʃ/", '[{"pos":"v.","meaning":"废除，取消"}]', '[{"phrase":"abolish slavery","meaning":"废除奴隶制"}]', '[{"sentence":"Slavery was abolished in the 19th century.","translation":"奴隶制在19世纪被废除。"}]'],
      ["abstract", "/ˈæbstrækt/", '[{"pos":"adj.","meaning":"抽象的"},{"pos":"n.","meaning":"摘要"}]', '[{"phrase":"abstract art","meaning":"抽象艺术"}]', '[{"sentence":"Truth and beauty are abstract concepts.","translation":"真理和美是抽象概念。"}]'],
      ["abundant", "/əˈbʌndənt/", '[{"pos":"adj.","meaning":"丰富的，大量的"}]', '[{"phrase":"abundant in","meaning":"富于..."}]', '[{"sentence":"The region is abundant in wildlife.","translation":"这个地区野生动物丰富。"}]'],
      ["accelerate", "/əkˈseləreɪt/", '[{"pos":"v.","meaning":"加速，促进"}]', '[{"phrase":"accelerate growth","meaning":"加速增长"}]', '[{"sentence":"The car accelerated to overtake the bus.","translation":"汽车加速超越公交车。"}]'],
      ["accommodate", "/əˈkɑːmədeɪt/", '[{"pos":"v.","meaning":"容纳；适应"}]', '[{"phrase":"accommodate to","meaning":"适应..."}]', '[{"sentence":"The hotel can accommodate 500 guests.","translation":"这家酒店能容纳500位客人。"}]'],
      ["accomplish", "/əˈkʌmplɪʃ/", '[{"pos":"v.","meaning":"完成，实现"}]', '[{"phrase":"accomplish a goal","meaning":"实现目标"}]', '[{"sentence":"We accomplished the task ahead of schedule.","translation":"我们提前完成了任务。"}]'],
      ["accumulate", "/əˈkjuːmjəleɪt/", '[{"pos":"v.","meaning":"积累，堆积"}]', '[{"phrase":"accumulate wealth","meaning":"积累财富"}]', '[{"sentence":"Dust accumulated on the bookshelf.","translation":"灰尘堆积在书架上。"}]'],
      ["accurate", "/ˈækjərət/", '[{"pos":"adj.","meaning":"精确的，准确的"}]', '[{"phrase":"accurate measurement","meaning":"精确测量"}]', '[{"sentence":"The weather forecast was quite accurate.","translation":"天气预报相当准确。"}]'],
      ["acknowledge", "/əkˈnɑːlɪdʒ/", '[{"pos":"v.","meaning":"承认，致谢"}]', '[{"phrase":"acknowledge receipt","meaning":"确认收到"}]', '[{"sentence":"He acknowledged his mistake.","translation":"他承认了自己的错误。"}]'],
    ],
  },
  {
    lib: "toefl",
    words: [
      ["aberration", "/ˌæbəˈreɪʃn/", '[{"pos":"n.","meaning":"异常，脱离常规"}]', '[{"phrase":"temporary aberration","meaning":"暂时性偏差"}]', '[{"sentence":"The drop in sales was just a temporary aberration.","translation":"销售额下降只是暂时的异常。"}]'],
      ["abhor", "/əbˈhɔːr/", '[{"pos":"v.","meaning":"憎恶，厌恶"}]', '[{"phrase":"abhor violence","meaning":"憎恶暴力"}]', '[{"sentence":"I abhor cruelty to animals.","translation":"我憎恶虐待动物。"}]'],
      ["abreast", "/əˈbrest/", '[{"pos":"adv.","meaning":"并肩地，并排"}]', '[{"phrase":"keep abreast of","meaning":"跟上，了解...最新情况"}]', '[{"sentence":"Keep abreast of the latest developments.","translation":"跟上最新的发展。"}]'],
      ["abrupt", "/əˈbrʌpt/", '[{"pos":"adj.","meaning":"突然的，唐突的"}]', '[{"phrase":"abrupt change","meaning":"突然变化"}]', '[{"sentence":"The bus came to an abrupt stop.","translation":"公交车突然停了下来。"}]'],
      ["absolve", "/əbˈzɑːlv/", '[{"pos":"v.","meaning":"赦免，免除"}]', '[{"phrase":"absolve from","meaning":"免除..."}]', '[{"sentence":"The court absolved him of all responsibility.","translation":"法院免除了他的一切责任。"}]'],
      ["abstain", "/əˈbˈsteɪn/", '[{"pos":"v.","meaning":"弃权；戒除"}]', '[{"phrase":"abstain from","meaning":"戒除..."}]', '[{"sentence":"He decided to abstain from voting.","translation":"他决定弃权投票。"}]'],
      ["abuse", "/əˈbjuːs/", '[{"pos":"n./v.","meaning":"滥用；虐待"}]', '[{"phrase":"drug abuse","meaning":"药物滥用"}]', '[{"sentence":"Child abuse is a serious problem.","translation":"虐待儿童是一个严重的问题。"}]'],
      ["accede", "/əkˈsiːd/", '[{"pos":"v.","meaning":"同意，加入"}]', '[{"phrase":"accede to","meaning":"同意..."}]', '[{"sentence":"The government acceded to the demands.","translation":"政府同意了要求。"}]'],
      ["acclaim", "/əˈkleɪm/", '[{"pos":"n./v.","meaning":"称赞，喝彩"}]', '[{"phrase":"critical acclaim","meaning":"评论界的好评"}]', '[{"sentence":"The film received widespread acclaim.","translation":"这部电影获得了广泛好评。"}]'],
      ["accomplice", "/əˈkʌmplɪs/", '[{"pos":"n.","meaning":"共犯，同谋"}]', '[{"phrase":"accomplice in crime","meaning":"犯罪同谋"}]', '[{"sentence":"He was arrested as an accomplice to murder.","translation":"他作为谋杀共犯被捕。"}]'],
    ],
  },
  {
    lib: "ielts",
    words: [
      ["abide", "/əˈbaɪd/", '[{"pos":"v.","meaning":"忍受，遵守"}]', '[{"phrase":"abide by","meaning":"遵守..."}]', '[{"sentence":"You must abide by the law.","translation":"你必须遵守法律。"}]'],
      ["abolition", "/ˌæbəˈlɪʃn/", '[{"pos":"n.","meaning":"废除，废止"}]', '[{"phrase":"abolition of slavery","meaning":"废除奴隶制"}]', '[{"sentence":"The abolition of slavery was a milestone.","translation":"废除奴隶制是一个里程碑。"}]'],
      ["abound", "/əˈbaʊnd/", '[{"pos":"v.","meaning":"大量存在，充满"}]', '[{"phrase":"abound with","meaning":"充满..."}]', '[{"sentence":"The forest abounds with wildlife.","translation":"森林里野生动物众多。"}]'],
      ["abundance", "/əˈbʌndəns/", '[{"pos":"n.","meaning":"丰富，充裕"}]', '[{"phrase":"in abundance","meaning":"丰富地"}]', '[{"sentence":"The region has an abundance of natural resources.","translation":"这个地区有丰富的自然资源。"}]'],
      ["accessible", "/əkˈsesəbl/", '[{"pos":"adj.","meaning":"可到达的，易接近的"}]', '[{"phrase":"accessible to","meaning":"对...可接近"}]', '[{"sentence":"The museum is accessible to wheelchair users.","translation":"轮椅使用者可以进入博物馆。"}]'],
      ["accommodating", "/əˈkɑːmədeɪtɪŋ/", '[{"pos":"adj.","meaning":"乐于助人的，随和的"}]', '[{"phrase":"accommodating attitude","meaning":"随和的态度"}]', '[{"sentence":"The staff were very accommodating.","translation":"员工非常乐于助人。"}]'],
      ["accomplishment", "/əˈkʌmplɪʃmənt/", '[{"pos":"n.","meaning":"成就，完成"}]', '[{"phrase":"sense of accomplishment","meaning":"成就感"}]', '[{"sentence":"Finishing the marathon was a real accomplishment.","translation":"完成马拉松是一项真正的成就。"}]'],
      ["accustomed", "/əˈkʌstəmd/", '[{"pos":"adj.","meaning":"习惯的"}]', '[{"phrase":"be accustomed to","meaning":"习惯于..."}]', '[{"sentence":"I am accustomed to getting up early.","translation":"我习惯早起。"}]'],
      ["achievement", "/əˈtʃiːvmənt/", '[{"pos":"n.","meaning":"成就，成绩"}]', '[{"phrase":"sense of achievement","meaning":"成就感"}]', '[{"sentence":"Winning the medal was a great achievement.","translation":"赢得奖牌是一项伟大的成就。"}]'],
      ["adaptation", "/ˌædæpˈteɪʃn/", '[{"pos":"n.","meaning":"适应，改编"}]', '[{"phrase":"adaptation to","meaning":"对...的适应"}]', '[{"sentence":"The film is an adaptation of a novel.","translation":"这部电影改编自一部小说。"}]'],
    ],
  },
  {
    lib: "tem8",
    words: [
      ["abeyance", "/əˈbeɪəns/", '[{"pos":"n.","meaning":"中止，暂停"}]', '[{"phrase":"in abeyance","meaning":"暂停中"}]', '[{"sentence":"The plan is in abeyance until funding is secured.","translation":"该计划暂停执行，直到资金到位。"}]'],
      ["abjure", "/əbˈdʒʊr/", '[{"pos":"v.","meaning":"发誓放弃，公开放弃"}]', '[{"phrase":"abjure ones religion","meaning":"放弃宗教信仰"}]', '[{"sentence":"He abjured his former beliefs.","translation":"他发誓放弃以前的信仰。"}]'],
      ["abnegation", "/ˌæbnɪˈɡeɪʃn/", '[{"pos":"n.","meaning":"克制，放弃"}]', '[{"phrase":"self-abnegation","meaning":"自我克制"}]', '[{"sentence":"Her life was one of self-abnegation.","translation":"她的一生是自我克制的一生。"}]'],
      ["abrogate", "/ˈæbrəɡeɪt/", '[{"pos":"v.","meaning":"废除（法律等）"}]', '[{"phrase":"abrogate a treaty","meaning":"废除条约"}]', '[{"sentence":"The government abrogated the old law.","translation":"政府废除了旧法律。"}]'],
      ["abscond", "/əbˈskɑːnd/", '[{"pos":"v.","meaning":"潜逃，逃避"}]', '[{"phrase":"abscond with","meaning":"携带...潜逃"}]', '[{"sentence":"The treasurer absconded with the funds.","translation":"财务主管携带资金潜逃了。"}]'],
      ["absolution", "/ˌæbsəˈluːʃn/", '[{"pos":"n.","meaning":"赦免，免罪"}]', '[{"phrase":"grant absolution","meaning":"给予赦免"}]', '[{"sentence":"He sought absolution for his sins.","translation":"他寻求对他罪行的赦免。"}]'],
      ["accolade", "/ˈækəleɪd/", '[{"pos":"n.","meaning":"荣誉，嘉奖"}]', '[{"phrase":"receive accolades","meaning":"获得荣誉"}]', '[{"sentence":"The film received numerous accolades.","translation":"这部电影获得了众多荣誉。"}]'],
      ["acrimonious", "/ˌækrɪˈmoʊniəs/", '[{"pos":"adj.","meaning":"尖刻的，激烈的"}]', '[{"phrase":"acrimonious dispute","meaning":"激烈争论"}]', '[{"sentence":"The divorce was acrimonious.","translation":"这场离婚充满敌意。"}]'],
      ["adjudicate", "/əˈdʒuːdɪkeɪt/", '[{"pos":"v.","meaning":"判决，裁定"}]', '[{"phrase":"adjudicate a dispute","meaning":"裁决争端"}]', '[{"sentence":"The court will adjudicate the case next week.","translation":"法庭将于下周审理此案。"}]'],
      ["aegis", "/ˈiːdʒɪs/", '[{"pos":"n.","meaning":"保护，庇护"}]', '[{"phrase":"under the aegis of","meaning":"在...的庇护下"}]', '[{"sentence":"The project was conducted under the aegis of UNESCO.","translation":"该项目在联合国教科文组织的支持下进行。"}]'],
    ],
  },
  {
    lib: "bec",
    words: [
      ["acquisition", "/ˌækwɪˈzɪʃn/", '[{"pos":"n.","meaning":"收购，并购"}]', '[{"phrase":"merger and acquisition","meaning":"兼并与收购"}]', '[{"sentence":"The acquisition of the rival company cost $2 billion.","translation":"收购竞争对手的公司花费了20亿美元。"}]'],
      ["aggregate", "/ˈæɡrɪɡət/", '[{"pos":"n.","meaning":"总计，合计"},{"pos":"adj.","meaning":"合计的"}]', '[{"phrase":"in the aggregate","meaning":"总体上"}]', '[{"sentence":"The aggregate sales exceeded our targets.","translation":"总销售额超过了我们的目标。"}]'],
      ["asset", "/ˈæset/", '[{"pos":"n.","meaning":"资产，财产"}]', '[{"phrase":"fixed asset","meaning":"固定资产"}]', '[{"sentence":"Real estate is considered a stable long-term asset.","translation":"房地产被认为是稳定的长期资产。"}]'],
      ["audit", "/ˈɔːdɪt/", '[{"pos":"n./v.","meaning":"审计，审查"}]', '[{"phrase":"annual audit","meaning":"年度审计"}]', '[{"sentence":"The financial statements are subject to annual audit.","translation":"财务报表需接受年度审计。"}]'],
      ["benchmark", "/ˈbentʃmɑːk/", '[{"pos":"n.","meaning":"基准，标杆"}]', '[{"phrase":"benchmark against","meaning":"以...为基准"}]', '[{"sentence":"We benchmark our performance against industry leaders.","translation":"我们以行业领导者为基准评估我们的表现。"}]'],
      ["bond", "/bɑːnd/", '[{"pos":"n.","meaning":"债券，契约"}]', '[{"phrase":"government bond","meaning":"政府债券"}]', '[{"sentence":"The company issued bonds to raise capital.","translation":"公司发行债券以筹集资金。"}]'],
      ["capital", "/ˈkæpɪtl/", '[{"pos":"n.","meaning":"资本，资金"}]', '[{"phrase":"working capital","meaning":"营运资本"}]', '[{"sentence":"We need more capital to expand the business.","translation":"我们需要更多资金来扩展业务。"}]'],
      ["commodity", "/kəˈmɑːdəti/", '[{"pos":"n.","meaning":"商品，原材料"}]', '[{"phrase":"commodity market","meaning":"商品市场"}]', '[{"sentence":"Oil is the most traded commodity in the world.","translation":"石油是世界上交易量最大的商品。"}]'],
      ["deficit", "/ˈdefɪsɪt/", '[{"pos":"n.","meaning":"赤字，逆差"}]', '[{"phrase":"trade deficit","meaning":"贸易逆差"}]', '[{"sentence":"The country faces a growing trade deficit.","translation":"该国面临日益增长的贸易逆差。"}]'],
      ["merger", "/ˈmɜːrdʒər/", '[{"pos":"n.","meaning":"合并，兼并"}]', '[{"phrase":"merger and acquisition","meaning":"兼并与收购"}]', '[{"sentence":"The merger created the largest bank in the country.","translation":"合并创建了全国最大的银行。"}]'],
    ],
  },
  {
    lib: "high_school",
    words: [
      ["apple", "/ˈæpl/", '[{"pos":"n.","meaning":"苹果"}]', '[{"phrase":"apple tree","meaning":"苹果树"}]', '[{"sentence":"An apple a day keeps the doctor away.","translation":"一天一苹果，医生远离我。"}]'],
      ["beautiful", "/ˈbjuːtɪfl/", '[{"pos":"adj.","meaning":"美丽的"}]', '[{"phrase":"beautiful scenery","meaning":"美丽的风景"}]', '[{"sentence":"The sunset was beautiful.","translation":"日落很美。"}]'],
      ["challenge", "/ˈtʃælɪndʒ/", '[{"pos":"n.","meaning":"挑战"},{"pos":"v.","meaning":"挑战"}]', '[{"phrase":"face a challenge","meaning":"面对挑战"}]', '[{"sentence":"Learning a new language is a challenge.","translation":"学习一门新语言是一个挑战。"}]'],
      ["education", "/ˌedʒuˈkeɪʃn/", '[{"pos":"n.","meaning":"教育"}]', '[{"phrase":"higher education","meaning":"高等教育"}]', '[{"sentence":"Education is the key to success.","translation":"教育是成功的关键。"}]'],
      ["friend", "/frend/", '[{"pos":"n.","meaning":"朋友"}]', '[{"phrase":"best friend","meaning":"最好的朋友"}]', '[{"sentence":"A friend in need is a friend indeed.","translation":"患难见真情。"}]'],
      ["global", "/ˈɡloʊbl/", '[{"pos":"adj.","meaning":"全球的"}]', '[{"phrase":"global warming","meaning":"全球变暖"}]', '[{"sentence":"Climate change is a global issue.","translation":"气候变化是一个全球性问题。"}]'],
      ["improve", "/ɪmˈpruːv/", '[{"pos":"v.","meaning":"改善，提高"}]', '[{"phrase":"improve English","meaning":"提高英语"}]', '[{"sentence":"Practice will improve your skills.","translation":"练习会提高你的技能。"}]'],
      ["knowledge", "/ˈnɑːlɪdʒ/", '[{"pos":"n.","meaning":"知识"}]', '[{"phrase":"gain knowledge","meaning":"获取知识"}]', '[{"sentence":"Knowledge is power.","translation":"知识就是力量。"}]'],
      ["success", "/səkˈses/", '[{"pos":"n.","meaning":"成功"}]', '[{"phrase":"key to success","meaning":"成功的关键"}]', '[{"sentence":"Hard work leads to success.","translation":"努力工作通向成功。"}]'],
      ["technology", "/tekˈnɑːlədʒi/", '[{"pos":"n.","meaning":"技术"}]', '[{"phrase":"information technology","meaning":"信息技术"}]', '[{"sentence":"Technology is changing our lives.","translation":"技术正在改变我们的生活。"}]'],
    ],
  },
  {
    lib: "top10000",
    words: [
      ["the", "/ðə; ðiː/", '[{"pos":"art.","meaning":"这，那（定冠词）"}]', "[]", '[{"sentence":"The sun rises in the east.","translation":"太阳从东方升起。"}]'],
      ["have", "/hæv; həv/", '[{"pos":"v.","meaning":"有，拥有"}]', '[{"phrase":"have to","meaning":"必须"}]', '[{"sentence":"I have a dream.","translation":"我有一个梦想。"}]'],
      ["make", "/meɪk/", '[{"pos":"v.","meaning":"制作，使"}]', '[{"phrase":"make sense","meaning":"有意义"}]', '[{"sentence":"Let us make a plan.","translation":"我们制定一个计划吧。"}]'],
      ["know", "/noʊ/", '[{"pos":"v.","meaning":"知道，了解"}]', '[{"phrase":"as far as I know","meaning":"据我所知"}]', '[{"sentence":"I know the answer.","translation":"我知道答案。"}]'],
      ["think", "/θɪŋk/", '[{"pos":"v.","meaning":"想，认为"}]', '[{"phrase":"think about","meaning":"考虑"}]', '[{"sentence":"I think therefore I am.","translation":"我思故我在。"}]'],
      ["take", "/teɪk/", '[{"pos":"v.","meaning":"拿，取，花费"}]', '[{"phrase":"take care","meaning":"保重"}]', '[{"sentence":"Please take a seat.","translation":"请坐。"}]'],
      ["come", "/kʌm/", '[{"pos":"v.","meaning":"来"}]', '[{"phrase":"come back","meaning":"回来"}]', '[{"sentence":"Come here, please.","translation":"请过来。"}]'],
      ["work", "/wɜːrk/", '[{"pos":"v.","meaning":"工作"},{"pos":"n.","meaning":"工作"}]', '[{"phrase":"work out","meaning":"解决；锻炼"}]', '[{"sentence":"I work in an office.","translation":"我在办公室工作。"}]'],
      ["give", "/ɡɪv/", '[{"pos":"v.","meaning":"给"}]', '[{"phrase":"give up","meaning":"放弃"}]', '[{"sentence":"Give me a hand, please.","translation":"请帮我一下。"}]'],
      ["keep", "/kiːp/", '[{"pos":"v.","meaning":"保持，保留"}]', '[{"phrase":"keep up","meaning":"保持"}]', '[{"sentence":"Keep calm and carry on.","translation":"保持冷静，继续前进。"}]'],
    ],
  },
];

const insertWord = db.prepare(
  "INSERT INTO words (word, phonetic, definitions, phrases, examples, created_at) VALUES (?, ?, ?, ?, ?, ?)"
);
const insertLink = db.prepare(
  "INSERT INTO library_words (library_id, word_id, added_at) VALUES (?, ?, ?)"
);
const updateLibCount = db.prepare(
  "UPDATE word_libraries SET word_count = ? WHERE id = ?"
);

const insertMany = db.transaction((libId: number, words: WordEntry[]) => {
  const wordIds: number[] = [];
  for (const [word, phonetic, definitions, phrases, examples] of words) {
    const result = insertWord.run(word, phonetic, definitions, phrases, examples, now);
    wordIds.push(Number(result.lastInsertRowid));
  }
  for (const wordId of wordIds) {
    insertLink.run(libId, wordId, now);
  }
  updateLibCount.run(words.length, libId);
  console.log(`  Inserted ${words.length} words`);
});

console.log("Seeding database...");
for (const group of allData) {
  const libId = libMap[group.lib];
  console.log(`Library: ${group.lib} (id=${libId})`);
  insertMany(libId, group.words);
}

db.close();
console.log("Seed completed!");
