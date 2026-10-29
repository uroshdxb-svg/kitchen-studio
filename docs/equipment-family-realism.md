# Catalogue-wide equipment families

The preview now gives every one of the current 807 catalogue rows a detailed
rendering path: 27 individual reference models and 780 illustrative family
models. The former 296 basic family rows and 216 placeholders are covered.
This increment introduces 68 active shared families used by 547 rows, including
some items previously assigned to the wrong detailed family.

`view3d-families.js` handles cooking tops, ovens, washing, ice machines,
refrigerated counters, preparation appliances, beverage equipment, holding,
work tables, stands, storage, carts and bins. Geometry adds separate surfaces,
doors, handles, controls, vents, feet, racks, bowls, working openings and guards.
The sink well and waste containers are open meshes. Slush machines have
separate clear tanks and augers; frozen processors expose their beaker bay.
Shared materials are cached; owned geometry is merged and disposed through the
existing renderer lifecycle. No external asset requests are added.

Resolution order is individual reference model, mixer family, new family,
existing detailed renderer, then the existing fallback. Descriptions drive new
family selection. For example, a pizza prep fridge now renders as a refrigerated
prep counter, a rice cooker as a cooker, and a carving station as a heated
station. This does not change plan/elevation symbol rules or catalogue data.

The equipment review page lets every row open an interactive inspection. Family
items use a full-width canvas and an explicit illustrative-family description.
Only individual models show a manufacturer photograph. Deep links retain the
selected catalogue row on reload. Coverage exports include existing dimensions
and mounting type so the gallery uses the same inputs as the planner.

Family geometry is an approximation, not manufacturer CAD or a verified replica.
It fits uniformly inside the catalogue envelope without editing that envelope.
Optional sink taps excluded by catalogue height notes are omitted. New or
unrecognised catalogue rows still enter the basic/placeholder inventory rather
than being counted as individually modelled. No catalogue evidence, utility
values or manufacturer reference status is upgraded by this visual work.

Primary family-construction references reviewed on 29 October 2026:

- Winterhalter UC: https://www.winterhalter.com/products/undercounter-warewashers/uc-series/
- Winterhalter pass-through: https://www.winterhalter.com/in-en/products/passthrough-dishwashers/
- Hoshizaki ice machine forms: https://hoshizaki-europe.com/product-types/flakers-nugget-cubelet-ice-makers/
- Hatco toaster forms: https://www.hatcocorp.com/en/equipment/cooking-equipment/commercial-toasters

Validation: `family-models.test.mjs` checks finite positions and normals,
catalogue bounds and geometry budgets for all 547 newly rendered rows; renders
68 family representatives; exercises search, deep links, view changes, phone
layout and repeated GPU rebuilds. The existing suites cover 27 individual
models, 21 mixers, full-planner integration, shadows, walkthrough, exports,
offline assets and failure recovery. Rendered evidence is written to
`test-results/families/` and `test-results/family-checks.json`.
