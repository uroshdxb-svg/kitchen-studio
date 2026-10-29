# Mixer family rendering

This increment builds on the 27 individual models merged in PR #21. Those
models keep their exact assignments and geometry. Of the 21 catalogue mixers,
five already have individual models; the remaining sixteen now use detailed
planetary or spiral family geometry instead of the former block/cylinder model.

Both families have open, rounded stainless bowls with physical wall thickness,
visible mixing tools, separate body panels, controls, rear ventilation, feet
and shadows. Planetary mixers have a suspended bowl, lift cradle and lever,
beater and clear guard. Spiral mixers have a lower motor body, helical hook,
breaker bar and horizontal wire grid. Polished bowl material is distinct from
painted housing. Geometry stays inside each existing catalogue envelope.

These are illustrative family models, not exact manufacturer replicas. They
carry no brand badge or individual-reference ID. Coverage reports them as
Detailed family; the individual-model count remains 27. Catalogue dimensions,
utilities, source records and verification status are unchanged.

Construction references inspected 28 October 2026:

- Sigma Tauro product page: https://www.sigmasrl.com/en/products/pizza/spiral-mixer-tauro
- Sigma technical sheet: https://www.sigmasrl.com/pdf/tec/tauro-en.pdf
- Hobart Cooking / Precision Hygiene supplier reference for the bowl-lift form:
  https://hobartcooking.co.uk/products/hobart-hsm20-20ltr-bench-top-mixer

No new reference photographs are shipped by this increment. The inspection
floor extends past the camera frame to remove the artificial platform edge.
The showcase includes illustrative tabletop and spiral mixers for review.

`mixer-models.test.mjs` checks catalogue classification, finite vertices and
normals, footprint bounds, material/geometry lifecycle, multiple camera views,
and separation between family geometry and individual-reference identity.
The existing equipment and realism suites cover all 27 individual models,
phone controls, planner integration, offline rendering and image exports.
