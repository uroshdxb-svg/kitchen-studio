# 3D assets

## Chef

Sam – 3D Person, Chef with original toque and apron, by Innerscene, adapted from MakeHuman / MPFB CC0 assets. Source: https://www.innerscene.com/tools/library/3d-parts/sam-3d-person-chef-with-original-toque-and-apron-cf280545 . Download: https://www.innerscene.com/api/library/sam-3d-person-chef-with-original-toque-and-apron-cf280545/download . The source page explicitly releases the model as CC0, permitting modification and commercial redistribution. Inspected 27 October 2026.

Original SHA-256: e6fe6c8b923441d0bf36ac68c4e5be2e1af5896e6309decc1c95ad18602d937c.

Optimisation: resize textures to at most 1024px, retain alpha only for materials that use it, quantise alpha textures to 256 colours, then use meshopt compression. The mesh is a static pose. No geometry simplification. Reproduce using `scripts/prepare-chef.py`, followed by glTF Transform CLI 4.2.1 `optimize --compress meshopt --meshopt-level medium --simplify false --instance false --palette false --texture-compress false`. The bundled three.js meshopt decoder is MIT licensed. Downloads are served from this website, not the source hosts.

## Floor

Interior Tiles by Charlotte Baglioni / Poly Haven, CC0. Source: https://polyhaven.com/a/interior_tiles ; licence: https://polyhaven.com/license . `floor-diff.jpg`, `floor-nor_gl.jpg`, `floor-rough.jpg` are the diffuse, OpenGL normal and roughness maps, resized from 1K to 768px at JPEG quality 85. The texture covers 1.9m as published. Downloads on 28 October 2026:

- https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/interior_tiles/interior_tiles_diff_1k.jpg
- https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/interior_tiles/interior_tiles_nor_gl_1k.jpg
- https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/interior_tiles/interior_tiles_rough_1k.jpg

## Equipment

Original dimension-driven geometry in this repository. These are visual approximations, not manufacturer CAD. No catalogue dimensions, installation requirements or verification statuses are changed. Rational iCombi panel arrangement follows the manufacturer's product images at https://www.rational-online.com/en_xx/icombi-pro/ .
