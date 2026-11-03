// 모션 시트가 없는 메가 · 특수 폼: 본가 외형 도트 한 장(Showdown Gen5 · PokeAPI)을 파츠로 잘라 움직인다 (systems/MegaRig.js)
//  showdown: Showdown 도트 이름 · pokeapi: 없을 때 PokeAPI 번호
//  rig: 파츠 나누는 비율 조정 (그림을 보고 맞춘 값 · 없으면 기본) — arm 앞팔/무기 · back 날개/등딱지/등 무기 · hip 상체와 하체 경계 (그림 높이 비율)
export const RIG_SOURCES = {
  'venusaur-mega': { showdown: 'venusaur-mega', rig: { hip: .62, back: { x0: .45, y1: .55 } } },
  'blastoise-mega': { showdown: 'blastoise-mega', rig: { back: { x0: .35, y1: .38 } } },
  'charizard-mega-y': { showdown: 'charizard-megay', rig: { back: { x0: .5, y1: .55 } } },
  'gyarados-mega': { showdown: 'gyarados-mega', rig: { hip: .55 } },
  'mewtwo-mega-x': { showdown: 'mewtwo-megax' },
  'scizor-mega': { showdown: 'scizor-mega', rig: { back: { x0: .55, y1: .5 } } },
  'blaziken-mega': { showdown: 'blaziken-mega' },
  'swampert-mega': { showdown: 'swampert-mega' },
  'garchomp-mega': { showdown: 'garchomp-mega', rig: { back: { x0: .55, y1: .5 } } },
  'garchomp-mega-z': { showdown: 'garchomp-megaz', rig: { back: { x0: .55, y1: .5 } } },
  'greninja-ash': { showdown: 'greninja-ash', rig: { back: { x0: .5, y1: .5 } } },
  'greninja-mega': { showdown: 'greninja-mega' },
  'meganium-mega': { showdown: 'meganium-mega', rig: { hip: .6 } },
  'feraligatr-mega': { showdown: 'feraligatr-mega' },
  'emboar-mega': { showdown: 'emboar-mega' },
  'chesnaught-mega': { showdown: 'chesnaught-mega' },
  'delphox-mega': { showdown: 'delphox-mega' },
  'dragonite-mega': { showdown: 'dragonite-mega', rig: { back: { x0: .5, y1: .55 } } },
  'raichu-mega-x': { pokeapi: 10304 },
  'raichu-mega-y': { pokeapi: 10305 }
};
