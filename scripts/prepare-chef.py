"""Resize embedded textures before meshopt compression. Requires Pillow.
Usage: python scripts/prepare-chef.py INPUT.glb OUTPUT.glb
Source and licence are recorded in assets/3d/README.md.
"""
import io,json,struct,sys
from PIL import Image
src=open(sys.argv[1],'rb').read();n=struct.unpack_from('<I',src,12)[0];doc=json.loads(src[20:20+n]);binary=src[28+n:];replacements={}
alpha_images={doc['textures'][m['pbrMetallicRoughness']['baseColorTexture']['index']]['source'] for m in doc.get('materials',[]) if m.get('alphaMode','OPAQUE')!='OPAQUE' and 'baseColorTexture' in m.get('pbrMetallicRoughness',{})}
for index,im in enumerate(doc.get('images',[])):
 v=doc['bufferViews'][im['bufferView']];image=Image.open(io.BytesIO(binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]));image.thumbnail((1024,1024),Image.Resampling.LANCZOS);out=io.BytesIO()
 if index in alpha_images and 'A' in image.getbands():
  image.quantize(colors=256).save(out,format='PNG',optimize=True);im['mimeType']='image/png'
 else:
  image.convert('RGB').save(out,format='JPEG',quality=85);im['mimeType']='image/jpeg'
 replacements[im['bufferView']]=out.getvalue()
parts=[];offset=0
for i,v in enumerate(doc['bufferViews']):
 data=replacements.get(i,binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]);v['byteOffset']=offset;v['byteLength']=len(data);data+=b'\0'*((-len(data))%4);parts.append(data);offset+=len(data)
blob=b''.join(parts);doc['buffers'][0]['byteLength']=len(blob);doc['asset']['copyright']='CC0: Innerscene; adapted from MakeHuman / MPFB assets. Optimised by Kitchen Studio.'
meta=json.dumps(doc,separators=(',',':')).encode();meta+=b' '*((-len(meta))%4)
open(sys.argv[2],'wb').write(struct.pack('<III',0x46546C67,2,28+len(meta)+len(blob))+struct.pack('<II',len(meta),0x4E4F534A)+meta+struct.pack('<II',len(blob),0x004E4942)+blob)
