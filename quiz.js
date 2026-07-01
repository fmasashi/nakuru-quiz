/**
 * Aitsuki Nakuru Episode Quiz
 * Matching the intro quiz's design & architecture
 */

// ===== Sound Effects (Web Audio API) =====
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSE(type) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const gain = audioCtx.createGain();
  gain.connect(audioCtx.destination);
  gain.gain.setValueAtTime(0.15, now);

  if (type === 'correct') {
    [523, 659].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      osc.connect(gain);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.12);
    });
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  } else if (type === 'wrong') {
    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  } else if (type === 'streak') {
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      osc.connect(gain);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.15);
    });
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
  } else if (type === 'finish') {
    [523, 659, 784].forEach(freq => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.5);
    });
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  }
}

// ===== BGM System (Multi-track Procedural Ambient) =====
const bgm = {
  playing: false, currentTrack: null, nodes: [], intervals: [], timeouts: [],
  masterGain: null, userVolume: 0.04, muted: false,
};

const BGM_TRACKS = {
  title: {
    name: '深海のゆりかご',
    chords: [
      [220.00,277.18,329.63,415.30],[246.94,311.13,369.99,466.16],
      [207.65,261.63,311.13,392.00],[233.08,293.66,349.23,440.00],
      [220.00,277.18,329.63,415.30],
    ],
    arpNotes: [415.30,392.00,369.99,329.63,311.13,277.18,261.63,246.94,277.18,329.63,369.99,392.00],
    padInterval: 9000, arpMin: 2500, arpRand: 3000,
    padA: 2.5, padS: 6, padR: 9, shimG: 0.02, revDur: 4, revDec: 1.5,
  },
  quiz: {
    name: '月光のパズル',
    chords: [
      [293.66,369.99,440.00,554.37],[329.63,415.30,493.88,587.33],
      [261.63,329.63,392.00,493.88],[277.18,349.23,415.30,523.25],
      [293.66,369.99,440.00,554.37],
    ],
    arpNotes: [587.33,554.37,493.88,440.00,392.00,369.99,329.63,293.66,349.23,415.30,466.16,523.25],
    padInterval: 7500, arpMin: 1800, arpRand: 2400,
    padA: 2, padS: 5, padR: 8, shimG: 0.03, revDur: 3, revDec: 1.8,
  },
};

function createReverb(ctx, duration, decay) {
  const rate = ctx.sampleRate;
  const length = rate * duration;
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  const convolver = ctx.createConvolver();
  convolver.buffer = impulse;
  return convolver;
}

function playBGM(trackId) {
  if (!audioCtx) return;
  if (bgm.playing && bgm.currentTrack === trackId) return;
  stopBGM();
  const t = BGM_TRACKS[trackId];
  if (!t) return;
  bgm.playing = true;
  bgm.currentTrack = trackId;
  const ctx = audioCtx;
  bgm.masterGain = ctx.createGain();
  const vol = bgm.muted ? 0 : bgm.userVolume;
  bgm.masterGain.gain.setValueAtTime(0, ctx.currentTime);
  bgm.masterGain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 3);
  bgm.masterGain.connect(ctx.destination);
  const reverb = createReverb(ctx, t.revDur, t.revDec);
  const rvG = ctx.createGain(); rvG.gain.value = 0.6;
  const dryG = ctx.createGain(); dryG.gain.value = 0.5;
  reverb.connect(rvG); rvG.connect(bgm.masterGain); dryG.connect(bgm.masterGain);
  bgm.nodes.push(bgm.masterGain, reverb, rvG, dryG);
  let ci = 0;
  function padChord() {
    if (!bgm.playing || bgm.currentTrack !== trackId) return;
    const now = ctx.currentTime;
    const ch = t.chords[ci % t.chords.length]; ci++;
    ch.forEach((freq, i) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(freq, now);
      o.detune.setValueAtTime((Math.random()-0.5)*8, now);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.12-i*0.02, now+t.padA);
      g.gain.linearRampToValueAtTime(0.08, now+t.padS);
      g.gain.linearRampToValueAtTime(0, now+t.padR);
      o.connect(g); g.connect(reverb); g.connect(dryG);
      o.start(now+i*0.3); o.stop(now+t.padR+0.5);
      const s = ctx.createOscillator(); s.type = 'triangle';
      s.frequency.setValueAtTime(freq*2, now);
      s.detune.setValueAtTime((Math.random()-0.5)*12, now);
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0, now);
      sg.gain.linearRampToValueAtTime(t.shimG, now+t.padA+0.5);
      sg.gain.linearRampToValueAtTime(0, now+t.padR-1);
      s.connect(sg); sg.connect(reverb);
      s.start(now+1); s.stop(now+t.padR);
    });
  }
  let ni = 0;
  function arpNote() {
    if (!bgm.playing || bgm.currentTrack !== trackId) return;
    const now = ctx.currentTime;
    const freq = t.arpNotes[ni % t.arpNotes.length]; ni++;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(freq, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.08, now+0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now+3);
    o.connect(g); g.connect(reverb); g.connect(dryG);
    o.start(now); o.stop(now+3.5);
  }
  padChord();
  const pi = setInterval(() => {
    if (!bgm.playing || bgm.currentTrack !== trackId) { clearInterval(pi); return; }
    padChord();
  }, t.padInterval);
  bgm.intervals.push(pi);
  function schedArp() {
    if (!bgm.playing || bgm.currentTrack !== trackId) return;
    const d = t.arpMin + Math.random() * t.arpRand;
    const tid = setTimeout(() => { arpNote(); schedArp(); }, d);
    bgm.timeouts.push(tid);
  }
  bgm.timeouts.push(setTimeout(schedArp, 2000));
  // Update track name display
  const titleEl = document.getElementById('bgm-title');
  if (titleEl) titleEl.textContent = t.name;
  updateMuteBtn();
}

function stopBGM() {
  bgm.playing = false; bgm.currentTrack = null;
  bgm.intervals.forEach(id => clearInterval(id));
  bgm.timeouts.forEach(id => clearTimeout(id));
  bgm.intervals = []; bgm.timeouts = [];
  bgm.nodes.forEach(n => {
    if (n && n.stop) try { n.stop(); } catch(e) {}
    if (n && n.disconnect) try { n.disconnect(); } catch(e) {}
  });
  bgm.nodes = []; bgm.masterGain = null;
  const titleEl = document.getElementById('bgm-title');
  if (titleEl) titleEl.textContent = '---';
}

function setBGMVolume(v) {
  bgm.userVolume = v;
  if (bgm.masterGain && !bgm.muted) {
    bgm.masterGain.gain.linearRampToValueAtTime(v, audioCtx.currentTime + 0.3);
  }
  try { localStorage.setItem('nq-bgm-vol', v); } catch(e) {}
}

function toggleBGMMute() {
  bgm.muted = !bgm.muted;
  if (bgm.masterGain) {
    bgm.masterGain.gain.linearRampToValueAtTime(
      bgm.muted ? 0 : bgm.userVolume, audioCtx.currentTime + 0.3
    );
  }
  try { localStorage.setItem('nq-bgm-muted', bgm.muted ? '1' : '0'); } catch(e) {}
  updateMuteBtn();
}

function updateMuteBtn() {
  const btn = document.getElementById('bgm-mute-btn');
  if (!btn) return;
  btn.innerHTML = bgm.muted ? '&#9837;' : '&#9835;';
  btn.title = bgm.muted ? 'BGMをONにする' : 'BGMをOFFにする';
  btn.classList.toggle('muted', bgm.muted);
}

function loadBGMSettings() {
  try {
    const v = localStorage.getItem('nq-bgm-vol');
    if (v !== null) bgm.userVolume = parseFloat(v);
    if (localStorage.getItem('nq-bgm-muted') === '1') bgm.muted = true;
  } catch(e) {}
}

// ===== Quiz Data =====
const ALL_QUESTIONS = [
  {
    question: "藍月なくるが大好きな食べ物で、1時間プレゼン配信をしたり、テーマソングまで作ったりしたものは？",
    choices: ["すだちそば", "讃岐うどん", "わんこそば", "ざるラーメン"],
    correct: 0,
    explanation: "藍月なくるは「すだちそば」を溺愛しており、「すだち蕎麦食べ食べ委員会」という配信を行ったり、テーマソング「すーぱーだいちゅき♡そばにいてっ」を制作するほどの熱量を持っています。",
    source: "YouTube配信 / オフィシャルグッズ情報"
  },
  {
    question: "藍月なくるが作曲家 sky_delta と組んでいる音楽ユニットの名前は？",
    choices: ["Endorfin.", "La priere", "ClariS", "GARNiDELiA"],
    correct: 0,
    explanation: "Endorfin.（エンドルフィン）は2015年に結成された、藍月なくるとsky_deltaによる音楽ユニット。BEMANIシリーズなど数多くの音楽ゲームに楽曲を提供しています。",
    source: "公式サイト / ニコニコ大百科"
  },
  {
    question: "藍月なくるが「炭酸ちゃん」の声を担当しているASMR耳かきシリーズの投稿者は？",
    choices: ["とみみ", "はるまきごはん", "周防パトラ", "黒井しば"],
    correct: 0,
    explanation: "「炭酸ちゃん」は耳かきボイス投稿者「とみみ（とみみ庵）」氏の音声作品シリーズに登場する青髪のキャラクターで、藍月なくるが声を担当しています。シリーズはミリオン再生を達成した作品も複数あり、高い人気を誇っています。",
    source: "ニコニコ大百科 / YouTube"
  },
  {
    question: "藍月なくるが棗いつき・nayutaと共に結成した3人組ボーカルユニットの名前は？",
    choices: ["La priere", "Endorfin.", "Kalafina", "TrySail"],
    correct: 0,
    explanation: "La priere（ラプリエール）は2019年12月に結成された、棗いつき・藍月なくる・nayutaの3名による女性ボーカルユニットです。",
    source: "La priere 公式サイト / Wikipedia"
  },
  {
    question: "2025年3月1日に立川ステージガーデンで開催された藍月なくるのバースデーライブのタイトルは？",
    choices: ["概念／質量", "光と影", "月と太陽", "覚醒／沈黙"],
    correct: 0,
    explanation: "Birthday LIVE 2025「概念／質量」は昼公演「概念」（3Dライブ）と夜公演「質量」（生バンドライブ）の2部制で開催されました。",
    source: "公式サイト aitsukinakuru.com"
  },
  {
    question: "藍月なくるの愛称として親しまれているのは？",
    choices: ["なくちゃ", "あいちゃん", "なっくん", "るっち"],
    correct: 0,
    explanation: "ファンや関係者からは「なくちゃ」の愛称で親しまれています。配信中にファンから呼ばれることも多く、本人も認知している愛称です。",
    source: "Wikipedia / 公式プロフィール"
  },
  {
    question: "2025年4月に発売された、藍月なくるの声を元にしたSynthesizer Vライブラリの名前は？",
    choices: ["無來（なくる）", "藍音（あいね）", "月詠（つくよみ）", "星歌（ほしか）"],
    correct: 0,
    explanation: "Synthesizer V 2専用歌声データベース「無來（なくる）」が2025年4月27日に発売。透き通る歌声と幅広い表現力を再現できます。",
    source: "PR TIMES / BOOTH"
  },
  {
    question: "藍月なくるが「歌ってみた」動画の投稿を開始したのは何年？",
    choices: ["2013年", "2010年", "2016年", "2018年"],
    correct: 0,
    explanation: "藍月なくるは2013年にニコニコ動画で「歌ってみた」動画の投稿を開始し、活動をスタートさせました。",
    source: "ニコニコ大百科 / Wikipedia"
  },
  {
    question: "藍月なくるの誕生日はいつ？",
    choices: ["3月1日", "1月3日", "7月7日", "12月25日"],
    correct: 0,
    explanation: "藍月なくるの誕生日は3月1日。毎年バースデーライブや記念イベントが開催されており、2025年には立川ステージガーデンで「概念／質量」、また2022年の誕生日には株式会社一二三への所属発表も行われるなど、活動の節目が3月1日に集中しています。",
    source: "公式プロフィール"
  },
  {
    question: "藍月なくるがすだちそばへの愛が高じてグッズ化した調味料は？",
    choices: ["すだちめんつゆ", "すだちポン酢", "すだちドレッシング", "すだち醤油"],
    correct: 0,
    explanation: "すだちそばグッズの一環として、本人も味見して風味にこだわった「すだちめんつゆ」がグッズ化されました。",
    source: "公式グッズ情報 / 配信アーカイブ"
  },
  {
    question: "藍月なくるの所属事務所は？",
    choices: ["株式会社一二三", "ANYCOLOR株式会社", "カバー株式会社", "ソニー・ミュージック"],
    correct: 0,
    explanation: "藍月なくるは株式会社一二三（Hifumi,inc.）に所属しています。2022年3月1日（誕生日）に正式発表されました。同社にはEndorfin.のパートナーであるsky_deltaや、コラボ相手の棗いつきも所属しており、楽曲制作やイベント運営の体制が充実しています。",
    source: "hifumi-inc.co.jp / Wikipedia"
  },
  {
    question: "藍月なくるのすだちそば愛がきっかけで出演した徳島県の四国放送テレビ番組は？",
    choices: ["ゴジカル！", "おはよう徳島", "阿波ナビ", "とくしまタイム"],
    correct: 0,
    explanation: "すだちの生産量全国1位の徳島県との縁から、四国放送のテレビ番組「ゴジカル！」に出演し、楽曲の初披露も行われました。",
    source: "四国放送 / 公式X（旧Twitter）"
  },
  {
    question: "藍月なくるの身長は何cm？",
    choices: ["161cm", "155cm", "168cm", "150cm"],
    correct: 0,
    explanation: "藍月なくるの公表身長は161cmです。公式プロフィールで公表されている数少ない身体的情報の一つで、VTuberとしての3Dモデルもこの身長を基準に制作されています。",
    source: "公式プロフィール / Weblio"
  },
  {
    question: "藍月なくるのキャッチフレーズとして知られる、活動スタイルを表す言葉は？",
    choices: ["リアルとバーチャルを行き来するシンガー", "月に歌う永遠のシンガー", "二次元から来た歌姫", "ネットの歌の女王"],
    correct: 0,
    explanation: "藍月なくるは「リアルとバーチャルを行き来するシンガー」というキャッチフレーズで活動しています。VTuberとしての3D配信やバーチャルライブと、実際の会場でのリアルライブの両方を精力的にこなすスタイルを端的に表した言葉です。",
    source: "hifumi-inc.co.jp / 公式プロフィール"
  },
  {
    question: "藍月なくるがニコニコ動画に初めて「歌ってみた」を投稿した日付と曲名の組み合わせとして正しいのは？",
    choices: ["2013年1月6日「ギガンティックO.T.N」", "2012年3月14日「千本桜」", "2014年7月1日「脳漿炸裂ガール」", "2013年8月15日「六兆年と一夜物語」"],
    correct: 0,
    explanation: "2013年1月6日に「『ギガンティックO.T.N』歌ってみた_なくる」をニコニコ動画に投稿し、歌い手としての活動を開始しました。当時は「なくる」名義で活動していました。",
    source: "ニコニコ動画投稿履歴 / ニコニコ大百科"
  },
  {
    question: "2024年2月4日に市川市文化会館で開催された、藍月なくる初のワンマンライブの名前は？",
    choices: ["クラリムステラ", "ルミナスアリア", "スターライトワルツ", "ムーンリットソナタ"],
    correct: 0,
    explanation: "1st LIVE「クラリムステラ」は2024年2月4日（日）に千葉県・市川市文化会館で開催されました。藍月なくるにとって初の本格的なワンマンライブであり、ファンにとって記念碑的なイベントとなりました。",
    source: "aitsukinakuru.com / LiveFans"
  },
  {
    question: "藍月なくるの4thソロアルバム『JelLaboratory』のテーマとなっている3つのモチーフは？",
    choices: ["水音・クラゲ・恋", "月光・星・夢", "深海・珊瑚・祈り", "雨・傘・涙"],
    correct: 0,
    explanation: "『JelLaboratory』は2018年に発表された4thソロアルバムで、「水音」×「クラゲ」×「恋」をテーマに紡がれた物語を収録した全7曲の作品です。タイトルの「Jel」はクラゲ（Jellyfish）に由来しています。",
    source: "BOOTH / TuneCore"
  },
  {
    question: "2025年6月7日に新江ノ島水族館で開催された藍月なくるのコラボイベントの名前は？",
    choices: ["Story Live JelLaboratory", "Aqua Dream Concert", "Deep Sea Serenade", "Jellyfish Fantasy Live"],
    correct: 0,
    explanation: "「Story Live JelLaboratory in 新江ノ島水族館」は、クラゲファンタジーホールで開催された特別イベントです。アルバム『JelLaboratory』の楽曲と書き下ろしシナリオの朗読を織り交ぜたストーリーテリングミニライブが行われました。限定グッズとして「なくらげミニぬいぐるみ」なども販売されました。",
    source: "aitsukinakuru.com / gree-entertainment.com"
  },
  {
    question: "藍月なくるのファンミーティングイベントは、独特な名称で知られています。その名前は？",
    choices: ["ファンイーティング", "ファンフェスティバル", "なくちゃ会", "ブルームーンミーティング"],
    correct: 0,
    explanation: "藍月なくるのファンミーティングは「ファンイーティング」という独特の名称で開催されています。2024年には「ご注文はえいえんに！～深海喫茶なく茶屋へようこそ～」というテーマで、喫茶店風のコンセプトイベントが行われました。",
    source: "aitsukinakuru.com / 公式X"
  },
  {
    question: "藍月なくるのYouTubeチャンネル登録者数はおよそ何万人？（2026年時点）",
    choices: ["約27万人", "約10万人", "約50万人", "約100万人"],
    correct: 0,
    explanation: "YouTubeチャンネル「藍月なくる / Aitsuki Nakuru」の登録者数は2026年時点で約26〜27万人です。歌ってみた動画やオリジナル楽曲のMV、ライブ映像などが投稿されています。",
    source: "YouTube / Wikipedia / userlocal.jp"
  },
  {
    question: "藍月なくるが2023年3月にお披露目した、活動の幅を広げる新要素とは？",
    choices: ["3Dモデル", "オリジナルアニメ", "自身のレーベル", "NFTコレクション"],
    correct: 0,
    explanation: "2023年3月に自身の3Dモデルをお披露目し、VTuberとしての活動を本格化させました。これにより3D空間での表現が可能になり、バーチャルライブの演出の幅が大きく広がりました。キャッチフレーズ「リアルとバーチャルを行き来する」を体現する重要な出来事です。",
    source: "YouTube配信 / Wikipedia"
  },
  {
    question: "藍月なくるのベストアルバムのタイトルは？",
    choices: ["真相", "告白", "深層", "全貌"],
    correct: 0,
    explanation: "ベストアルバム『真相』は2025年にリリースされた、藍月なくるのソロ活動を振り返る集大成的な作品です。「FAKE IDOL」「Evil Bubble」などの代表的なオリジナル楽曲が収録されており、Nacollectionシリーズやコンセプトアルバムに散らばった人気曲を一枚で聴ける、入門にもおすすめの作品です。",
    source: "aitsukinakuru.shop / 公式サイト"
  },
  {
    question: "藍月なくると棗いつきのコラボ第2弾シングルのタイトルは？",
    choices: ["約束のリンカネーション", "追想のラグナロク", "永遠のセレナーデ", "覚醒のレクイエム"],
    correct: 0,
    explanation: "『約束のリンカネーション』は藍月なくる×棗いつきのコラボ第2弾シングルです。二人は共に株式会社一二三に所属するシンガーで、「いつきんくる」の通称で親しまれるほど親交が深く、多くのコラボ楽曲をリリースしています。",
    source: "YouTube / ototoy.jp"
  },
  {
    question: "La priere（ラプリエール）が結成されたのは何年何月？",
    choices: ["2019年12月", "2018年6月", "2020年4月", "2021年1月"],
    correct: 0,
    explanation: "La priere（ラプリエール）は2019年12月に結成されました。メンバーは棗いつき・藍月なくる・nayutaの3名で、それぞれが個人でも活躍するシンガーが集まった女性ボーカルユニットです。ユニット名はフランス語で「祈り」を意味します。",
    source: "La priere公式 / Wikipedia"
  },
  {
    question: "藍月なくるのSynthesizer Vライブラリ「無來」の読み方は？",
    choices: ["なくる", "むら", "むらい", "なくら"],
    correct: 0,
    explanation: "「無來」は「なくる」と読みます。藍月なくるの名前にちなんだ漢字が当てられており、2025年4月27日にSynthesizer V 2専用歌声データベースとして発売されました。透き通る歌声と幅広い表現力を持つデータベースです。",
    source: "PR TIMES / BOOTH / Wikipedia"
  },
  {
    question: "2017年以降、藍月なくるのメインの動画投稿プラットフォームはどこ？",
    choices: ["YouTube", "ニコニコ動画", "TikTok", "bilibili"],
    correct: 0,
    explanation: "2013年にニコニコ動画で活動を開始しましたが、2017年9月の投稿を最後にニコニコ動画での投稿は減少し、以降はYouTubeがメインの活動プラットフォームとなっています。ただし、La priereの動画等でニコニコにも投稿されることがあります。",
    source: "ニコニコ大百科 / Wikipedia"
  },
  {
    question: "藍月なくるのカバーアルバムのタイトルは？",
    choices: ["藍月なくるCover Collection Vol.1", "Sing for You", "なくちゃセレクション", "Blue Moon Covers"],
    correct: 0,
    explanation: "『藍月なくるCover Collection Vol.1』は、数々の「歌ってみた」動画で披露してきた楽曲をまとめたカバーアルバムです。藍月なくるの透明感のある歌声による多彩なカバー楽曲が収録されています。",
    source: "aitsukinakuru.com"
  },
  {
    question: "Birthday LIVE 2025「概念／質量」の昼公演「概念」のライブ形式は？",
    choices: ["3Dライブ", "生バンドライブ", "アコースティックライブ", "DJ形式"],
    correct: 0,
    explanation: "Birthday LIVE 2025「概念／質量」は2025年3月1日に立川ステージガーデンで開催されました。昼公演「概念」は3Dライブ（バーチャル演出中心）、夜公演「質量」は生バンドライブ（リアル演出中心）という2部制で、まさに「リアルとバーチャルを行き来する」というコンセプトを体現したライブでした。",
    source: "aitsukinakuru.com / t-sg.jp"
  },
  {
    question: "藍月なくるの3Dお披露目配信用画像素材やグッズデザインを手がけたイラストレーターは？",
    choices: ["かねこあみ", "redjuice", "LAM", "飯田ぽち。"],
    correct: 0,
    explanation: "かねこあみ氏が藍月なくるの3Dお披露目配信用画像素材や誕生日記念グッズのデザインを担当しています。藍月なくるの世界観を視覚的に表現する重要なクリエイターの一人です。",
    source: "kanekoami.com / YouTube"
  },
  {
    question: "Endorfin.（sky_delta×藍月なくる）が結成されたのは何年何月？",
    choices: ["2015年9月", "2014年4月", "2016年1月", "2013年12月"],
    correct: 0,
    explanation: "Endorfin.は2015年9月にコンポーザーsky_deltaとボーカル藍月なくるによって結成されました。ユニット名は脳内物質「エンドルフィン」に由来しています。以降、BEMANIシリーズを始め多数の音楽ゲームに楽曲を提供し続けています。",
    source: "Wikipedia / Weblio"
  },
  {
    question: "藍月なくるが「炭酸ちゃん」役で出演した、とみみ庵のASMRシリーズでミリオン再生を達成した作品数は？",
    choices: ["4作品", "1作品", "2作品", "7作品"],
    correct: 0,
    explanation: "ニコニコ動画で100万再生を達成した炭酸ちゃん出演作品は4本。(1)「声付き耳かき音を作ってみた26」（炭酸ちゃん初登場回）、(2)「声付き耳かき音を作ってみた27」（炭酸での頭皮マッサージ＆炭酸シャンプー）、(3)「番外編②（炭酸マッサージ＆シャンプー）」、(4)「声付き耳かき音を作ってみた31」の4作品です。とみみ庵は2018年2月の「作ってみた(終)」をもって活動を終了しています。",
    source: "ニコニコ動画 / とみみ庵マイリスト"
  },
  {
    question: "藍月なくるのオリジナルアルバム「Nacollection」シリーズは何作目まで出ている？",
    choices: ["4作目（Nacollection4）", "2作目（Nacollection2）", "6作目（Nacollection6）", "3作目（Nacollection3）"],
    correct: 0,
    explanation: "「Nacollection」シリーズは藍月なくるの定番オリジナルアルバムシリーズで、4作目の『Nacollection4』まで発表されています。1作目「Nacollection!」、2作目「2nd Nacollection!」、3作目「Nacollection -3-」、4作目「Nacollection4」と、毎回ナンバリング表記が異なるのが特徴です。",
    source: "aitsukinakuru.com / BOOTH"
  },
  {
    question: "2024年8月にLINE CUBE SHIBUYA（渋谷公会堂）で開催された藍月なくるの2ndワンマンライブの名前は？",
    choices: ["鏡像崇拝", "虚像幻想", "深海讃歌", "月影礼拝"],
    correct: 0,
    explanation: "2nd LIVE「鏡像崇拝」は2024年8月にLINE CUBE SHIBUYA（旧・渋谷公会堂）で開催されました。1st LIVE「クラリムステラ」からわずか半年後に、より大きな会場でのライブを成功させています。",
    source: "aitsukinakuru.com / LiveFans"
  },
  {
    question: "La priereのクラウドファンディングで達成された目標額の倍率はどれくらい？",
    choices: ["700%超", "200%超", "1000%超", "150%超"],
    correct: 0,
    explanation: "La priere（棗いつき・藍月なくる・nayuta）の初ワンマンライブ「Three piece!!!」に向けたクラウドファンディングでは、目標額の700%超を達成する大きな支持を集めました。3人の個々の人気と、ユニットとしての期待の高さを示す結果となりました。",
    source: "Wikipedia / クラウドファンディング記録"
  },
  {
    question: "藍月なくるがラジオ番組での発言がきっかけで定着した、すだちそば以外の好きな食べ物は？",
    choices: ["茎わかめ", "おしゃぶり昆布", "酢こんぶ", "めかぶ"],
    correct: 0,
    explanation: "インターネットラジオ「NTRじ」（音泉）への第2回ゲスト出演時に茎わかめ好きを公言。その反響を受け、番外編「藍月なくる、茎わかめを食す」が2018年3月に配信されるまでに至りました。茎わかめメーカーの壮関がスポンサーとなった特別企画でした。",
    source: "PR TIMES / 音泉"
  },
  {
    question: "藍月なくるが茎わかめ好きを語ったインターネットラジオ番組の通称は？",
    choices: ["NTRじ", "ASMRじ", "そばラジ", "なくラジ"],
    correct: 0,
    explanation: "通称「NTRじ」は、正式名称「ネットという無数の声雄が割拠する世界から、最新最強の武器バイノーラルマイクを駆使し、ファンのみんなに癒しと感動を与える声優を、とにかく！全力を尽くして熱く応援するラジオ」の略。音泉で配信され、バイノーラルマイクを使用したASMR要素のあるバラエティ番組です。",
    source: "音泉 / ニコニコ大百科"
  },
  {
    question: "藍月なくるが「NTRじ」にゲスト出演したのは第何回？",
    choices: ["第2回", "第5回", "第10回", "第1回"],
    correct: 0,
    explanation: "藍月なくるは「NTRじ」の第2回にゲストとして出演しました。この出演で茎わかめ好きが広く知られるようになり、後に茎わかめメーカーの壮関がスポンサーとなった番外編「藍月なくる、茎わかめを食す」が制作・配信されました。",
    source: "YouTube / 音泉"
  },
  {
    question: "藍月なくるのファンの間で使われるモチーフ「なくらげ」の由来は？",
    choices: ["なくる＋クラゲの造語", "なくちゃ＋ラーメンの略", "泣く＋ラグの略語", "なくる＋あげはの略"],
    correct: 0,
    explanation: "「なくらげ」は「なくる」と「クラゲ」を組み合わせた造語です。藍月なくるが大のクラゲ好きであることに由来し、ファンの間で親しまれているモチーフです。新江ノ島水族館コラボでは「なくらげミニぬいぐるみ」も限定販売されました。",
    source: "公式グッズ / ファンコミュニティ"
  },
  {
    question: "藍月なくるが特に好きな生き物で、水族館通いの理由にもなっているのは？",
    choices: ["クラゲ", "イルカ", "ペンギン", "チンアナゴ"],
    correct: 0,
    explanation: "藍月なくるは大のクラゲ好きとして知られています。趣味に水族館通いを挙げており、4thアルバム『JelLaboratory』もクラゲをテーマにした作品です。新江ノ島水族館のクラゲファンタジーホールでのライブイベントも実現しました。",
    source: "公式プロフィール / aitsukinakuru.com"
  },
  {
    question: "La priereの初ワンマンライブのタイトルは？",
    choices: ["Three piece!!!", "Triple Harmony", "Tri-Star Live", "Trois Voix"],
    correct: 0,
    explanation: "La priereの初ワンマンライブ「Three piece!!!」は、3人のボーカリストが揃い踏みする記念碑的なライブでした。タイトルの「Three piece」は3人組であることと、音楽用語の「スリーピース（バンド）」をかけたものです。",
    source: "Wikipedia / La priere公式"
  },
  {
    question: "La priereが2021年に実施した、音楽活動における挑戦的な企画は？",
    choices: ["12ヶ月連続新曲リリース", "48時間耐久配信", "100曲カバーマラソン", "全国47都道府県ツアー"],
    correct: 0,
    explanation: "La priereは2021年に12ヶ月連続で新曲をリリースするという挑戦的な企画を実施しました。毎月異なるテイストの楽曲を発表し続けることで、ユニットの音楽性の幅広さを示すとともに、ファンを飽きさせない展開を見せました。",
    source: "Wikipedia / La priere公式"
  },
  {
    question: "藍月なくるの声を元にしたSynthesizer Vライブラリ「無來」のキャラクターデザインを担当したのは？",
    choices: ["猫山桜梨", "かねこあみ", "redjuice", "しらび"],
    correct: 0,
    explanation: "Synthesizer Vライブラリ「無來（なくる）」のキャラクターデザインは猫山桜梨氏が担当しています。なお、同時期に棗いつきの歌声データベース「ナツメイツキ」も展開されており、二人のコラボ企画なども行われています。",
    source: "hifumi-pro.jp / PR TIMES"
  },
  {
    question: "2019年にfengから発売されたPCゲーム『夢と色でできている』のEDテーマを歌ったのは藍月なくるですが、その楽曲名は？",
    choices: ["これくらいで", "あのころ", "きっといつか", "それだけで"],
    correct: 0,
    explanation: "「これくらいで」は2019年にfengから発売された美少女ゲーム『夢と色でできている』のエンディングテーマです。作詞・作曲・編曲はすべて堀江晶太が手がけました。藍月なくるは歌い手やVTuberとしてだけでなく、美少女ゲームの主題歌歌唱でも活躍しています。",
    source: "aitsukinakuru.com / VGMdb"
  },
  {
    question: "Endorfin.の楽曲でMÚSECAとノスタルジアの両方に収録されている楽曲は？",
    choices: ["Replica", "Four Leaves", "white night story", "Innocent Truth"],
    correct: 0,
    explanation: "『Replica』はEndorfin.の楽曲で、KONAMIのMÚSECAとノスタルジアの2つの音楽ゲームに収録されています。多くのBEMANI機種に楽曲が採用されていることが、Endorfin.の高い評価を物語っています。",
    source: "BEMANI Wiki / VGMdb"
  },
  {
    question: "La priereの1st Live Tourのタイトルは？",
    choices: ["SPLASH the TONE", "Three piece!!!", "Gemini Syndrome", "Triple Resonance"],
    correct: 0,
    explanation: "La priereの1st Live Tour「SPLASH the TONE」は、初ワンマンライブ「Three piece!!!」の成功を受けて開催されたツアーです。水をイメージさせるタイトルは、藍月なくるの深海テーマとも親和性のあるネーミングです。",
    source: "Wikipedia / La priere公式"
  },
  {
    question: "Endorfin.の1stアルバムのタイトルは？",
    choices: ["Horizon Note", "Alt.Strato", "Stories of Eve", "Horizon Claire"],
    correct: 0,
    explanation: "『Horizon Note』はEndorfin.の1stアルバムで、2016年春のM3で発表されました。ユニットの方向性を示す記念碑的な作品です。",
    source: "Wikipedia / ototoy.jp"
  },
  {
    question: "藍月なくるが株式会社一二三への所属を発表したのはいつ？",
    choices: ["2022年3月1日", "2020年1月15日", "2023年7月7日", "2021年9月1日"],
    correct: 0,
    explanation: "2022年3月1日（誕生日）に、藍月なくるおよびEndorfin.が株式会社一二三（Hifumi,inc.）への所属を正式に発表しました。",
    source: "hifumi-inc.co.jp"
  },
  {
    question: "藍月なくるの公式X（旧Twitter）のアカウントIDは？",
    choices: ["@NakuruAitsuki", "@aitsuki_nakuru", "@nakuru_official", "@BlueMoonNakuru"],
    correct: 0,
    explanation: "藍月なくるの公式X（旧Twitter）アカウントは@NakuruAitsukiです。スタッフ公式アカウントは@nakuru_staffで別に運営されています。",
    source: "X（旧Twitter） / aitsukinakuru.com"
  },
  {
    question: "La priereの1stアルバム『Gemini Syndrome』が発売されたイベントは？",
    choices: ["コミックマーケット97（C97）", "M3 2019秋", "ボーマス40", "コミティア130"],
    correct: 0,
    explanation: "La priereの1stアルバム『Gemini Syndrome』は、2019年12月31日のコミックマーケット97（C97）で初頒布されました。ふたご座神話をテーマにした全7曲のトリプルボーカルアルバムです。",
    source: "Wikipedia / 7uta.com"
  },
  {
    question: "藍月なくるの7thアルバム『Counterfeit』に収録されている楽曲「FAKE IDOL」の作曲者は？",
    choices: ["Akki", "sky_delta", "堀江晶太", "Mameyudoufu"],
    correct: 0,
    explanation: "「FAKE IDOL」は作詞・作曲ともにAkkiが手がけた楽曲で、2022年10月リリースの7thアルバム『Counterfeit』に収録されています。MVのイラストは沼田ゾンビが担当しました。",
    source: "YouTube / Apple Music"
  },
  {
    question: "2026年にBillboard Liveで開催されたファンイーティングのタイトルは？",
    choices: ["Devouring Aria", "Midnight Feast", "Eternal Banquet", "Dreaming Dinner"],
    correct: 0,
    explanation: "ファンイーティング2026『Devouring Aria（デヴァウリング アリア）』は、Billboard Live TOKYO（3月28日）とBillboard Live OSAKA（4月4日）の2会場で開催されたディナーショー形式のイベントです。コース料理を楽しみながらライブを鑑賞できる豪華な企画でした。",
    source: "aitsukinakuru.com"
  },
  {
    question: "藍月なくるの2nd LIVE「鏡像崇拝」が開催された正確な日付は？",
    choices: ["2024年8月31日", "2024年8月10日", "2024年7月20日", "2024年9月15日"],
    correct: 0,
    explanation: "2nd LIVE「鏡像崇拝」は2024年8月31日（土）にLINE CUBE SHIBUYA（渋谷公会堂）で開催されました。1st LIVE「クラリムステラ」の成功を受けて、より大きな会場での開催となりました。",
    source: "aitsukinakuru.com"
  },
  {
    question: "藍月なくるのすだちそばプレゼン配信の正式名称は？",
    choices: ["すだち蕎麦食べ食べ委員会", "すだちそば愛好会", "すだちそば研究所", "すだちそば普及協会"],
    correct: 0,
    explanation: "すだちそばへの尋常ではない愛を語る配信の正式名称は「すだち蕎麦食べ食べ委員会」。1時間にわたってすだちそばの魅力をプレゼンするという伝説的な配信です。",
    source: "YouTube配信アーカイブ"
  },
  {
    question: "とみみ庵のASMRシリーズで、藍月なくる演じる「炭酸ちゃん」が初登場したのは第何回？",
    choices: ["第26回", "第10回", "第18回", "第33回"],
    correct: 0,
    explanation: "「炭酸ちゃん」は「声付き耳かき音を作ってみた26」で初登場しました。青髪の元気なキャラクターで、炭酸を使った頭皮マッサージやシャンプーが特徴です。以降シリーズの人気キャラクターとなりました。",
    source: "ニコニコ動画 / note.com"
  },
  {
    question: "Endorfin.のユニット名の由来は？",
    choices: ["脳内物質エンドルフィン", "英語のendless", "ドイツ語のErfolg", "ラテン語のfinis"],
    correct: 0,
    explanation: "Endorfin.のユニット名は脳内物質「エンドルフィン」に由来しています。幸福感や高揚感をもたらすホルモンの名前を冠し、音楽で聴く人に幸せな気持ちを届けたいという想いが込められています。",
    source: "Wikipedia / 公式プロフィール"
  },
  {
    question: "La priereのユニット名の意味は？",
    choices: ["フランス語で「祈り」", "イタリア語で「歌」", "スペイン語で「光」", "ドイツ語で「夢」"],
    correct: 0,
    explanation: "La priere（ラプリエール）はフランス語で「祈り」を意味します。3人のシンガーの歌声で祈りを届けるという想いが込められたユニット名です。",
    source: "La priere公式 / Wikipedia"
  },
  {
    question: "藍月なくるの4thソロアルバム『JelLaboratory』のタイトルに含まれる「Jel」の由来は？",
    choices: ["Jellyfish（クラゲ）", "Jewel（宝石）", "Jelly（ゼリー）", "Jealousy（嫉妬）"],
    correct: 0,
    explanation: "「Jel」はJellyfish（クラゲ）に由来しています。藍月なくるの大好きなクラゲと実験室（Laboratory）を掛け合わせたタイトルで、水音とクラゲと恋をテーマにした作品です。",
    source: "BOOTH / recochoku.jp"
  },
  {
    question: "新江ノ島水族館コラボで限定販売された、藍月なくるのマスコットグッズの名前は？",
    choices: ["なくらげミニぬいぐるみ", "なくちゃキーホルダー", "藍月クラゲランプ", "深海マスコット"],
    correct: 0,
    explanation: "「Story Live JelLaboratory in 新江ノ島水族館」で限定販売された「なくらげミニぬいぐるみ」は、藍月なくるとクラゲを掛け合わせたオリジナルマスコットです。",
    source: "aitsukinakuru.com"
  },
  {
    question: "藍月なくるの7thアルバムのタイトルは？",
    choices: ["Counterfeit", "JelLaboratory", "Transpain", "ILLUAMOR"],
    correct: 0,
    explanation: "7thアルバム『Counterfeit』は2022年10月にリリースされました。「FAKE IDOL」「Domination」「Bad Drip」「Defective」「唾と蜜」「Dirt」の全6曲を収録しています。",
    source: "aitsukinakuru.com / Apple Music"
  },
  {
    question: "2024年のファンイーティングのサブタイトルで、喫茶店をテーマにしたのは？",
    choices: ["ご注文はえいえんに！～深海喫茶なく茶屋～", "月光カフェへようこそ", "深海レストラン", "Blue Moon Dining"],
    correct: 0,
    explanation: "2024年のファンイーティングは「ご注文はえいえんに！～深海喫茶なく茶屋へようこそ～」というサブタイトルで、喫茶店風のコンセプトイベントとして開催されました。初回は2024年10月5日にYOKOHAMA COAST garage+で開催。",
    source: "aitsukinakuru.com / 公式X"
  },
  {
    question: "藍月なくるの6thアルバムのタイトルは？",
    choices: ["Transpain", "Counterfeit", "Nacollection -3-", "JelLaboratory"],
    correct: 0,
    explanation: "6thアルバム『Transpain』は2020年に発表された作品です。タイトルは「Trans（越える）」と「Pain（痛み）」を組み合わせた造語で、痛みを越えていく感情の変遷をテーマにしたコンセプトアルバム。Nacollectionシリーズのコレクション的な構成とは異なり、一つのテーマを深く掘り下げた意欲作です。",
    source: "aitsukinakuru.com / BOOTH"
  },
  {
    question: "とみみ庵の「声付き耳かき音を作ってみた」シリーズが終了したのはいつ？",
    choices: ["2018年2月", "2016年12月", "2020年3月", "2019年8月"],
    correct: 0,
    explanation: "とみみ庵は2018年2月28日の「声付き耳かき音を作ってみた(終)」をもって活動を終了しました。藍月なくるが声を担当した炭酸ちゃんシリーズも含め、多くの人気作品を生み出したシリーズでした。",
    source: "ニコニコ動画"
  },
  {
    question: "2019年にfengから発売されたPCゲーム『夢と色でできている』のEDテーマ「これくらいで」の作曲者は？",
    choices: ["堀江晶太", "Akki", "sky_delta", "kz"],
    correct: 0,
    explanation: "「これくらいで」の作詞・作曲・編曲はすべて堀江晶太が手がけました。堀江晶太はPENGUIN RESEARCHのベーシストとしても知られるクリエイターです。",
    source: "VGMdb / feng公式"
  },
  {
    question: "藍月なくるのNacollectionシリーズの3作目のタイトル表記は？",
    choices: ["Nacollection -3-", "3rd Nacollection!", "Nacollection III", "Nacollection Three"],
    correct: 0,
    explanation: "シリーズ3作目は『Nacollection -3-』という表記です。1作目「Nacollection!」、2作目「2nd Nacollection!」に続き、ナンバリング表記が毎回異なるのがシリーズの特徴です。",
    source: "BOOTH / aitsukinakuru.com"
  },
  {
    question: "藍月なくるの活動初期のニコニコ動画での名義は？",
    choices: ["なくる", "藍月", "nakuru", "月詠なくる"],
    correct: 0,
    explanation: "活動初期はシンプルに「なくる」名義でニコニコ動画に歌ってみた動画を投稿していました。後に「藍月なくる」として活動名を改めています。",
    source: "ニコニコ動画投稿履歴 / ニコニコ大百科"
  },
  {
    question: "藍月なくると棗いつきの2人によるコラボの通称は？",
    choices: ["いつきんくる", "なくいつ", "ツキナツ", "ブルーデイト"],
    correct: 0,
    explanation: "藍月なくると棗いつきのコラボは「いつきんくる」の通称で親しまれています。ともに株式会社一二三所属のシンガーで、多数のコラボ楽曲をリリースしています。",
    source: "YouTube / 公式X"
  },
  {
    question: "NTRじの番外編「藍月なくる、茎わかめを食す」のスポンサーは？",
    choices: ["壮関", "なとり", "カルビー", "三幸製菓"],
    correct: 0,
    explanation: "茎わかめメーカーの株式会社壮関がスポンサーとなり、2018年3月30日に音泉で配信されました。藍月なくるがバイノーラル録音で茎わかめの魅力を語り食べる特別企画です。",
    source: "PR TIMES / 音泉"
  },
  {
    question: "NTRじのパーソナリティは？",
    choices: ["杏花とかの仔", "藍月なくると棗いつき", "sky_deltaとnayuta", "とみみと周防パトラ"],
    correct: 0,
    explanation: "NTRじのパーソナリティは杏花とかの仔です（第40回より大総統シャワノが加入）。藍月なくるは第2回にゲストとして出演し、茎わかめ好きが広く知られるきっかけとなりました。",
    source: "音泉 / Weblio"
  },
  {
    question: "La priereでの藍月なくるの担当属性は？",
    choices: ["クール", "パッション", "キュート", "ミステリアス"],
    correct: 0,
    explanation: "La priereでの藍月なくるの担当属性は「クール」（イメージカラー: 水色）です。棗いつきが「パッション」（黄色）、nayutaが「キュート」（ピンク）を担当しています。",
    source: "La priere公式 / Wikipedia"
  },
  {
    question: "藍月なくるの個人サークル名は？",
    choices: ["クラリムステラ", "ブルームーン", "エンドルフィン", "ラプリエール"],
    correct: 0,
    explanation: "藍月なくるの個人サークル名は「クラリムステラ（Clarimstella）」。コミケやM3などの同人即売会でこの名義で頒布活動を行っています。1st LIVEのタイトルにもなりました。",
    source: "コミケカタログ / M3公式"
  },
  {
    question: "ウグイスカグラのPCゲーム『空に刻んだパラレログラム』のOP主題歌を歌った藍月なくるの楽曲名は？",
    choices: ["クオリアの輪郭", "これくらいで", "FAKE IDOL", "何も知らないまま。"],
    correct: 0,
    explanation: "「クオリアの輪郭」は2018年12月にウグイスカグラから発売された美少女ゲーム『空に刻んだパラレログラム』のOP主題歌です。作詞・作曲はめと氏が手がけました。なお、藍月なくるはfengの『夢と色でできている』（2019年）でもED主題歌「これくらいで」を担当しており、美少女ゲーム主題歌の歌唱実績が複数あります。",
    source: "aitsukinakuru.com / Wikipedia"
  },
  {
    question: "Endorfin.の2nd LIVEのタイトルと開催会場は？",
    choices: ["Cirro.Strato / Kanadevia Hall", "Horizon Note / Zepp Tokyo", "Alt.Strato / 日本武道館", "Dream Blue / 幕張メッセ"],
    correct: 0,
    explanation: "Endorfin. 2nd LIVE「Cirro.Strato」は2026年9月26日にKanadevia Hall（TOKYO DOME CITY HALL）で開催予定です。開演17:00、終演20:00予定で、生バンドメンバーも参加する本格的なライブです。",
    source: "aitsukinakuru.com / イープラス"
  },
  {
    question: "藍月なくるのYouTubeチャンネルの総再生回数はおよそ何回？（2026年時点）",
    choices: ["約1億1000万回", "約3000万回", "約5億回", "約500万回"],
    correct: 0,
    explanation: "藍月なくるのYouTubeチャンネル総再生回数は2026年4月時点で約1億1000万回を超えています。歌ってみた動画やオリジナルMV、ライブ映像など幅広いコンテンツが人気です。",
    source: "YouTube / userlocal.jp"
  },
  {
    question: "Endorfin.のCOLOURSシリーズは全何作？",
    choices: ["4作", "2作", "3作", "6作"],
    correct: 0,
    explanation: "Endorfin.のCOLOURSシリーズは「COLOURS.01 Growing」「COLOURS.02 Blurred Mind」「COLOURS.03 Redraw」「COLOURS.04 Yelling」の全4作です。各作品が異なるテーマカラーとコンセプトを持っています。",
    source: "ototoy.jp / docomo.ne.jp"
  },
  {
    question: "藍月なくるの楽曲「FAKE IDOL」のMVイラストを担当したのは？",
    choices: ["沼田ゾンビ", "かねこあみ", "猫山桜梨", "redjuice"],
    correct: 0,
    explanation: "「FAKE IDOL」のMV・イラストは沼田ゾンビ氏が担当しました。作詞・作曲はAkkiで、7thアルバム『Counterfeit』のリード曲的な位置づけの楽曲です。",
    source: "YouTube / typing-tube.net"
  },
  {
    question: "藍月なくるの初の全国流通ソロシングルのタイトルは？",
    choices: ["何も知らないまま。", "FAKE IDOL", "Luminous Rage", "これくらいで"],
    correct: 0,
    explanation: "2024年12月18日にリリースされた「何も知らないまま。」は、藍月なくるにとって初の全国流通ソロシングルです。アメリカ民謡研究会のHaniwaが作曲を手がけ、カップリング曲「キラアメイド」も収録。同人即売会で活動を積み上げてきたなくるが、全国のCDショップに作品を並べるという大きな節目となった一枚です。",
    source: "aitsukinakuru.com / レコチョク"
  },
  {
    question: "Endorfin.のアルバム『Alt.Strato』のリリース年は？",
    choices: ["2018年", "2016年", "2020年", "2019年"],
    correct: 0,
    explanation: "『Alt.Strato』は2018年にリリースされたEndorfin.のアルバムです。SOUND VOLTEX収録曲「Four Leaves」のフルバージョン（Extended Ver.）も収録されており、ユニットの代表作の一つです。",
    source: "Apple Music / ototoy.jp"
  },
  {
    question: "Endorfin.のアルバム『Stories of Eve』のリリース年は？",
    choices: ["2019年", "2017年", "2020年", "2016年"],
    correct: 0,
    explanation: "『Stories of Eve』は2019年にリリースされたEndorfin.のアルバムです。pop'n music収録曲「white night story」のロングバージョンも収録されており、物語性のあるコンセプトが特徴的な作品です。",
    source: "tanocstore.net / Apple Music"
  },
  {
    question: "Endorfin.のアルバム『Horizon Claire』のリリース年は？",
    choices: ["2020年", "2018年", "2021年", "2019年"],
    correct: 0,
    explanation: "『Horizon Claire』は2020年にリリースされたEndorfin.のアルバムです。1stアルバム『Horizon Note』と対になるタイトルで、CHUNITHM収録曲「Innocent Truth」のロングバージョンも収録されています。「Note（音符）」から「Claire（明るい）」へ、ユニットの成長が込められたタイトルです。",
    source: "Apple Music / YouTube"
  },
  {
    question: "藍月なくると棗いつきのコラボ第1弾シングルのタイトルは？",
    choices: ["追想のラグナロク", "約束のリンカネーション", "Not a Hero", "永遠のセレナーデ"],
    correct: 0,
    explanation: "いつきんくるコラボ第1弾シングル「追想のラグナロク」は2023年10月18日にリリースされました。藍月なくる盤と棗いつき盤でそれぞれソロバージョンが収録されています。",
    source: "YouTube / ototoy.jp"
  },
  {
    question: "2026年の藍月なくる×棗いつきのPOP-UP STOREが開催された場所は？",
    choices: ["池袋P'PARCO", "渋谷109", "新宿マルイ", "秋葉原ラジオ会館"],
    correct: 0,
    explanation: "『藍月なくる×棗いつき×無來×ナツメイツキ』POPUP STORE ～summer festival～は、2026年6月26日から7月8日まで池袋P'PARCO 3Fの「eeo POP-UP STORE」で開催されました。",
    source: "aitsukinakuru.com / eeo公式"
  },
  {
    question: "2026年の「Spring Trip Compass」イベントで東京タワーとコラボした企画は？",
    choices: ["ラリー企画", "ライブ配信", "VR体験", "プラネタリウム上映"],
    correct: 0,
    explanation: "「Spring Trip Compass: 4人と辿る、東京満喫 春の旅編」では東京タワー内を巡るラリー企画が実施されました。ラリーシート完走で描き下ろし楽曲収録の限定CDが特典として配布されました。",
    source: "aitsukinakuru.com / GREE STORE"
  },
  {
    question: "藍月なくるがTRPG配信で主にプレイしているシステムは？",
    choices: ["クトゥルフ神話TRPG", "ソード・ワールド", "ダンジョンズ＆ドラゴンズ", "ロードス島戦記"],
    correct: 0,
    explanation: "藍月なくるはTRPG配信でクトゥルフ神話TRPG（第6版・第7版）を最も多くプレイしています。他にもエモクロアTRPGなどのセッション配信にも積極的に参加しています。",
    source: "YouTube配信 / note.com"
  },
  {
    question: "藍月なくるのカバーアルバム『Cover Collection Vol.1』の収録曲数は？",
    choices: ["全9曲", "全5曲", "全12曲", "全7曲"],
    correct: 0,
    explanation: "2024年リリースの『藍月なくるCover Collection Vol.1』は全9曲収録。「初恋日記」「フォニイ」「深海のリトルクライ」「命に嫌われている」「君の知らない物語」などの人気カバーが収められています。",
    source: "aitsukinakuru.com / BOOTH"
  },
  {
    question: "La priereの2ndアルバムのタイトルは？",
    choices: ["Galaxy Triangle", "Gemini Syndrome", "Chronologue", "Glowings"],
    correct: 0,
    explanation: "La priereの2ndアルバム『Galaxy Triangle』は2020年12月30日にリリースされました。1stアルバム『Gemini Syndrome』に続く作品です。",
    source: "La priere公式 / Wikipedia"
  },
  {
    question: "藍月なくるのすだちそばテーマソング「すーぱーだいちゅき♡そばにいてっ」が収録されたシングルは？",
    choices: ["Poisson Poison", "Counterfeit", "何も知らないまま。", "ご注文はえいえんに"],
    correct: 0,
    explanation: "「すーぱーだいちゅき♡そばにいてっ」は2025年12月24日発売の両A面シングル「Poisson Poison／すーぱーだいちゅき♡そばにいてっ」に収録されました。作詞・作編曲はAkkiが担当。",
    source: "公式サイト / PR TIMES"
  },
  {
    question: "Endorfin.の2026年リリースの最新アルバムのタイトルは？",
    choices: ["Cirro.Strato", "Horizon Claire", "Dream Blue", "COLOURS.04"],
    correct: 0,
    explanation: "Endorfin.の2026年最新アルバムは『Cirro.Strato』です。2nd LIVE（2026年9月26日 Kanadevia Hall）のタイトルにもなっており、ユニット結成から10年以上の集大成的な作品です。",
    source: "ototoy.jp / aitsukinakuru.com"
  },
  {
    question: "La priereの3rdアルバムのタイトルは？",
    choices: ["Chronologue", "Gemini Syndrome", "Galaxy Triangle", "Glowings"],
    correct: 0,
    explanation: "La priereの3rdアルバム『Chronologue』は2022年8月13日にリリースされました。12ヶ月連続新曲リリース企画の成果も反映された作品です。",
    source: "La priere公式 / Wikipedia"
  },
  {
    question: "藍月なくるのNacollectionシリーズの記念すべき1作目の正式タイトルは？",
    choices: ["Nacollection!", "Nacollection 1st", "First Nacollection", "The Nacollection"],
    correct: 0,
    explanation: "シリーズ1作目は『Nacollection!』です。以降「2nd Nacollection!」「Nacollection -3-」「Nacollection4」と続くこのシリーズは、毎回ナンバリング表記が異なるのが特徴で、藍月なくるの個性が表れています。",
    source: "BOOTH / aitsukinakuru.com"
  },
  {
    question: "La priereの1stアルバム『Gemini Syndrome』で、sky_deltaが作詞・作曲を手がけた楽曲は？",
    choices: ["鏡像のカノン", "永訣のGemini", "Atonement Twins", "君よ"],
    correct: 0,
    explanation: "「鏡像のカノン」はsky_deltaが作詞・作曲を担当し、nayutaがメインボーカル、棗いつきと藍月なくるがコーラスを務めた楽曲です。sky_deltaはEndorfin.での藍月なくるとのタッグでも知られますが、La priereへの楽曲提供でも存在感を発揮しています。",
    source: "diverse.direct / VGMdb"
  },
  {
    question: "La priereの1stアルバム『Gemini Syndrome』で、Feryquitousが作詞・作曲を手がけた楽曲は？",
    choices: ["Atonement Twins", "鏡像のカノン", "永訣のGemini", "triune castor"],
    correct: 0,
    explanation: "「Atonement Twins」はFeryquitous（フェリキタス）が作詞・作曲を手がけた楽曲です。Feryquitousは藍月なくるとのコラボ楽曲「Evil Bubble」でも知られる実力派コンポーザーで、La priereにも楽曲を提供しています。",
    source: "diverse.direct / VGMdb"
  },
  {
    question: "La priereの1stアルバム『Gemini Syndrome』の最終曲で、フランス語のタイトルがつけられた楽曲は？",
    choices: ["Quand on prie la bonne etoile", "triune castor", "Atonement Twins", "それは世界を越えて"],
    correct: 0,
    explanation: "「Quand on prie la bonne etoile」はRD-Soundsが作曲した最終曲で、フランス語で「良い星に祈る時」を意味します。ユニット名「La priere（祈り）」に呼応する美しいタイトルで、アルバムの締めくくりにふさわしい楽曲です。",
    source: "diverse.direct / VGMdb"
  },
  {
    question: "La priereの1stアルバム『Gemini Syndrome』で「永訣のGemini」の作詞を手がけたメンバーは？",
    choices: ["棗いつき", "藍月なくる", "nayuta", "sky_delta"],
    correct: 0,
    explanation: "「永訣のGemini」の作詞は棗いつきが担当し、作曲はかそかそが手がけました。棗いつきはシンガーとしてだけでなく、作詞家としても才能を発揮しており、La priereの世界観構築に大きく貢献しています。",
    source: "diverse.direct / VGMdb"
  },
  {
    question: "La priereの4thアルバムのタイトルは？",
    choices: ["Glowings", "Chronologue", "Galaxy Triangle", "Gemini Syndrome"],
    correct: 0,
    explanation: "La priereの4thアルバム『Glowings』は2023年3月27日にリリースされました。12ヶ月連続新曲リリース企画やライブツアーを経て、ユニットとしてさらに成熟した音楽性を見せた作品です。",
    source: "La priere公式 / Wikipedia"
  },
  {
    question: "La priereが2021年に実施した12ヶ月連続新曲リリース企画は、何月から何月まで？",
    choices: ["1月から12月", "4月から翌3月", "7月から翌6月", "10月から翌9月"],
    correct: 0,
    explanation: "La priereは2021年の1月から12月まで毎月1曲ずつ新曲をリリースし続けるという挑戦的な企画を完遂しました。12曲全てが異なるテイストの楽曲で、ユニットの音楽的な幅広さを示すとともに、制作力の高さを証明しました。",
    source: "Wikipedia / La priere公式"
  },
  {
    question: "Endorfin.が2016年のコミックマーケット90（C90）で頒布したアルバムのタイトルは？",
    choices: ["Sincuvate", "Horizon Note", "Raindrop Caffe Latte", "純情ティータイム"],
    correct: 0,
    explanation: "『Sincuvate』は2016年8月14日のC90で頒布されたEndorfin.の2ndアルバム（EP）です。1stアルバム『Horizon Note』のM3リリースからわずか数ヶ月後のリリースで、結成初年から精力的な活動を見せていました。",
    source: "Wikipedia / tanocstore.net"
  },
  {
    question: "La priereのカバーアルバム『La priere Cover Collection』のリリース日は？",
    choices: ["2021年12月31日", "2020年8月15日", "2022年3月1日", "2023年5月5日"],
    correct: 0,
    explanation: "『La priere Cover Collection』は2021年12月31日にリリースされました。3rdアルバム『Chronologue』の前にリリースされたカバー作品で、3人のハーモニーで既存の人気楽曲を再解釈した作品です。",
    source: "La priere公式 / Wikipedia"
  },
  {
    question: "Endorfin.の2025年にリリースされたアルバム2作のタイトルは？",
    choices: ["Dream Blueと雨雫とプレアデス", "Cirro.Stratoと純情ティータイム", "Horizon ClaireとAlt.Strato", "COLOURS.03とCOLOURS.04"],
    correct: 0,
    explanation: "Endorfin.は2025年に『Dream Blue』と『雨雫とプレアデス』の2作をリリースしました。結成10周年を迎えた年にふさわしい精力的なリリースで、ユニットの創作意欲の高さが伺えます。",
    source: "ototoy.jp / YouTube"
  },
  {
    question: "Endorfin.のアルバム『モノローグ・オフ』のリリース年は？",
    choices: ["2021年", "2019年", "2023年", "2020年"],
    correct: 0,
    explanation: "『モノローグ・オフ』は2021年にリリースされたEndorfin.のアルバムです。Arcaea収録曲「Alice's Suitcase」も含まれており、物語性のある楽曲が特徴的な作品です。",
    source: "dojin-music.info / YouTube"
  },
  {
    question: "La priereのメンバーで「パッション」担当（イメージカラー: 黄色）は誰？",
    choices: ["棗いつき", "藍月なくる", "nayuta", "sky_delta"],
    correct: 0,
    explanation: "La priereの「パッション」担当は棗いつき（イメージカラー: 黄色）です。藍月なくるが「クール」（水色）、nayutaが「キュート」（ピンク）を担当しており、3人がそれぞれ異なる魅力で補い合うバランスの良いユニットです。",
    source: "La priere公式 / Wikipedia"
  },
  {
    question: "La priereの楽曲で2026年1月に配信された、攻撃的なタイトルの楽曲は？",
    choices: ["バッドビートベイビー", "Aftertide", "Ritus Inanis", "Nautical Star"],
    correct: 0,
    explanation: "「バッドビートベイビー」は2026年1月に配信されたLa priereのシングル楽曲です。従来の美しいハーモニー路線に加え、パンチの効いたタイトルと楽曲でユニットの新たな一面を見せました。",
    source: "La priere公式 / Apple Music"
  },
  {
    question: "La priereの楽曲で2026年4月に配信された最新シングルは？",
    choices: ["Aftertide", "バッドビートベイビー", "Ritus Inanis", "SPLASH the TONE"],
    correct: 0,
    explanation: "「Aftertide」は2026年4月に配信されたLa priereの最新シングルです。「Aftertide」は「引き潮の後」を意味する英語で、3人の歌声が織りなす深い余韻のある楽曲です。",
    source: "La priere公式 / レコチョク"
  },
  {
    question: "藍月なくるの1st LIVE「クラリムステラ」のセットリスト1曲目を飾った楽曲は？",
    choices: ["Azura Luno", "FAKE IDOL", "Cosmodiver", "Horizon Note"],
    correct: 0,
    explanation: "1st LIVE「クラリムステラ」（2024年2月4日/市川市文化会館）のオープニングを飾ったのは「Azura Luno」でした。その後「Cosmodiver」「コトノハ」「Oxydlate」「Horizon Note」「花残り、蕾ひとつ」「彗星のパラソル」「これくらいで」などが披露されました。なお、この公演の模様を収録したBlu-rayも発売されています。",
    source: "note.com / aitsukinakuru.shop"
  },
  {
    question: "La priereの初ワンマンライブ「Three piece!!!」が開催された会場は？",
    choices: ["harevutai（池袋）", "Zepp DiverCity", "LINE CUBE SHIBUYA", "市川市文化会館"],
    correct: 0,
    explanation: "La priereの1stワンマンライブ「Three piece!!!」は2022年8月27日（土）に東京・池袋のharevutaiで開催されました。クラウドファンディングで目標額700%超を達成するほどの期待を集めたライブで、3人のハーモニーが初めてワンマンステージで披露された記念碑的な公演でした。",
    source: "La priere公式 / eventernote.com"
  },
  {
    question: "La priereの「Three piece!!!」追加公演「Three piece!!! ∞」の会場は？",
    choices: ["Zepp DiverCity(TOKYO)", "harevutai", "BIGCAT", "ダイアモンドホール"],
    correct: 0,
    explanation: "初ワンマンの大成功を受けて開催された追加公演「Three piece!!! ∞」は、2023年1月28日（土）にZepp DiverCity(TOKYO)で行われました。池袋harevutaiからZepp DiverCityへと、より大きな会場にスケールアップしたことがユニットの勢いを物語っています。",
    source: "eventernote.com / 7uta.com"
  },
  {
    question: "La priereの1st Live Tour「SPLASH the TONE」で回った3都市は？",
    choices: ["愛知・東京・大阪", "東京・大阪・福岡", "北海道・東京・大阪", "東京・名古屋・広島"],
    correct: 0,
    explanation: "La priere 1st Live Tour「SPLASH the TONE」は2023年に愛知（7/29 ダイアモンドホール）、東京（8/19 Zepp DiverCity）、大阪（9/2 BIGCAT）の3都市で開催されました。各日程とも昼夜2回公演が行われ、3人の歌声が全国のファンに届けられました。",
    source: "7uta.com / eventernote.com"
  },
  {
    question: "Endorfin. 1st LIVE「Horizon Dream」が開催された会場は？",
    choices: ["ところざわサクラタウン ジャパンパビリオン", "立川ステージガーデン", "LINE CUBE SHIBUYA", "Kanadevia Hall"],
    correct: 0,
    explanation: "Endorfin. 1st LIVE「Horizon Dream」は2025年11月24日（月・祝）に、ところざわサクラタウン ジャパンパビリオン ホールAで開催されました。結成10年にして初のワンマンライブで、sky_deltaと藍月なくるの集大成的なステージとなりました。",
    source: "endorfin.info / tokorozawa-sakuratown.com"
  },
  {
    question: "Endorfin. 1st LIVEのタイトル「Horizon Dream」の由来となったアルバムは？",
    choices: ["1stアルバム『Horizon Note』", "6thアルバム『Horizon Claire』", "4thアルバム『Alt.Strato』", "最新アルバム『Cirro.Strato』"],
    correct: 0,
    explanation: "1st LIVEタイトル「Horizon Dream」は、1stアルバム『Horizon Note』の「Horizon」を冠しています。原点であるデビュー作の精神を継承しつつ、「Dream（夢）」を加えることで10年の歩みと未来への展望を込めたタイトルです。2025年にリリースされたアルバム『Dream Blue』とも呼応しています。",
    source: "endorfin.info / YouTube"
  },
  {
    question: "Birthday LIVE 2025「概念／質量」の夜公演「質量」で特徴的だった楽器編成は？",
    choices: ["バイオリンを含む生バンド", "フルオーケストラ", "アコースティックギター弾き語り", "打ち込みDJ"],
    correct: 0,
    explanation: "夜公演「質量」ではバイオリンを交えた生バンド編成でのシンフォニックなソロコンサートが行われました。昼公演「概念」がバーチャル3Dライブだったのに対し、「質量」は生身の姿での演奏という対照的な構成で、「リアルとバーチャルを行き来するシンガー」を体現したイベントでした。",
    source: "note.com / gamebiz.jp"
  },
  {
    question: "「Spring Trip Compass」イベントのコラボカフェが開催された秋葉原の店名は？",
    choices: ["cafe MENU", "コラボカフェAKIBA", "メイドカフェ@ほぉ〜む", "アニメイトカフェ"],
    correct: 0,
    explanation: "「Spring Trip Compass: 4人と辿る、東京満喫 春の旅編」（2026年4/17〜5/10）のコラボカフェは秋葉原の「cafe MENU」で開催されました。藍月なくる・棗いつき監修のコラボドリンクやフードメニューが提供され、特典コースターも配布されました。",
    source: "PR TIMES / ladytopi.jp"
  },
  {
    question: "2024年のファンイーティング「ご注文はえいえんに！」の初回開催会場は？",
    choices: ["YOKOHAMA COAST garage+", "Billboard Live TOKYO", "Zepp DiverCity", "LINE CUBE SHIBUYA"],
    correct: 0,
    explanation: "ファンイーティング2024「ご注文はえいえんに！～深海喫茶なく茶屋へようこそ～」の初回公演は2024年10月5日にYOKOHAMA COAST garage+で開催されました。その好評を受け、2025年1月11日にGARDEN 新木場 FACTORYで「おかわり」公演も実施されました。",
    source: "aitsukinakuru.com / 公式X"
  },
  {
    question: "Endorfin.の1stアルバム『Horizon Note』が初頒布された即売会は？",
    choices: ["M3（2016年春）", "コミックマーケット89", "ボーマス35", "コミティア116"],
    correct: 0,
    explanation: "Endorfin.の1stアルバム『Horizon Note』は2016年春のM3（音系・メディアミックス同人即売会）で初頒布されました。同年夏のC90では2ndアルバム『Sincuvate』を頒布しており、結成初年から精力的にリリースを行っていました。",
    source: "Wikipedia / tanocstore.net"
  },
  {
    question: "藍月なくるの1st LIVE「クラリムステラ」のタイトルは、ある名義と同じです。その名義とは？",
    choices: ["個人サークル名", "ファンクラブ名", "YouTubeチャンネル名", "アルバムタイトル"],
    correct: 0,
    explanation: "「クラリムステラ（Clarimstella）」は藍月なくるの個人サークル名です。コミケやM3などの同人即売会でこの名義で頒布活動を行っており、1st LIVEのタイトルに自身のサークル名を冠することで、同人活動から積み上げてきた道のりへの想いを込めました。",
    source: "コミケカタログ / aitsukinakuru.com"
  },
  {
    question: "La priereの1st Live Tour「SPLASH the TONE」の愛知公演の会場は？",
    choices: ["ダイアモンドホール", "名古屋市公会堂", "Zepp Nagoya", "日本特殊陶業市民会館"],
    correct: 0,
    explanation: "SPLASH the TONEの愛知公演は2023年7月29日にダイアモンドホールで開催されました。ツアー初日としてファンの期待を一身に受けた公演で、東京・大阪公演へと繋がる勢いを作りました。",
    source: "7uta.com / eventernote.com"
  },
  {
    question: "「Spring Trip Compass」の東京タワーラリー完走特典は？",
    choices: ["描き下ろし楽曲収録の限定CD", "サイン入りポストカード", "限定Tシャツ", "特製クリアファイル"],
    correct: 0,
    explanation: "東京タワー内を巡るラリーシートを完走すると、本コラボのために書き下ろされた楽曲を収録した限定CDが特典として配布されました。藍月なくる・棗いつき・無來・ナツメイツキの4人が参加する特別な音源で、イベント限定の貴重な品です。",
    source: "PR TIMES / gree-store.jp"
  },
  {
    question: "Endorfin. 2nd LIVE「Cirro.Strato」の開催予定日は？",
    choices: ["2026年9月26日", "2026年7月15日", "2026年12月1日", "2027年3月1日"],
    correct: 0,
    explanation: "Endorfin. 2nd LIVE「Cirro.Strato」は2026年9月26日（土）にKanadevia Hall（TOKYO DOME CITY HALL）で開催予定です。開演17:00、終演20:00予定。生バンドメンバー（Gt.三矢禅晃、Ba.Kei Nakamura、Dr.樋口幸佑、Mani.北原純平）も参加する本格的なライブです。",
    source: "aitsukinakuru.com / イープラス"
  },
  // ===== カテゴリ: ディスコグラフィー深堀り =====
  {
    question: "藍月なくるのアルバム「ミシュメリア」のコンセプトモチーフは？",
    choices: ["毒花", "深海", "星空", "鏡"],
    correct: 0,
    explanation: "『ミシュメリア』（2023年4月30日、M3-2023春頒布）のコンセプトは「甘く美しく貴方を浸食する毒花」。全7曲収録で、bermei.inazawa、グシミヤギヒデユキ、かめりあ、Feryquitous、高城みよなど豪華な作曲陣が参加。Hifumi,inc.との共同制作第2弾として制作されました。",
    source: "diverse.direct / ototoy.jp"
  },
  {
    question: "「ミシュメリア」でかめりあが楽曲提供した曲名は？",
    choices: ["Tuliparfeit", "逆沙華", "Fragile Utopia", "Lucid Hallucination"],
    correct: 0,
    explanation: "かめりあ（Camellia）が作詞・作曲を手がけた「Tuliparfeit」は『ミシュメリア』の4曲目に収録されています。かめりあはSOUND VOLTEXやbeatmania IIDXなどで「ΩΩPARTS」「Xronial Xero」などを手がけた音楽ゲーム界の大御所コンポーザー。そんなかめりあが藍月なくるに楽曲提供したことは、なくるの音楽ゲーム界での存在感の大きさを物語っています。",
    source: "diverse.direct / vgmdb.net"
  },
  {
    question: "藍月なくるの9thアルバム「ILLUAMOR」のリリース日は？",
    choices: ["2026年4月26日", "2025年12月1日", "2026年3月1日", "2025年8月31日"],
    correct: 0,
    explanation: "『ILLUAMOR（イリュアモール）』は2026年4月26日にリリースされた9thアルバムです。全6曲収録で、Laur、グシミヤギヒデユキ、香椎モイミ、アメリカ民謡研究会、かぼちゃ、みゅー（Imy）が作曲を担当。ジャケットイラストはRato、デザインは喪花が手がけています。",
    source: "diverse.direct / aitsukinakuru.com"
  },
  {
    question: "「Indigrotto」が初頒布された即売会と時期は？",
    choices: ["M3-49（2022年春）", "コミケC101（2022年冬）", "M3-2023春", "コミケC99（2021年冬）"],
    correct: 0,
    explanation: "『Indigrotto』は2022年4月24日のM3-49（2022年春）で初頒布されたアルバムです。全6曲収録で「Indigrotto」「夢の呼応」「Settlement」「Killer neuron」「Codependence」「Rest in Peace my Dear.」が含まれています。",
    source: "ototoy.jp / acgjc.com"
  },
  // ===== カテゴリ: ゲームタイアップ =====
  {
    question: "アニプレックス販売のゲーム「Hookah Haze」の主題歌「Hookah, whoo!」の作詞を手がけたのは？",
    choices: ["DECO*27", "tepe", "sky_delta", "堀江晶太"],
    correct: 0,
    explanation: "「Hookah, whoo!」はDECO*27（OTOIRO）がサウンドプロデュース・作詞を、tepe（OTOIRO）が作曲・編曲を担当しました。ヒューマンドラマアドベンチャーゲーム『Hookah Haze（フーカーヘイズ）』の主題歌で、2024年4月27日より配信開始。ゲーム本編は2024年7月11日にSteam/Nintendo Switchで発売されました。",
    source: "hookah-haze.com / famitsu.com"
  },
  // ===== カテゴリ: MVクリエイター =====
  {
    question: "「エモーション・キャプチャー」のMVイラストを担当した韓国出身のイラストレーターは？",
    choices: ["Nardack", "茲助", "葉丸", "茉宮祈芽"],
    correct: 0,
    explanation: "「エモーション・キャプチャー」のイラストはNardackが担当しました。Nardackは韓国出身のイラストレーターで、繊細で幻想的な画風が特徴。MVの映像制作は古渡勧（Hifumi,inc.）が担当しています。",
    source: "YouTube MV概要欄 / aitsukinakuru.com"
  },
  {
    question: "「フェイク」（Feryquitous feat. 藍月なくる）のMV映像制作を担当したのは？",
    choices: ["足立柑橘", "沼田ゾンビ", "千金楽らう", "古渡勧"],
    correct: 0,
    explanation: "「フェイク」のMV映像は足立柑橘が制作し、イラストは茲助が担当しました。Feryquitous（フェリキタス）と藍月なくるのコラボ楽曲で、『Nacollection -3-』にも収録。Feryquitousは「月詠に鳴る」（CHUNITHM収録）でもなくるとコラボしており、音楽ゲーム界での繋がりが深いコンポーザーです。",
    source: "YouTube MV概要欄"
  },
  {
    question: "「何も知らないまま。」のカップリング曲は？",
    choices: ["キラアメイド", "FAKE IDOL", "Cosmodiver", "Azura Luno"],
    correct: 0,
    explanation: "初の全国流通ソロシングル「何も知らないまま。」のカップリング曲は「キラアメイド」です。キラアメイドのMVではdotMP incがリリック・ロゴデザインを担当しています。",
    source: "diverse.direct / aitsukinakuru.com"
  },
  {
    question: "「happy palette♪」のMVイラストを担当したのは？",
    choices: ["茉宮祈芽", "Nardack", "よういち", "葉丸"],
    correct: 0,
    explanation: "ハミダシクリエイティブ凸の華乃ルートED曲「happy palette♪」のイラストは茉宮祈芽が担当し、MVは千金楽らうが制作しました。美少女ゲームのED曲らしい、あたたかく優しいビジュアルが特徴です。",
    source: "YouTube MV概要欄"
  },
  // ===== カテゴリ: 配信・エピソード =====
  {
    question: "藍月なくるの雑談配信の定番シリーズの通称は？",
    choices: ["ぐだなく", "なくラジ", "おやなく", "まったりなく"],
    correct: 0,
    explanation: "「ぐだなく」は「ぐだぐだな藍月なくる」の略称で、本人がリラックスして雑談やゲームをする配信をファンがそう呼ぶようになりました。楽曲制作の進捗やM3の頒布物の話、ライブの振り返りなど、音楽活動の裏話が聞ける人気コンテンツです。",
    source: "YouTube配信アーカイブ"
  },
  {
    question: "「Nacollection4」が初頒布された即売会は？",
    choices: ["M3-2023秋", "M3-2023春", "コミケC103", "コミケC104"],
    correct: 0,
    explanation: "『Nacollection4』は2023年10月29日のM3-2023秋で初頒布されました（デジタル配信は12月1日）。収録曲は「Cosmodiver」（かそかそ作曲）「ルナティッククレイジー」（Cover）「ヘヴンリィ」（フユウ作曲）「閃耀」（Cover）「Monodrate」「トワイライト」（Feryquitous作曲）の全6曲です。",
    source: "aitsukinakuru.com / ototoy.jp"
  },
  {
    question: "藍月なくるの全国流通ソロシングル第2弾（両A面）のタイトルは？",
    choices: ["Poisson Poison／すーぱーだいちゅき♡そばにいてっ", "何も知らないまま。／キラアメイド", "FAKE IDOL／Evil Bubble", "Cosmodiver／Azura Luno"],
    correct: 0,
    explanation: "2025年12月24日リリースの全国流通ソロシングル第2弾は「Poisson Poison／すーぱーだいちゅき♡そばにいてっ」の両A面仕様です。「すーぱーだいちゅき♡そばにいてっ」は徳島県すだちそばコラボから生まれたテーマソングで、シングルCDに昇格した形です。",
    source: "aitsukinakuru.com / diverse.direct"
  },
  // ===== カテゴリ: 声優活動・コラボ =====
  {
    question: "藍月なくるが声優として「ニーナ」役を担当したゲームは？",
    choices: ["クリミナルガールズX", "Hookah Haze", "パルティグランデ", "プロジェクトセカイ"],
    correct: 0,
    explanation: "藍月なくるはゲーム『クリミナルガールズX』でニーナ役のキャラクターボイスを担当しました。ASMR「炭酸ちゃん」シリーズでの声優活動は有名ですが、ゲームキャラクターのCV出演としてはこちらが代表的な作品です。",
    source: "dengekionline.com / Wikipedia"
  },
  {
    question: "2025年6月に新江ノ島水族館で開催されたStory Live「JelLaboratory」の会場となったホールは？",
    choices: ["クラゲファンタジーホール", "相模湾ゾーンホール", "太平洋ホール", "ディスカバリーホール"],
    correct: 0,
    explanation: "Story Live「JelLaboratory」は2025年6月7日に新江ノ島水族館のクラゲファンタジーホールで開催されました。クラゲ好きのなくるにとって特別な場所でのライブで、コラボグッズとしてジグソーパズル、アクリルジオラマ、クッキー、パスケース、ピンバッジ、「なくらげミニぬいぐるみ」の全6種が販売されました。",
    source: "aitsukinakuru.com"
  },
  {
    question: "2024年に藍月なくるがゲーム内コラボしたタイトルと、コラボイベント名は？",
    choices: ["パルティグランデ「アクアリウムのその先に」", "プロジェクトセカイ「月と星の旋律」", "原神「潮風の歌声」", "ブルーアーカイブ「深海のセレナーデ」"],
    correct: 0,
    explanation: "2024年9月30日から10月31日にかけて、リズムゲーム『パルティグランデ』にて藍月なくるコラボイベント「アクアリウムのその先に」が開催されました。なくるがゲーム内キャラクターとして登場し、限定ガチャ「アクアリウムのその先に」でコラボ限定カードが入手可能に。さらにコラボ楽曲もゲーム内に収録され、プレイできるようになりました。クラゲやアクアリウムをモチーフにした、なくるらしいコラボ内容が話題を呼びました。",
    source: "PR TIMES"
  },
  // ===== カテゴリ: TVアニメタイアップ =====
  {
    question: "藍月なくる＆棗いつきが歌うTVアニメ『LV999の村人』のOPテーマの曲名は？",
    choices: ["Not a Hero", "Luminous Rage", "約束のリンカネーション", "Mirroring Mirage"],
    correct: 0,
    explanation: "2026年7月放送開始のTVアニメ『LV999の村人』のOPテーマ「Not a Hero」を藍月なくる＆棗いつきが歌唱しています。2人の3rdシングルとして2026年8月26日にリリース予定で、アニメイト全国店舗での発売記念イベントも開催されます。",
    source: "lv999-anime.com / PR TIMES"
  },
  {
    question: "「Not a Hero」（LV999の村人 OP）の作曲者で、LiSA「紅蓮華」の作曲でも知られる人物は？",
    choices: ["草野華余子", "堀江晶太", "DECO*27", "ryo"],
    correct: 0,
    explanation: "「Not a Hero」の作曲は草野華余子が担当しました。草野華余子はLiSAの「紅蓮華」の作曲者としても広く知られています。作詞は棗いつき、編曲はBLACK ALBATROSSが担当。藍月なくると棗いつきにとって、TVアニメのオープニングテーマという大きなステージでの楽曲です。",
    source: "lv999-anime.com / PR TIMES"
  },
  // ===== カテゴリ: TRPG配信 =====
  {
    question: "TRPG配信「ACTOR:0」で藍月なくると共演した、にじさんじ所属のVTuberは？",
    choices: ["周央サンゴ", "月ノ美兎", "葛葉", "社築"],
    correct: 0,
    explanation: "クトゥルフ神話TRPG「ACTOR:0」では、しぐれなお、高生紳士、そしてにじさんじ所属の周央サンゴと共演しました。KPはneonが担当。VTuber界隈を超えたコラボレーションで、なくるの演技力の高さが改めて注目された配信です。",
    source: "YouTube配信アーカイブ / atwiki.jp"
  },
  {
    question: "藍月なくるがTRPGから舞台化された作品「カタシロ」に出演した際の役は？",
    choices: ["もう一人の患者役", "主人公役", "ナレーション", "医者役"],
    correct: 0,
    explanation: "舞台版『カタシロ〜Relive vol.1〜』に「もう一人の患者役」として出演しました。原作はディズム氏が手がけた人気TRPGシナリオで、2024年12月にPARCO劇場にて上演。舞台上で出演者が生身でTRPGをプレイする「即興劇」形式で、結末がプレイヤー次第で変わる一度限りの物語です。ディズム氏自身がゲームマスター（医者役）として全公演に出演しました。",
    source: "parco.jp / kai-you.net"
  }
];

// ===== State =====
const state = {
  questions: [],
  currentIndex: 0,
  score: 0,
  streak: 0,
  maxStreak: 0,
  correctCount: 0,
  answered: false,
  totalQuestions: 10,
  timePerQuestion: 20,
  timer: null,
  timeLeft: 0,
  questionStartTime: 0,
  answerTimes: [],
  quizStartTime: 0,
};

// ===== DOM =====
const dom = {};

function cacheDom() {
  dom.btnStart = document.getElementById('btn-start');
  dom.totalQuestionsDisplay = document.getElementById('total-questions');
  dom.countOptions = document.querySelectorAll('#count-options .chip');
  dom.timeOptions = document.querySelectorAll('#time-options .chip');
  dom.score = document.getElementById('score');
  dom.currentQ = document.getElementById('current-q');
  dom.totalQ = document.getElementById('total-q');
  dom.streak = document.getElementById('streak');
  dom.progressFill = document.getElementById('progress-fill');
  dom.timerFill = document.getElementById('timer-fill');
  dom.questionArea = document.getElementById('question-area');
  dom.questionNumber = document.getElementById('question-number');
  dom.questionText = document.getElementById('question-text');
  dom.choicesArea = document.getElementById('choices-area');
  dom.resultArea = document.getElementById('result-area');
  dom.resultIcon = document.getElementById('result-icon');
  dom.resultText = document.getElementById('result-text');
  dom.explanationText = document.getElementById('explanation-text');
  dom.explanationSource = document.getElementById('explanation-source');
  dom.btnNext = document.getElementById('btn-next');
  dom.btnQuit = document.getElementById('btn-quit');
  dom.btnRestart = document.getElementById('btn-restart');
  dom.btnBackTitle = document.getElementById('btn-back-title');
  dom.finalScore = document.getElementById('final-score');
  dom.finalCorrect = document.getElementById('final-correct');
  dom.finalStreak = document.getElementById('final-streak');
  dom.finalAccuracy = document.getElementById('final-accuracy');
  dom.rankValue = document.getElementById('rank-value');
  dom.rankMessage = document.getElementById('rank-message');
  dom.keyboardHint = document.getElementById('keyboard-hint');
}

// ===== Init =====
function init() {
  cacheDom();
  loadBGMSettings();
  dom.totalQuestionsDisplay.textContent = ALL_QUESTIONS.length;
  // Sync volume slider
  const volSlider = document.getElementById('bgm-volume');
  if (volSlider) volSlider.value = Math.round(bgm.userVolume / 0.001);
  // Sync BGM UI
  updateMuteBtn();
  bindEvents();
  // Init audio and start title BGM on first interaction
  let audioInited = false;
  const initAndPlay = () => {
    if (audioInited) return;
    audioInited = true;
    initAudio();
    // Only start title BGM if we're on the start screen
    const activeScreen = document.querySelector('.screen.active');
    if (activeScreen && activeScreen.id === 'screen-start') {
      playBGM('title');
    }
    document.removeEventListener('click', initAndPlay);
    document.removeEventListener('keydown', initAndPlay);
  };
  document.addEventListener('click', initAndPlay, { once: false });
  document.addEventListener('keydown', initAndPlay, { once: false });
}

function bindEvents() {
  dom.btnStart.addEventListener('click', startQuiz);
  dom.btnNext.addEventListener('click', nextQuestion);
  dom.btnQuit.addEventListener('click', quitQuiz);
  dom.btnRestart.addEventListener('click', () => {
    resetState();
    startQuiz();
  });
  dom.btnBackTitle.addEventListener('click', () => {
    resetState();
    playBGM('title');
    showScreen('start');
  });

  // BGM controls
  document.getElementById('bgm-mute-btn').addEventListener('click', toggleBGMMute);
  document.getElementById('bgm-volume').addEventListener('input', (e) => {
    setBGMVolume(parseInt(e.target.value) * 0.001);
  });

  // Count options
  dom.countOptions.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.countOptions.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.totalQuestions = parseInt(btn.dataset.count);
    });
  });

  // Time options
  dom.timeOptions.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.timeOptions.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.timePerQuestion = parseInt(btn.dataset.time);
    });
  });

  // Keyboard
  document.addEventListener('keydown', handleKeydown);
}

function handleKeydown(e) {
  const activeScreen = document.querySelector('.screen.active');
  if (!activeScreen) return;
  const screenId = activeScreen.id;

  if (screenId === 'screen-quiz') {
    const num = parseInt(e.key);
    if (num >= 1 && num <= 4 && !state.answered) {
      e.preventDefault();
      selectAnswer(num - 1);
      return;
    }
    if (e.code === 'Enter' && state.answered) {
      e.preventDefault();
      nextQuestion();
      return;
    }
    if (e.code === 'Escape') {
      e.preventDefault();
      quitQuiz();
      return;
    }
  } else if (screenId === 'screen-start') {
    if (e.code === 'Enter') {
      e.preventDefault();
      startQuiz();
    }
  } else if (screenId === 'screen-result') {
    if (e.code === 'Enter') {
      e.preventDefault();
      resetState();
      startQuiz();
    }
  }
}

// ===== Screen Management =====
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById(`screen-${name}`);
  void screen.offsetWidth;
  screen.classList.add('active');
  if (dom.keyboardHint) {
    dom.keyboardHint.classList.toggle('visible', name === 'quiz');
  }
}

// ===== Utilities =====
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ===== Quiz Logic =====
function startQuiz() {
  initAudio();
  resetState();

  // Select and shuffle questions (0 = all)
  const count = state.totalQuestions > 0 ? state.totalQuestions : ALL_QUESTIONS.length;
  const selected = shuffle(ALL_QUESTIONS).slice(0, count);
  state.questions = selected.map(q => {
    const correctAnswer = q.choices[q.correct];
    const shuffledChoices = shuffle(q.choices);
    return { ...q, choices: shuffledChoices, correct: shuffledChoices.indexOf(correctAnswer) };
  });

  state.quizStartTime = Date.now();
  dom.totalQ.textContent = state.questions.length;

  showScreen('quiz');
  playBGM('quiz');
  loadQuestion();
}

function resetState() {
  clearInterval(state.timer);
  state.timer = null;
  state.questions = [];
  state.currentIndex = 0;
  state.score = 0;
  state.streak = 0;
  state.maxStreak = 0;
  state.correctCount = 0;
  state.answered = false;
  state.answerTimes = [];
}

function loadQuestion() {
  const q = state.questions[state.currentIndex];
  state.answered = false;

  // Update stats
  dom.score.textContent = state.score;
  dom.currentQ.textContent = state.currentIndex + 1;
  dom.streak.textContent = state.streak;
  dom.resultArea.classList.add('hidden');

  // Update progress
  const pct = (state.currentIndex / state.questions.length) * 100;
  dom.progressFill.style.width = `${pct}%`;

  // Question
  dom.questionNumber.textContent = `Q.${state.currentIndex + 1}`;
  dom.questionText.textContent = q.question;

  // Animate question
  dom.questionArea.style.animation = 'none';
  dom.questionArea.offsetHeight;
  dom.questionArea.style.animation = 'questionSlideIn 0.5s ease';

  // Generate choices
  const labels = ['A', 'B', 'C', 'D'];
  dom.choicesArea.innerHTML = '';
  q.choices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.id = `choice-${i}`;

    const numSpan = document.createElement('span');
    numSpan.className = 'choice-num';
    numSpan.textContent = labels[i];

    const labelSpan = document.createElement('span');
    labelSpan.className = 'choice-label';
    labelSpan.textContent = choice;

    btn.appendChild(numSpan);
    btn.appendChild(labelSpan);
    btn.addEventListener('click', () => selectAnswer(i));
    dom.choicesArea.appendChild(btn);
  });

  // Start timer
  startTimer();
}

function startTimer() {
  if (state.timePerQuestion <= 0) {
    // No time limit
    dom.timerFill.style.width = '100%';
    dom.timerFill.classList.remove('warning', 'danger');
    state.questionStartTime = Date.now();
    return;
  }

  state.timeLeft = state.timePerQuestion * 10;
  dom.timerFill.style.width = '100%';
  dom.timerFill.classList.remove('warning', 'danger');
  state.questionStartTime = Date.now();

  clearInterval(state.timer);
  state.timer = setInterval(() => {
    state.timeLeft--;
    const percent = (state.timeLeft / (state.timePerQuestion * 10)) * 100;
    dom.timerFill.style.width = `${percent}%`;

    if (percent <= 30 && percent > 15) {
      dom.timerFill.classList.add('warning');
      dom.timerFill.classList.remove('danger');
    } else if (percent <= 15) {
      dom.timerFill.classList.remove('warning');
      dom.timerFill.classList.add('danger');
    }

    if (state.timeLeft <= 0) {
      clearInterval(state.timer);
      timeUp();
    }
  }, 100);
}

function timeUp() {
  if (state.answered) return;
  state.answered = true;
  state.streak = 0;
  state.answerTimes.push(state.timePerQuestion);

  const q = state.questions[state.currentIndex];
  const choiceBtns = dom.choicesArea.querySelectorAll('.choice-btn');

  choiceBtns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.correct) btn.classList.add('correct-answer');
  });

  playSE('wrong');

  dom.resultIcon.innerHTML = '<span class="icon-timeout">!</span>';
  dom.resultText.textContent = '時間切れ';
  dom.resultText.className = 'result-text timeout';
  dom.explanationText.textContent = q.explanation;
  dom.explanationSource.textContent = q.source || '';
  dom.resultArea.classList.remove('hidden');

  updateNextButtonText();
  updateProgressAfterAnswer();
  scrollToResult();

  // Re-trigger animation
  dom.resultIcon.style.animation = 'none';
  void dom.resultIcon.offsetWidth;
  dom.resultIcon.style.animation = '';

  dom.streak.textContent = state.streak;
}

function selectAnswer(index) {
  if (state.answered) return;
  if (index >= state.questions[state.currentIndex].choices.length) return;
  state.answered = true;
  clearInterval(state.timer);

  const q = state.questions[state.currentIndex];
  const timeTaken = (Date.now() - state.questionStartTime) / 1000;
  state.answerTimes.push(timeTaken);

  const isCorrect = index === q.correct;
  const choiceBtns = dom.choicesArea.querySelectorAll('.choice-btn');

  choiceBtns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.correct) {
      btn.classList.add(isCorrect ? 'correct' : 'correct-answer');
    }
    if (i === index && !isCorrect) {
      btn.classList.add('wrong');
    }
  });

  if (isCorrect) {
    state.correctCount++;
    state.streak++;
    if (state.streak > state.maxStreak) state.maxStreak = state.streak;

    // Base 100 + 30 per streak, capped at 10 streak (370pts max)
    let points = 100 + Math.min(9, Math.max(0, state.streak - 1)) * 30;
    state.score += points;

    dom.score.textContent = state.score;
    const streakBonus = (state.streak - 1) * 30;
    if (streakBonus > 0) {
      showScorePopup(`+${points} (${state.streak}連続!)`);
    } else {
      showScorePopup(`+${points}`);
    }

    if (state.streak >= 3) {
      dom.resultIcon.innerHTML = `<span class="icon-streak">${state.streak}</span>`;
      playSE('streak');
    } else {
      dom.resultIcon.innerHTML = '<span class="icon-correct">&#10003;</span>';
      playSE('correct');
    }

    const messages = ['正解！', 'すごい！', 'さすが！', 'パーフェクト！'];
    dom.resultText.textContent = state.streak >= 3
      ? `${state.streak}連続正解！ +${points}pts`
      : pickRandom(messages);
    dom.resultText.className = 'result-text correct';
  } else {
    state.streak = 0;
    dom.resultIcon.innerHTML = '<span class="icon-wrong">&times;</span>';
    const messages = ['残念...', 'おしい！', 'ドンマイ！'];
    dom.resultText.textContent = pickRandom(messages);
    dom.resultText.className = 'result-text wrong';
    playSE('wrong');
  }

  dom.explanationText.textContent = q.explanation;
  dom.explanationSource.textContent = q.source || '';
  dom.resultArea.classList.remove('hidden');
  dom.streak.textContent = state.streak;

  updateNextButtonText();
  updateProgressAfterAnswer();
  scrollToResult();

  // Re-trigger animation
  dom.resultIcon.style.animation = 'none';
  void dom.resultIcon.offsetWidth;
  dom.resultIcon.style.animation = '';
}

function showScorePopup(text) {
  const popup = document.createElement('div');
  popup.className = 'score-popup';
  popup.textContent = text;
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 1000);
}

function updateNextButtonText() {
  const btnText = dom.btnNext.querySelector('.btn-text');
  if (state.currentIndex === state.questions.length - 1) {
    btnText.textContent = '結果を見る';
  } else {
    btnText.textContent = '次の問題';
  }
}

function updateProgressAfterAnswer() {
  const pct = ((state.currentIndex + 1) / state.questions.length) * 100;
  dom.progressFill.style.width = `${pct}%`;
}

function scrollToResult() {
  dom.resultArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function nextQuestion() {
  state.currentIndex++;
  if (state.currentIndex >= state.questions.length) {
    showFinalResult();
  } else {
    loadQuestion();
  }
}

function quitQuiz() {
  clearInterval(state.timer);
  resetState();
  playBGM('title');
  showScreen('start');
}

// ===== Final Result =====
function showFinalResult() {
  clearInterval(state.timer);
  playSE('finish');
  showScreen('result');

  const totalAnswered = state.questions.length;
  const accuracy = totalAnswered > 0 ? Math.round((state.correctCount / totalAnswered) * 100) : 0;

  dom.finalScore.textContent = state.score;
  dom.finalCorrect.textContent = `${state.correctCount} / ${totalAnswered}`;
  dom.finalStreak.textContent = state.maxStreak;
  dom.finalAccuracy.textContent = `${accuracy}%`;

  // Rank
  const pct = totalAnswered > 0 ? state.correctCount / totalAnswered : 0;
  let rank, rankClass, message;

  if (pct >= 1.0) {
    rank = 'S+';
    rankClass = 'rank-sp';
    message = '完璧！あなたこそ真の「なくちゃマスター」！\n藍月なくるへの愛と知識が溢れています。';
  } else if (pct >= 0.9) {
    rank = 'S';
    rankClass = 'rank-s';
    message = '素晴らしい！かなりのなくちゃ通ですね。\nエピソードにも詳しいファンです。';
  } else if (pct >= 0.7) {
    rank = 'A';
    rankClass = 'rank-a';
    message = 'なかなかの知識量！\nもっと配信やライブをチェックすると、さらに詳しくなれるかも。';
  } else if (pct >= 0.5) {
    rank = 'B';
    rankClass = 'rank-b';
    message = 'まだまだ伸びしろたっぷり！\n藍月なくるのコンテンツをたくさん楽しんでみてね。';
  } else {
    rank = 'C';
    rankClass = 'rank-c';
    message = 'これから藍月なくるの世界を楽しみましょう！\nまずは「すだちそば」の配信から見てみては。';
  }

  dom.rankValue.textContent = rank;
  dom.rankValue.className = `rank-value ${rankClass}`;
  dom.rankMessage.innerHTML = message.replace(/\n/g, '<br>');

  dom.progressFill.style.width = '100%';
}

// ===== Start =====
document.addEventListener('DOMContentLoaded', init);
