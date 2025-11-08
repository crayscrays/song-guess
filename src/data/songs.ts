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
    titleChinese: '擁淺',
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
  { 
    id: '14', 
    title: 'Long Juan Feng', 
    titleChinese: '龍捲風',
    youtubeId: 'RPWDeLqsN0g',
    startTime: 46
  },
  { 
    id: '15', 
    title: 'Jian Dan Ai', 
    titleChinese: '簡單愛',
    youtubeId: 'Y4xCVlyCvX4',
    startTime: 34
  },
  { 
    id: '16', 
    title: 'Dong Feng Po', 
    titleChinese: '東風破',
    youtubeId: 'qct0JLjaHDc',
    startTime: 50
  },
  { 
    id: '17', 
    title: 'Ju Hua Tai', 
    titleChinese: '菊花台',
    youtubeId: 'PdjbRvvJAzg',
    startTime: 44
  },
  { 
    id: '18', 
    title: 'Yan Hua Yi Leng', 
    titleChinese: '煙花易冷',
    youtubeId: 'P0l3I0d59mU',
    startTime: 48
  },
  { 
    id: '19', 
    title: 'Deng Ni Xia Ke', 
    titleChinese: '等你下課',
    youtubeId: 'kfXdP7nZIiE',
    startTime: 42
  },
  { 
    id: '20', 
    title: 'Zui Wei Da De Zuo Pin', 
    titleChinese: '最偉大的作品',
    youtubeId: '1emA1EFsPMM',
    startTime: 38
  },
];
