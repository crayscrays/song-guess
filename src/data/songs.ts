export interface Song {
  id: string;
  title: string;
  titleChinese: string;
  youtubeId?: string; // YouTube video ID
  startTime?: number; // Starting point in seconds for the clip
}

// Popular Jay Chou songs for the game
export const jayChouSongs: Song[] = [
  { 
    id: '1', 
    title: 'Fa Ru Xue', 
    titleChinese: '髮如雪',
    youtubeId: 'aaM7qG2ycjk',
    startTime: 45
  },
  { 
    id: '2', 
    title: 'Qi Li Xiang', 
    titleChinese: '七里香',
    youtubeId: 'Bbp9ZaJD_eA',
    startTime: 50
  },
  { 
    id: '3', 
    title: 'Kai Bu Liao Kou', 
    titleChinese: '開不了口',
    youtubeId: 'H7hpK6cm-6k',
    startTime: 40
  },
  { 
    id: '4', 
    title: 'Yang Guang Zhai Nan', 
    titleChinese: '陽光宅男',
    youtubeId: '_B8RaLCNUZw',
    startTime: 35
  },
  { 
    id: '5', 
    title: 'Qing Hua Ci', 
    titleChinese: '青花瓷',
    youtubeId: 'Z8Mqw0b9ADs',
    startTime: 55
  },
  { 
    id: '6', 
    title: 'Dao Xiang', 
    titleChinese: '稻香',
    youtubeId: 'sHD_z90ZKV0',
    startTime: 38
  },
  { 
    id: '7', 
    title: 'Qing Tian', 
    titleChinese: '晴天',
    youtubeId: 'DYptgVvkVLQ',
    startTime: 42
  },
  { 
    id: '8', 
    title: 'Ye Qu', 
    titleChinese: '夜曲',
    youtubeId: '6Q0Pd53mojY',
    startTime: 48
  },
  { 
    id: '9', 
    title: 'Huo Yuan Jia', 
    titleChinese: '霍元甲',
    youtubeId: 'wr-6wwt8RXk',
    startTime: 52
  },
  { 
    id: '10', 
    title: 'Ge Qian', 
    titleChinese: '擱淺',
    youtubeId: 'YJfHuATJYsQ',
    startTime: 44
  },
  { 
    id: '11', 
    title: 'Gao Bai Qi Qiu', 
    titleChinese: '告白氣球',
    youtubeId: 'bu7nU9Mhpyo',
    startTime: 64
  },
  { 
    id: '12', 
    title: 'Shuo Hao Bu Ku', 
    titleChinese: '說好不哭',
    youtubeId: 'HK7SPnGSxLM',
    startTime: 40
  },
  { 
    id: '13', 
    title: 'Suan Shen Me Nan Ren', 
    titleChinese: '算什麼男人',
    youtubeId: 'v489sYYjtHI',
    startTime: 36
  },
  { id: '14', title: 'An Jing', titleChinese: '安静' },
  { id: '15', title: 'Dong Feng Po', titleChinese: '东风破' },
  { id: '16', title: 'Cai Hong', titleChinese: '彩虹' },
  { id: '17', title: 'Jian Dan Ai', titleChinese: '简单爱' },
  { id: '18', title: 'Xing Qing', titleChinese: '星晴' },
  { id: '19', title: 'Tui Hou', titleChinese: '退后' },
  { id: '20', title: 'Bu Neng Shuo De Mi Mi', titleChinese: '不能说的秘密' },
  { id: '21', title: 'Long Juan Feng', titleChinese: '龙卷风' },
  { id: '22', title: 'Xia Tian', titleChinese: '夏天' },
  { id: '23', title: 'Yi Lu Xiang Bei', titleChinese: '一路向北' },
  { id: '24', title: 'Chuan Shuo', titleChinese: '传说' },
  { id: '25', title: 'Ju Hua Tai', titleChinese: '菊花台' },
];
