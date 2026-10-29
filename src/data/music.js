// 자작 칩튠 BGM (systems/Music.js 가 Web Audio 로 연주한다 — 음원 파일 없음)
//  bpm · chords: 마디마다 코드 하나 (예 'Am' 'Cmaj7' 'Bdim' 'E7')
//  lead: 마디는 '|' 로, 음은 공백으로 나눈다. 한 마디 토큰 수로 길이가 정해진다 (8개 = 8분음표)
//        'D5' 음 · '-' 앞 음 늘이기 · '.' 쉼표
//  bass: drone(반음표 근음·5도) · walk(4분 근음-5도-옥타브) · octave(8분 옥타브 왕복) · gallop(말발굽 리듬)
//  arp:  up16(16분 분산화음) · updown8(8분 오르내림) · stab(뒷박 화음) · pad(마디 길게)
//  drums: 16칸 패턴 — k 킥 · s 스네어 · h 하이햇 ('x' 칠 때)
//  inst: lead/arp 파형 — p12·p25·p50 펄스(듀티 12.5·25·50%) · tri 삼각파
export const TRACKS = {
  // 제1구역 필드 — 잿빛 마을과 숲, 신비롭고 장엄하게
  ashfield: {
    bpm: 96, bass: 'drone', arp: 'up16', inst: { lead: 'p50', arp: 'p12' },
    chords: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A', 'Bb', 'C', 'Am', 'Dm', 'Gm', 'C', 'Bb', 'A7'],
    lead: 'D5 - - - A4 - D5 E5 | F5 - - E5 D5 - C5 - | C5 - A4 - F4 - A4 C5 | E5 - - - - - . . |' +
          'D5 - - - A4 - D5 F5 | G5 - - F5 D5 - Bb4 - | D5 - - C5 Bb4 - G4 - | A4 - - - C#5 - E5 - |' +
          'F5 - - - - - D5 F5 | G5 - - - E5 - C5 - | A5 - - - E5 - C5 E5 | F5 - D5 - A4 - - - |' +
          'Bb4 - D5 - G5 - - F5 | E5 - - - G5 - - - | F5 - - E5 D5 - - Bb4 | E5 - - - C#5 - A4 -',
    drums: { k: 'x.....x.x.......', s: '....x.......x...', h: '..x...x...x...x.' }
  },
  // 제2구역 필드 — 동굴과 물길, 높고 쓸쓸하게
  mistcave: {
    bpm: 84, bass: 'drone', arp: 'updown8', inst: { lead: 'p50', arp: 'p25' },
    chords: ['Em', 'Cmaj7', 'G', 'D', 'Em', 'Cmaj7', 'Am7', 'B', 'Cmaj7', 'D', 'Bm', 'Em', 'Am7', 'D', 'Cmaj7', 'B7'],
    lead: 'E5 - - - B5 - - - | B5 - A5 - G5 - E5 - | D5 - - - G5 - - - | F#5 - - - - - . . |' +
          'E5 - - - B5 - D6 - | C6 - - B5 G5 - - - | A5 - - - E5 - G5 - | F#5 - - - D#5 - - - |' +
          'E5 - G5 - B5 - - - | A5 - - - F#5 - D5 - | F#5 - - - B5 - - - | G5 - - - - - . . |' +
          'C6 - - - B5 - A5 - | F#5 - - - A5 - - - | G5 - - - E5 - - - | D#5 - - - F#5 - A5 -',
    drums: { k: 'x.......x.......', h: '....x.......x...' }
  },
  // 제3구역 필드 — 불탄 발전소와 저택, 으스스하고 불안하게
  cinder: {
    bpm: 104, bass: 'octave', arp: 'stab', inst: { lead: 'p25', arp: 'p25' },
    chords: ['Cm', 'Ab', 'Fm', 'G', 'Cm', 'Db', 'Bdim', 'G', 'Ab', 'Fm', 'Db', 'G', 'Ab', 'Bb', 'Bdim', 'G7'],
    lead: 'G5 - - F#5 G5 - Eb5 - | C5 - - - Ab4 - - - | F5 - - Eb5 C5 - Ab4 - | B4 - - - D5 - - - |' +
          'Eb5 - - D5 Eb5 - G5 - | Ab5 - - - F5 - Db5 - | D5 - - - F5 - Ab5 - | G5 - - - - - . . |' +
          'C6 - - - Bb5 - Ab5 - | Ab5 - - - G5 - F5 - | F5 - - - Ab5 - - - | D5 - G5 - B5 - - - |' +
          'C6 - - - Eb5 - - - | D5 - F5 - Bb5 - - - | Ab5 - - - F5 - D5 - | B4 - - - . . G4 -',
    drums: { k: 'x..x..x...x..x..', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }
  },
  // 제4구역 필드 — 보라타운과 포켓몬타워, 웅장하고 비극적으로
  spiretower: {
    bpm: 116, bass: 'walk', arp: 'up16', inst: { lead: 'p50', arp: 'p25' },
    chords: ['Gm', 'Eb', 'Cm', 'D', 'Gm', 'F', 'Eb', 'D7', 'Eb', 'F', 'Bb', 'Gm', 'Cm', 'D', 'Eb', 'D7'],
    lead: 'G5 - - - D5 - G5 A5 | Bb5 - - - G5 - Eb5 - | C6 - Bb5 - G5 - Eb5 - | F#5 - - - A5 - - - |' +
          'D6 - - - Bb5 - G5 - | A5 - - - C6 - A5 - | G5 - - F5 Eb5 - G5 - | F#5 - - - - - . . |' +
          'Eb5 - G5 - Bb5 - - - | C6 - - - A5 - F5 - | D6 - - - - - Bb5 - | G5 - - - D5 - - - |' +
          'Eb5 - - - G5 - C6 - | A5 - - - F#5 - D5 - | Bb5 - - - G5 - Eb5 - | D5 - F#5 - A5 - C6 -',
    drums: { k: 'x.......x.x.....', s: '....x.......x...', h: '..x...x...x...x.' }
  },

  // 제1구역 보스 — 긴박하고 영웅적인 전투곡
  boss_ruin: {
    bpm: 168, bass: 'gallop', arp: 'stab', inst: { lead: 'p25', arp: 'p50' },
    chords: ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'Dm', 'E', 'F', 'G', 'Em', 'Am', 'F', 'G', 'E', 'E7'],
    lead: 'A4 . A4 . C5 - E5 - | D5 - C5 - B4 - C5 - | A4 - - - C5 - F5 - | E5 - D5 - B4 - G4 - |' +
          'A4 . A4 . E5 - A5 - | G5 - E5 - C5 - E5 - | F5 - - - E5 - D5 - | E5 - - - G#4 - B4 - |' +
          'C5 - - - F5 - A5 - | G5 - - - D5 - B4 - | E5 - G5 - B5 - - - | A5 - - - E5 - C5 - |' +
          'A5 - G5 - F5 - C5 - | B4 - D5 - G5 - - - | G#5 - - - B5 - - - | D6 - - - B5 - G#5 -',
    drums: { k: 'x.....x.x.....x.', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx' }
  },
  // 제2구역 보스 — 어둡고 혼돈스럽게
  boss_abyss: {
    bpm: 176, bass: 'octave', arp: 'up16', inst: { lead: 'p25', arp: 'p12' },
    chords: ['Em', 'F', 'Em', 'F', 'Em', 'F', 'G', 'F', 'Am', 'Bb', 'Am', 'B', 'C', 'Bb', 'Am', 'B'],
    lead: 'E5 - F5 - E5 - B4 - | C5 - - - A4 - C5 - | E5 - G5 - B5 - - - | A5 - - - F5 - - - |' +
          'B5 - - A5 G5 - E5 - | F5 - - - C5 - A4 - | B4 - D5 - G5 - - - | A5 - - - - - F5 - |' +
          'E5 - A5 - C6 - - - | D6 - - - Bb5 - F5 - | E5 - - - C5 - A4 - | D#5 - - - F#5 - B5 - |' +
          'C6 - - - G5 - E5 - | F5 - - - D5 - Bb4 - | C5 - E5 - A5 - - - | B5 - - - D#5 - F#5 -',
    drums: { k: 'x..x..x...x..x..', s: '....x.......x..x', h: 'xxxxxxxxxxxxxxxx' }
  },
  // 제3구역 보스 — 불꽃처럼 뜨겁고 힘차게
  boss_blaze: {
    bpm: 172, bass: 'gallop', arp: 'stab', inst: { lead: 'p50', arp: 'p25' },
    chords: ['D', 'C', 'G', 'D', 'D', 'C', 'Bm', 'A', 'G', 'A', 'F#m', 'Bm', 'G', 'A', 'D', 'A7'],
    lead: 'D5 - F#5 - A5 - - - | G5 - - - E5 - C5 - | D5 - - - G5 - B5 - | A5 - - - - - . . |' +
          'A5 - F#5 - D5 - A4 - | C5 - E5 - G5 - - - | F#5 - - - D5 - B4 - | C#5 - - - E5 - - - |' +
          'B5 - - - G5 - D5 - | C#6 - - - A5 - E5 - | A5 - - - F#5 - C#5 - | D5 - F#5 - B5 - - - |' +
          'B5 - A5 - G5 - D5 - | E5 - F#5 - A5 - - - | F#5 - - - A5 - D6 - | C#6 - - - G5 - E5 -',
    drums: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }
  },
  // 제4구역 최종 보스 — 몰아치듯 빠르게
  boss_final: {
    bpm: 184, bass: 'octave', arp: 'up16', inst: { lead: 'p25', arp: 'p12' },
    chords: ['Gm', 'Gm', 'Eb', 'F', 'Gm', 'Gm', 'Ab', 'D', 'Cm', 'D', 'Gm', 'Eb', 'Cm', 'D', 'Eb', 'D7'],
    lead: 'G5 - D5 - G5 - A5 Bb5 | A5 - G5 - D5 - - - | Eb5 - G5 - Bb5 - - - | A5 - - - C6 - - - |' +
          'D6 - C6 - Bb5 - A5 - | G5 - - - D5 - G5 - | Ab5 - - - C6 - Eb6 - | D6 - - - F#5 - A5 - |' +
          'C6 - - - G5 - Eb5 - | F#5 - A5 - D6 - - - | Bb5 - - - G5 - D5 - | G5 - - - Bb5 - - - |' +
          'Eb6 - - - C6 - G5 - | A5 - - - F#5 - D5 - | G5 - Bb5 - Eb6 - - - | D6 - C6 - A5 - F#5 -',
    drums: { k: 'x.x...x.x.x...x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' }
  }
};
