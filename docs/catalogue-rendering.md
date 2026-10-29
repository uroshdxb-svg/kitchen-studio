# Catalogue construction rendering

All 807 catalogue entries now have detailed geometry: the original 27 individually
referenced models and 780 specification-driven profiles across 87 construction
families. This is geometry coverage, not certification of photographic likeness.
The latter profiles remain explicitly marked `individuallyReviewed: false`.

The family renderer uses the existing HDR lighting, shadows, polished materials,
rounded edges, glass, export path and material batching. Burner counts, doors,
drawers, pan wells, mounting and other stated options come from catalogue text.
Dimensions, utilities, catalogue records and the original reference images are
unchanged. Interpreted contours must not be used to plan service connections.

The gallery at `/equipment/` exposes every model and its source. The 27-model
`/equipment/models.json` endpoint remains stable; the complete collection is at
`/equipment/catalogue-models.json`. Unknown new constructions fail the build until
mapped instead of silently acquiring a placeholder. Custom fabrication keeps its
existing renderer.

Construction references used alongside the existing catalogue source URLs:

- Electrolux XP range: https://www.electroluxprofessional.com/commercial-kitchen-equipment/cooking-ranges/900xp-700xp-cooking-ranges/
- Sammic bone saw: https://sammic.com/en/product/sh-182
- Sammic salad spinner: https://sammic.com/en/product/es-200
- Hoshizaki self-contained ice cuber: https://hoshizaki-europe.com/product/im-100ne-hc-32-cuber-self-contained/
- Cambro ingredient bins: https://www.cambro.com/Products/food-storage/mobile-ingredient-bins/
- Cambro insulated transport: https://www.cambro.com/Products/insulated-food-transport/non-electric-food-transport-carts/ultra-camcarts-for-food-pans/
- Hatco fry holding: https://www.hatcocorp.com/en/equipment/food-holding-serving-equipment/french-fry-warmers/glo-ray-portable-fry-holding-station-grfhs

Mixer geometry incorporates the detailed planetary and spiral construction from
draft PR #25, commit `fa1ac25d4d9cd0f279b623535dd61d1558a6a797`. Its sources include
Sigma Tauro (https://www.sigmasrl.com/en/products/pizza/spiral-mixer-tauro) and
https://www.sigmasrl.com/pdf/tec/tauro-en.pdf. The draft itself is not merged by
this change. Its exact-model registry remains separate from the new profiles.

Validation: `equipment-construction.test.mjs` constructs and batches all 780
profiles, checks finite vertices/normals/UVs, dimensions, geometry budgets and
classification regressions. `equipment-models.test.mjs` renders all 807 items,
captures every construction family, checks GPU resource reuse, the existing 27
reference models, mobile controls and mixed-family planner integration. Screenshots
are retained in the CI browser-test artifact. Physical-device performance and
individual photographic review of the 780 profiles remain separate work.
