"""Reproduce numeric metadata from the owner's local ROM; never upload/copy ROM into app.
Usage: python3 app/src/vendor/extract-move-metadata.py .cache/unbound-device.gba
"""
import hashlib,json,pathlib,struct,sys,zlib
rom=pathlib.Path(sys.argv[1]).read_bytes()
expected='7aa25bbf568f7cfcf6ee1cf2e9e6ff637350b3d0705c2375cabb6baa7d9739f7'
assert len(rom)==33554432 and hashlib.sha256(rom).hexdigest()==expected,'Unrecognized ROM; refusing to guess offsets'
base=0xA769AF; stride=12;count=922
assert struct.unpack_from('<I',rom,0x1CC)[0]==0x08000000+base
assert base+(count+1)*stride<=len(rom)
folder=pathlib.Path(__file__).parent
catalog=json.loads((folder/'catalog-data.js').read_text().removeprefix('export default ').strip().removesuffix(';'))
types={i:t for i,t in enumerate(['Normal','Fighting','Flying','Poison','Ground','Rock','Bug','Ghost','Steel',None,'Fire','Water','Grass','Electric','Psychic','Ice','Dragon','Dark'])};types[23]='Fairy'
rows={}
for i in range(1,count+1):
 r=rom[base+i*stride:base+(i+1)*stride]
 assert r[2] in types and r[3]<=100 and r[10]<=2,(i,r.hex())
 assert r[4]==catalog['moves'][str(i)]['basePp'],f'PP/name table mismatch for {i}'
 rows[str(i)]={'type':types[r[2]],'power':r[1] if r[1]>1 else (0 if r[1]==0 else None),'accuracy':r[3] or None,'category':['physical','special','status'][r[10]]}
output={'source':'owner-device-rom','romSha256':expected,'romCrc32':f'{zlib.crc32(rom):08X}','tableOffset':base,'stride':stride,'count':count,'moves':rows}
(folder/'move-metadata.js').write_text('export default '+json.dumps(output,separators=(',',':'))+';\n')
print(f'Wrote {count} bounded move records; all PP values match pinned PUSE catalog.')
