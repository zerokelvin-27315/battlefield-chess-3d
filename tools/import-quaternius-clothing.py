"""Extract selected CC0 garments from the official Standard pack, without FBX/engine projects."""
import json
import pathlib
import sys
import zipfile
from PIL import Image

destination = pathlib.Path(__file__).resolve().parents[1] / 'assets' / 'clothing'
parts = ['Male_Peasant_Body', 'Male_Ranger_Legs', 'Male_Ranger_Arms', 'Male_Ranger_Feet_Boots']
with zipfile.ZipFile(sys.argv[1]) as archive:
    names = archive.namelist()
    for part in parts:
        entry = next(name for name in names if name.endswith('Modular Parts/' + part + '.gltf'))
        model = json.loads(archive.read(entry))
        parent = pathlib.PurePosixPath(entry).parent
        for item in [entry] + [str(parent / buffer['uri']) for buffer in model['buffers']] + [str(parent / image['uri']) for image in model.get('images', [])]:
            output = destination / pathlib.PurePosixPath(item).name
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_bytes(archive.read(item))
    for name in ['License_Standard.txt', 'Readme.txt']:
        entry = next(entry for entry in names if entry.endswith('/' + name))
        (destination / name).write_bytes(archive.read(entry))
for texture in destination.glob('*.png'):
    with Image.open(texture) as image:
        image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
        image.save(texture, optimize=True)
print('Imported', ', '.join(parts), 'to', destination)
