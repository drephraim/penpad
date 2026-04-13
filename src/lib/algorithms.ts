import Typo from 'typo-js';
import { StylometryEngine, StylometryProfile } from './stylometry';
import { getProfile, saveProfile, learnPattern, getSuppressedPatterns } from './db';

export interface Suggestion {
  type: 'grammar' | 'spelling' | 'style';
  original: string;
  replacement: string;
  explanation: string;
  position?: {
    start: number;
    end: number;
    line: number;
    column: number;
  };
}

const WORDY_PHRASES: Record<string, string> = {
  'in order to': 'to',
  'due to the fact that': 'because',
  'a large number of': 'many',
  'at this point in time': 'now',
  'is able to': 'can',
  'has the ability to': 'can',
  'prior to': 'before',
  'subsequent to': 'after',
  'with the exception of': 'except',
  'absolutely essential': 'essential',
  'actual facts': 'facts',
  'basic fundamentals': 'fundamentals',
  'a lot of': 'many',
  'in the event that': 'if',
  'at which time': 'when',
  'for the purpose of': 'for',
  'in spite of the fact that': 'although',
  'with regard to': 'about',
};

const HOMOPHONES: Record<string, string[]> = {
  'their': ['there', 'they\'re'],
  'there': ['their', 'they\'re'],
  'they\'re': ['their', 'there'],
  'your': ['you\'re'],
  'you\'re': ['your'],
  'its': ['it\'s'],
  'it\'s': ['its'],
  'affect': ['effect'],
  'effect': ['affect'],
  'than': ['then'],
  'then': ['than'],
  'loose': ['lose'],
  'lose': ['loose'],
  'principal': ['principle'],
  'principle': ['principal'],
  'weather': ['whether'],
  'whether': ['weather'],
  'accept': ['except'],
  'except': ['accept'],
  'altar': ['alter'],
  'alter': ['altar'],
  'bare': ['bear'],
  'bear': ['bare'],
  'board': ['bored'],
  'bored': ['board'],
  'by': ['buy'],
  'buy': ['by'],
  'cite': ['site', 'sight'],
  'site': ['cite', 'sight'],
  'sight': ['cite', 'site'],
  'desert': ['dessert'],
  'dessert': ['desert'],
  'ensure': ['insure', 'assure'],
  'insure': ['ensure', 'assure'],
  'assure': ['ensure', 'insure'],
  'fewer': ['less'],
  'lead': ['led'],
  'led': ['lead'],
  'meat': ['meet', 'met'],
  'meet': ['meat', 'met'],
  'met': ['meat', 'meet'],
  'passed': ['past'],
  'past': ['passed'],
  'quiet': ['quite'],
  'quite': ['quiet'],
  'right': ['write', 'rite'],
  'rite': ['right', 'write'],
  'stationary': ['stationery'],
  'stationery': ['stationary'],
  'threw': ['through'],
  'through': ['threw'],
  'waist': ['waste'],
  'waste': ['waist'],
  'weak': ['week'],
  'week': ['weak'],
  'who\'s': ['whose'],
  'whose': ['who\'s'],
  'role': ['roll'],
  'roll': ['role'],
  'slow': ['sloe'],
  'sloe': ['slow'],
  'vain': ['vane', 'vein'],
  'vane': ['vain', 'vein'],
  'vein': ['vain', 'vane'],
  'wander': ['wonder'],
  'wonder': ['wander'],
};

const COMMON_MISSPELLINGS: Record<string, string> = {
  'recieve': 'receive',
  'accomodate': 'accommodate',
  'occurence': 'occurrence',
  'seperate': 'separate',
  'definately': 'definitely',
  'occured': 'occurred',
  'untill': 'until',
  'tommorow': 'tomorrow',
  'writting': 'writing',
  'neccessary': 'necessary',
  'wierd': 'weird',
  'alot': 'a lot',
  'goverment': 'government',
  'enviroment': 'environment',
  'begining': 'beginning',
  'beleive': 'believe',
  'calender': 'calendar',
  'concious': 'conscious',
  'develope': 'develop',
  'dissapoint': 'disappoint',
  'embarass': 'embarrass',
  'existance': 'existence',
  'freind': 'friend',
  'grammer': 'grammar',
  'happend': 'happened',
  'immediatly': 'immediately',
  'independant': 'independent',
  'knowlege': 'knowledge',
  'liason': 'liaison',
  'maintainance': 'maintenance',
  'mispell': 'misspell',
  'occassion': 'occasion',
  'persistant': 'persistent',
  'posession': 'possession',
  'prefered': 'preferred',
  'priviledge': 'privilege',
  'probly': 'probably',
  'profesional': 'professional',
  'publically': 'publicly',
  'recomend': 'recommend',
  'refered': 'referred',
  'relevent': 'relevant',
  'rythm': 'rhythm',
  'succesful': 'successful',
  'suprise': 'surprise',
  'truely': 'truly',
  'usefull': 'useful',
  'writen': 'written',
  'animale': 'animals',
  'ciites': 'cities',
  'ciity': 'city',
  'humaan': 'human',
  'acheive': 'achieve',
  'acquaintence': 'acquaintance',
  'agressive': 'aggressive',
  'apparant': 'apparent',
  'arguement': 'argument',
  'assasin': 'assassin',
  'assisstant': 'assistant',
  'bizare': 'bizarre',
  'catagory': 'category',
  'collegue': 'colleague',
  'colum': 'column',
  'comming': 'coming',
  'commitee': 'committee',
  'completly': 'completely',
  'concensus': 'consensus',
  'consistant': 'consistent',
  'consultent': 'consultant',
  'conveniant': 'convenient',
  'corectly': 'correctly',
  'criterias': 'criteria',
  'curiousity': 'curiosity',
  'deffinitive': 'definitive',
  'diffrent': 'different',
  'dimention': 'dimension',
  'direful': 'dire',
  'disapointed': 'disappointed',
  'disaprove': 'disapprove',
  'distroy': 'destroy',
  'divsion': 'division',
  'doccument': 'document',
  'dosnt': 'doesn\'t',
  'drived': 'driven',
  'efficent': 'efficient',
  'efort': 'effort',
  'eleminate': 'eliminate',
  'eligable': 'eligible',
  'embarassment': 'embarrassment',
  'exagerate': 'exaggerate',
  'excellant': 'excellent',
  'experiance': 'experience',
  'expermint': 'experiment',
  'explanitory': 'explanatory',
  'extention': 'extension',
  'faciliy': 'facility',
  'firey': 'fiery',
  'flourescent': 'fluorescent',
  'foriegn': 'foreign',
  'fourty': 'forty',
  'freindship': 'friendship',
  'fustrate': 'frustrate',
  'galatic': 'galactic',
  'governer': 'governor',
  'gratefull': 'grateful',
  'guage': 'gauge',
  'guidence': 'guidance',
  'harrass': 'harass',
  'heathy': 'healthy',
  'hieght': 'height',
  'humerous': 'humorous',
  'hygene': 'hygiene',
  'hypocracy': 'hypocrisy',
  'idealogy': 'ideology',
  'ignorrant': 'ignorant',
  'imigination': 'imagination',
  'immediatley': 'immediately',
  'importent': 'important',
  'impossable': 'impossible',
  'impressario': 'impresario',
  'indespensible': 'indispensable',
  'influance': 'influence',
  'inital': 'initial',
  'insistant': 'insistent',
  'intelegent': 'intelligent',
  'interupt': 'interrupt',
  'intresting': 'interesting',
  'irritible': 'irritable',
  'jewelary': 'jewelry',
  'judgement': 'judgment',
  'knwo': 'know',
  'langauge': 'language',
  'lazer': 'laser',
  'leasur': 'leisure',
  'legitamate': 'legitimate',
  'lieing': 'lying',
  'littel': 'little',
  'lonley': 'lonely',
  'lways': 'always',
  'magnificient': 'magnificent',
  'mange': 'manage',
  'manger': 'manager',
  'manuever': 'maneuver',
  'mispelled': 'misspelled',
  'misstold': 'misdirected',
  'mkae': 'make',
  'morgage': 'mortgage',
  'motiviated': 'motivated',
  'mous': 'mouse',
  'mroe': 'more',
  'muscial': 'musical',
  'myster': 'mystery',
  'narrow minded': 'narrow-minded',
  'neice': 'niece',
  'neighbour': 'neighbor',
  'nevertheles': 'nevertheless',
  'nickle': 'nickel',
  'ninteen': 'nineteen',
  'ninty': 'ninety',
  'nkow': 'know',
  'noticable': 'noticeable',
  'ommision': 'omission',
  'ommit': 'omit',
  'oppinion': 'opinion',
  'optomism': 'optimism',
  'originnaly': 'originally',
  'orser': 'order',
  'oustanding': 'outstanding',
  'pamplet': 'pamphlet',
  'paralell': 'parallel',
  'particualr': 'particular',
  'passerbys': 'passersby',
  'personel': 'personnel',
  'persue': 'pursue',
  'persued': 'pursued',
  'plausable': 'plausible',
  'pleasen': 'please',
  'politican': 'politician',
  'possable': 'possible',
  'possition': 'position',
  'practicle': 'practical',
  'preceder': 'predecessor',
  'precios': 'precious',
  'prejudism': 'prejudice',
  'prelud': 'prelude',
  'premptive': 'preemptive',
  'prerog': 'prerogative',
  'presedence': 'precedence',
  'presidental': 'presidential',
  'prespective': 'perspective',
  'prestigious': 'prestigious',
  'priveleges': 'privileges',
  'probalby': 'probably',
  'procastinate': 'procrastinate',
  'profesion': 'profession',
  'promiss': 'promise',
  'pronnounced': 'pronounced',
  'prophesize': 'prophesy',
  'protoge': 'protégé',
  'prouncements': 'pronouncements',
  'psuedo': 'pseudo',
  'psycology': 'psychology',
  'puchase': 'purchase',
  'qualafied': 'qualified',
  'quanitity': 'quantity',
  'quarenteen': 'quarantine',
  'questionaire': 'questionnaire',
  'realistically': 'realistically',
  'realy': 'really',
  'reccommend': 'recommend',
  'reccuring': 'recurring',
  'reciver': 'receiver',
  'reconize': 'recognize',
  'rediculous': 'ridiculous',
  'referer': 'referrer',
  'reffer': 'refer',
  'reguard': 'regard',
  'rehersal': 'rehearsal',
  'reigining': 'reigning',
  'rejuventate': 'rejuvenate',
  'releive': 'relieve',
  'releiver': 'reliever',
  'religous': 'religious',
  'rememberance': 'remembrance',
  'reommend': 'recommend',
  'repetion': 'repetition',
  'resevoir': 'reservoir',
  'resistable': 'resistible',
  'resourse': 'resource',
  'respct': 'respect',
  'restarant': 'restaurant',
  'resticted': 'restricted',
  'restuarant': 'restaurant',
  'reval': 'reveal',
  'revers': 'reverse',
  'rhythem': 'rhythm',
  'rigour': 'rigor',
  'rythem': 'rhythm',
  'sacreligious': 'sacrilegious',
  'sandwhich': 'sandwich',
  'savannah': 'savanna',
  'scenerio': 'scenario',
  'scholarhip': 'scholarship',
  'secreatary': 'secretary',
  'secretery': 'secretary',
  'sedary': 'sedentary',
  'seige': 'siege',
  'sercumstances': 'circumstances',
  'settelement': 'settlement',
  'severeal': 'several',
  'shieve': 'shelve',
  'shoudl': 'should',
  'shreik': 'shriek',
  'sieze': 'seize',
  'signifantly': 'significantly',
  'simplier': 'simpler',
  'simultanious': 'simultaneous',
  'sitisfy': 'satisfy',
  'situration': 'situation',
  'skateing': 'skating',
  'skeptic': 'skeptic',
  'skool': 'school',
  'slightely': 'slightly',
  'sliightly': 'slightly',
  'slippern': 'slippery',
  'slovene': 'Slovene',
  'smal': 'small',
  'smily': 'smiley',
  'smoothe': 'smooth',
  'snuck': 'snuck',
  'socia': 'social',
  'solie': 'solely',
  'sophmore': 'sophomore',
  'sorce': 'source',
  'sorrily': 'sorely',
  'speach': 'speech',
  'sponser': 'sponsor',
  'spontanious': 'spontaneous',
  'stnad': 'stand',
  'statment': 'statement',
  'stilus': 'stylus',
  'stopage': 'stoppage',
  'storeis': 'stories',
  'stoyr': 'story',
  'stpo': 'stop',
  'strat': 'start',
  'stregth': 'strength',
  'strik': 'strike',
  'stroy': 'story',
  'strugle': 'struggle',
  'stumbler': 'stumbler',
  'subpena': 'subpoena',
  'substanially': 'substantially',
  'successfull': 'successful',
  'suer': 'surgeon',
  'sufficent': 'sufficient',
  'superintendant': 'superintendent',
  'sphisticated': 'sophisticated',
  'surender': 'surrender',
  'surpose': 'purpose',
  'surprize': 'surprise',
  'tahn': 'than',
  'tang': 'tang',
  'tare': 'tear',
  'tatics': 'tactics',
  'teached': 'taught',
  'techniquely': 'technically',
  'teh': 'the',
  'temperment': 'temperament',
  'tennant': 'tenant',
  'teridicy': 'tragedy',
  'terriory': 'territory',
  'terrory': 'territory',
  'testiment': 'testament',
  'thanx': 'thanks',
  'theather': 'theater',
  'theif': 'thief',
  'themself': 'themselves',
  'themselfs': 'themselves',
  'thgat': 'that',
  'thier': 'their',
  'thikn': 'think',
  'thiunk': 'think',
  'thn': 'then',
  'thnk': 'think',
  'throug': 'through',
  'thsi': 'this',
  'thsoe': 'those',
  'tht': 'that',
  'thta': 'that',
  'thug': 'thug',
  'tibkan': 'tibetan',
  'tic': 'tic',
  'tielegraph': 'telegraph',
  'timne': 'time',
  'tobaco': 'tobacco',
  'togethr': 'together',
  'tolerence': 'tolerance',
  'tomatos': 'tomatoes',
  'tonite': 'tonight',
  'toyb': 'toy',
  'tradegy': 'tragedy',
  'tradtional': 'traditional',
  'trama': 'trauma',
  'traned': 'trained',
  'tranfer': 'transfer',
  'transfr': 'transfer',
  'transparancy': 'transparency',
  'tratomy': 'tragedy',
  'tremendious': 'tremendous',
  'treshold': 'threshold',
  'troug': 'through',
  'trueth': 'truth',
  'tryed': 'tried',
  'tunnle': 'tunnel',
  'twait': 'wait',
  'twelth': 'twelfth',
  'tyco': 'tycoon',
  'typel': 'type',
  'tyranical': 'tyrannical',
  'tyrany': 'tyranny',
  'uang': 'Uang',
  'ud': 'you would',
  'unabel': 'unable',
  'undescernible': 'indescribable',
  'undoubtably': 'undoubtedly',
  'unfortuntely': 'unfortunately',
  'unkown': 'unknown',
  'unlcear': 'unclear',
  'unoted': 'unnoted',
  'unprecendented': 'unprecedented',
  'unqie': 'unique',
  'unregenerate': 'unregenerate',
  'unrepentant': 'unrepentant',
  'unsuccessfull': 'unsuccessful',
  'usama': 'Usama',
  'useth': 'uses',
  'ustion': 'ustion',
  'ususal': 'usual',
  'ususally': 'usually',
  'vacum': 'vacuum',
  'valuble': 'valuable',
  'vanila': 'vanilla',
  'variaties': 'varieties',
  'varity': 'variety',
  'vaucum': 'vacuum',
  'vegitable': 'vegetable',
  'vegtable': 'vegetable',
  'veicle': 'vehicle',
  'venemous': 'venomous',
  'verbanage': 'verbiage',
  'vermillion': 'vermilion',
  'versitile': 'versatile',
  'viloin': 'violin',
  'viscious': 'vicious',
  'visibl': 'visible',
  'vulnerability': 'vulnerability',
  'wanna': 'want to',
  'wante': 'wants',
  'weaher': 'weather',
  'wel': 'well',
  'welcom': 'welcome',
  'wont': 'won\'t',
  'wordy': 'wordy',
  'yankee': 'Yankee',
  'wich': 'which',
  'yow': 'yow',
};

const CONTRACTIONS: Record<string, string> = {
  "don't": "do not",
  "doesn't": "does not",
  "didn't": "did not",
  "won't": "will not",
  "wouldn't": "would not",
  "can't": "cannot",
  "couldn't": "could not",
  "shouldn't": "should not",
  "isn't": "is not",
  "aren't": "are not",
  "wasn't": "was not",
  "weren't": "were not",
  "haven't": "have not",
  "hasn't": "has not",
  "hadn't": "had not",
  "i'm": "I am",
  "you're": "you are",
  "he's": "he is",
  "she's": "she is",
  "it's": "it is",
  "we're": "we are",
  "they're": "they are",
  "i've": "I have",
  "you've": "you have",
  "we've": "we have",
  "they've": "they have",
  "i'll": "I will",
  "you'll": "you will",
  "he'll": "he will",
  "she'll": "she will",
  "we'll": "we will",
  "they'll": "they will",
  "i'd": "I would",
  "you'd": "you would",
  "he'd": "he would",
  "she'd": "she would",
  "we'd": "we would",
  "they'd": "they would",
  "that's": "that is",
  "what's": "what is",
  "who's": "who is",
  "where's": "where is",
  "there's": "there is",
  "here's": "here is",
  "let's": "let us",
  "ain't": "am not",
  "gonna": "going to",
  "wanna": "want to",
  "gotta": "got to",
  "kinda": "kind of",
  "sorta": "sort of",
  "outta": "out of",
  "could've": "could have",
  "would've": "would have",
  "should've": "should have",
  "might've": "might have",
  "must've": "must have",
};

const DOUBLE_NEGATIVES = [
  /\bcan\'t\s+not\b/gi,
  /\bdon\'t\s+never\b/gi,
  /\bwon\'t\s+never\b/gi,
  /\bcannot\s+no\b/gi,
  /\bno\s+one\b.*\bdon\'t\b/gi,
  /\bnothing\s+don\'t\b/gi,
  /\bnowhere\s+don\'t\b/gi,
  /\bhardly\s+no\b/gi,
  /\bnever\s+no\b/gi,
];

const ARTICLE_RULES = [
  { pattern: /\ba\s+([aeiou])/gi, replacement: 'an $1', message: 'Use "an" before words starting with a vowel' },
  { pattern: /\ban\s+([bcdfghjklmnpqrstvwxyz])/gi, replacement: 'a $1', message: 'Use "a" before words starting with a consonant' },
];

const SENTENCE_STRUCTURE_PATTERNS = [
  { pattern: /\b(I|He|She|It|We|They)\s+(am|is)\s+/gi, message: 'Subject-verb agreement error' },
  { pattern: /\b(they|we|I)\s+(doesn't|doesn't|isn't|aren't|wasn't|weren't)\b/gi, message: 'Subject-verb agreement error' },
  { pattern: /\b(he|she|it)\s+(don't|doesn't|won't|wouldn't|can't|couldn't|shouldn't)\b/gi, message: 'Subject-verb agreement error' },
];

export class LocalIntelligence {
  private typo: Typo | null = null;
  private customDictionary: Set<string> = new Set();
  private engine: StylometryEngine = new StylometryEngine();
  private profile: StylometryProfile = {
    avgSentenceLength: 0,
    topNGrams: {},
    passiveRatio: 0
  };

  async init() {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('penpad_dict');
        if (saved) {
          try {
            const words = JSON.parse(saved);
            this.customDictionary = new Set(words);
          } catch (e) {
            console.error('Failed to parse custom dictionary', e);
          }
        }
        
        try {
          const loadedProfile = await getProfile('default_user');
          if (loadedProfile) {
            this.profile = loadedProfile;
          }
          const suppressed = await getSuppressedPatterns();
          suppressed.forEach(p => this.customDictionary.add(p.toLowerCase()));
        } catch (e) {
          console.warn('Could not load local DB, falling back to basic checks', e);
        }
      }

      const [affResponse, dicResponse] = await Promise.all([
        fetch('/dictionaries/en_US/en_US.aff'),
        fetch('/dictionaries/en_US/en_US.dic')
      ]);

      if (!affResponse.ok || !dicResponse.ok) throw new Error('Failed to load dictionary files');

      const affData = await affResponse.text();
      const dicData = await dicResponse.text();

      this.typo = new Typo("en_US", affData, dicData);
      console.log('LocalIntelligence initialized successfully');
      return true;
    } catch (error) {
      console.error('LocalIntelligence Init Error:', error);
      return false;
    }
  }

  async learnWord(word: string, type: 'spelling' | 'style' = 'spelling') {
    const lowerWord = word.toLowerCase();
    this.customDictionary.add(lowerWord);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('penpad_dict', JSON.stringify(Array.from(this.customDictionary)));
      
      try {
        await learnPattern(lowerWord, type === 'spelling' ? 'grammar' : 'style');
      } catch (e) {
        console.error('Failed to save learned pattern to DB', e);
      }
    }
  }

  async ingest(text: string) {
    if (typeof window === 'undefined') return;
    
    const newProfile = this.engine.analyze(text);
    this.profile = {
      avgSentenceLength: this.profile.avgSentenceLength === 0 ? newProfile.avgSentenceLength : (this.profile.avgSentenceLength * 0.7) + (newProfile.avgSentenceLength * 0.3),
      topNGrams: { ...this.profile.topNGrams, ...newProfile.topNGrams },
      passiveRatio: this.profile.passiveRatio === 0 ? newProfile.passiveRatio : (this.profile.passiveRatio * 0.7) + (newProfile.passiveRatio * 0.3)
    };
    
    try {
      await saveProfile({
        id: 'default_user',
        ...this.profile,
        lastUpdated: Date.now()
      });
    } catch (e) {
      console.error('Failed to save profile to DB', e);
    }
  }

  private getWordContext(text: string, word: string): string {
    const words = text.split(/\s+/);
    const index = words.findIndex(w => w.toLowerCase().includes(word.toLowerCase()));
    if (index === -1) return '';
    const start = Math.max(0, index - 2);
    const end = Math.min(words.length, index + 3);
    return words.slice(start, end).join(' ');
  }

  private checkCommonMisspellings(word: string): Suggestion | null {
    const lower = word.toLowerCase().replace(/['"]/g, '');
    
    if (COMMON_MISSPELLINGS[lower]) {
      return {
        type: 'spelling',
        original: word,
        replacement: COMMON_MISSPELLINGS[lower],
        explanation: `Common misspelling. Did you mean "${COMMON_MISSPELLINGS[lower]}"?`
      };
    }
    return null;
  }

  private checkHomophones(word: string): Suggestion | null {
    const lower = word.toLowerCase().replace(/['"]/g, '');
    
    if (HOMOPHONES[lower]) {
      const context = this.currentContext || '';
      let bestMatch = HOMOPHONES[lower][0];
      
      if (context) {
        const contextLower = context.toLowerCase();
        if (lower === 'their' && (contextLower.includes(' house') || contextLower.includes(' car') || contextLower.includes(' book'))) {
          bestMatch = 'their';
        } else if (lower === 'there' && (contextLower.includes(' is ') || contextLower.includes(' are ') || contextLower.includes(' was '))) {
          bestMatch = 'there';
        } else if (lower === 'they\'re' && (contextLower.includes(' going') || contextLower.includes(' coming') || contextLower.includes(' leaving'))) {
          bestMatch = 'they\'re';
        } else if (lower === 'your' && (contextLower.includes(' going') || contextLower.includes(' doing') || contextLower.includes(' coming'))) {
          bestMatch = 'you\'re';
        } else if (lower === 'you\'re' && (contextLower.includes(' book') || contextLower.includes(' house') || contextLower.includes(' car'))) {
          bestMatch = 'your';
        } else if (lower === 'its' && contextLower.includes('\'s')) {
          bestMatch = 'it\'s';
        } else if (lower === 'it\'s' && !contextLower.includes('\'s')) {
          bestMatch = 'its';
        }
      }
      
      if (bestMatch !== lower) {
        return {
          type: 'grammar',
          original: word,
          replacement: bestMatch,
          explanation: `"${word}" may be confused with "${bestMatch}". Context may determine the correct form.`
        };
      }
    }
    return null;
  }

  private currentContext: string = '';

  analyze(text: string): Suggestion[] {
    const suggestions: Suggestion[] = [];
    
    if (!text || text.trim().length < 2) {
      console.log('Deep Audit: Empty or too short text');
      return suggestions;
    }
    
    console.log('Deep Audit: Analyzing text:', text.substring(0, 100));
    
    const createPosition = (matchIndex: number, matchLength: number, fullText: string): Suggestion['position'] => {
      let line = 1;
      let column = 1;
      for (let i = 0; i < matchIndex; i++) {
        if (fullText[i] === '\n') {
          line++;
          column = 1;
        } else {
          column++;
        }
      }
      return {
        start: matchIndex,
        end: matchIndex + matchLength,
        line,
        column
      };
    };

    const findAllOccurrences = (pattern: RegExp, text: string): Array<{ index: number; match: string }> => {
      const results: Array<{ index: number; match: string }> = [];
      const regex = new RegExp(pattern, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        results.push({ index: match.index, match: match[0] });
      }
      return results;
    };

    const words = text.match(/\b[A-Za-z']+\b/g) || [];
    const wordMap = new Map<string, Array<{ index: number; word: string }>>();
    let searchIndex = 0;
    for (const word of words) {
      const idx = text.indexOf(word, searchIndex);
      if (idx !== -1) {
        const lower = word.toLowerCase();
        if (!wordMap.has(lower)) {
          wordMap.set(lower, []);
        }
        wordMap.get(lower)!.push({ index: idx, word });
        searchIndex = idx + 1;
      }
    }

    const checkedWords = new Set<string>();

    for (const [lowerWord, occurrences] of Array.from(wordMap.entries())) {
      if (checkedWords.has(lowerWord)) continue;
      checkedWords.add(lowerWord);
      
      if (this.customDictionary.has(lowerWord)) continue;

      const misspelling = this.checkCommonMisspellings(occurrences[0].word);
      if (misspelling) {
        for (const occ of occurrences) {
          const position = createPosition(occ.index, occ.word.length, text);
          suggestions.push({
            ...misspelling,
            original: occ.word,
            position
          });
        }
        continue;
      }

      const homophone = this.checkHomophones(occurrences[0].word);
      if (homophone) {
        for (const occ of occurrences) {
          const position = createPosition(occ.index, occ.word.length, text);
          suggestions.push({
            ...homophone,
            original: occ.word,
            position
          });
        }
        continue;
      }

      if (this.typo && !this.typo.check(occurrences[0].word)) {
        const alternates = this.typo.suggest(occurrences[0].word);
        if (alternates.length > 0) {
          const topSuggestion = alternates[0];
          if (topSuggestion.toLowerCase() !== lowerWord) {
            for (const occ of occurrences) {
              const position = createPosition(occ.index, occ.word.length, text);
              suggestions.push({
                type: 'spelling',
                original: occ.word,
                replacement: topSuggestion,
                explanation: `Possible misspelling. Did you mean "${topSuggestion}"?`,
                position
              });
            }
          }
        }
      }
    }

    for (const [phrase, replacement] of Object.entries(WORDY_PHRASES)) {
      const occurrences = findAllOccurrences(new RegExp(`\\b${phrase}\\b`, 'gi'), text);
      for (const occ of occurrences) {
        if (this.customDictionary.has(occ.match.toLowerCase())) continue;
        
        suggestions.push({
          type: 'style',
          original: occ.match,
          replacement: replacement,
          explanation: `Wordy phrase. Consider using "${replacement}" instead.`,
          position: createPosition(occ.index, occ.match.length, text)
        });
      }
    }

    const passiveRegex = /\b(am|is|are|was|were|be|been|being)\s+([a-zA-Z]+ed)\b/gi;
    let passiveMatch;
    while ((passiveMatch = passiveRegex.exec(text)) !== null) {
      const original = passiveMatch[0];
      if (this.customDictionary.has(original.toLowerCase())) continue;
      
      const context = this.getWordContext(text, passiveMatch[2]);
      if (context.includes('by the') || context.includes('was given') || context.includes('were told')) {
        suggestions.push({
          type: 'style',
          original: original,
          replacement: '',
          explanation: `Passive voice detected. Consider rewriting in active voice.`,
          position: createPosition(passiveMatch.index, original.length, text)
        });
      }
    }

    for (const doubleNeg of DOUBLE_NEGATIVES) {
      let match;
      while ((match = doubleNeg.exec(text)) !== null) {
        suggestions.push({
          type: 'grammar',
          original: match[0],
          replacement: match[0].replace(/\s*not\s*/gi, ' ').replace(/\s+/g, ' ').trim(),
          explanation: 'Double negative detected. Use only one negative word.',
          position: createPosition(match.index, match[0].length, text)
        });
      }
    }

    for (const rule of ARTICLE_RULES) {
      let match;
      while ((match = rule.pattern.exec(text)) !== null) {
        suggestions.push({
          type: 'grammar',
          original: match[0],
          replacement: match[0].replace(rule.pattern, rule.replacement),
          explanation: rule.message,
          position: createPosition(match.index, match[0].length, text)
        });
      }
    }

    for (const structPattern of SENTENCE_STRUCTURE_PATTERNS) {
      let match;
      while ((match = structPattern.pattern.exec(text)) !== null) {
        suggestions.push({
          type: 'grammar',
          original: match[0],
          replacement: '',
          explanation: structPattern.message + ': "' + match[0] + '"',
          position: createPosition(match.index, match[0].length, text)
        });
      }
    }

    const contractionRegex = /\b(can't|won't|don't|doesn't|isn't|aren't|wasn't|weren't|haven't|hasn't|hadn't|i'm|you're|he's|she's|it's|we're|they're|I've|you've|we've|they've|I'll|you'll|he'll|she'll|we'll|they'll|I'd|you'd|he'd|she'd|we'd|they'd|that's|what's|who's|where's|there's|here's|let's|ain't|gonna|wanna|gotta|kinda|sorta|outta|could've|would've|should've|might've|must've)\b/gi;
    let match;
    while ((match = contractionRegex.exec(text)) !== null) {
      const contraction = match[0].toLowerCase();
      if (CONTRACTIONS[contraction]) {
        const expanded = CONTRACTIONS[contraction];
        suggestions.push({
          type: 'style',
          original: match[0],
          replacement: expanded,
          explanation: `Consider expanding contraction "${match[0]}" to "${expanded}" for formal writing.`,
          position: createPosition(match.index, match[0].length, text)
        });
      }
    }

    const runOnRegex = /\b(\w+)\s{2,}(\w+)/g;
    while ((match = runOnRegex.exec(text)) !== null) {
      if (match[1].length > 1 && match[2].length > 1) {
        const possibleRunOn = text.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20);
        if (possibleRunOn.split(/[.!?]/).length > 2) {
          suggestions.push({
            type: 'grammar',
            original: possibleRunOn.trim(),
            replacement: '',
            explanation: 'Possible run-on sentence or missing punctuation.',
            position: createPosition(match.index, match[0].length, text)
          });
        }
      }
    }

    console.log('Deep Audit: Found', suggestions.length, 'suggestions', suggestions);
    return suggestions;
  }

  refine(text: string): string {
    let refined = text;
    
    for (const [phrase, replacement] of Object.entries(WORDY_PHRASES)) {
      const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
      refined = refined.replace(regex, replacement);
    }

    for (const [misspelling, correction] of Object.entries(COMMON_MISSPELLINGS)) {
      const regex = new RegExp(`\\b${misspelling}\\b`, 'gi');
      refined = refined.replace(regex, correction);
    }

    return refined;
  }

  summarize(text: string): string[] {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    if (sentences.length <= 3) return sentences.map(s => s.trim());

    const summary = [sentences[0].trim()];
    
    for (let i = 1; i < sentences.length; i++) {
      const s = sentences[i].trim();
      if (s.toLowerCase().includes('important') || s.toLowerCase().includes('key') || s.toLowerCase().includes('main')) {
        summary.push(s);
      }
      if (summary.length >= 4) break;
    }

    if (summary.length < 3 && sentences.length > 1) {
      summary.push(sentences[sentences.length - 1].trim());
    }

    return summary;
  }
}
