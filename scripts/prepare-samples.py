"""Build the bundled CC0 practice instruments. Requires Python 3 and ffmpeg.

Downloads immutable upstream revisions, trims long tails, and encodes mono MP3.
The generated manifest records the original URL and SHA-256 for every sample.
"""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'audio'
OUT.mkdir(parents=True, exist_ok=True)

def get_json(url):
    with urllib.request.urlopen(url, timeout=45) as response:
        return json.load(response)

repos = {
    'steel': 'sfzinstruments/Discord-SFZ-GM-Bank',
    'nylon': 'freepats/spanish-classical-guitar',
    'clean': 'freepats/electric-guitar-FSBS-clean',
}
lock_path = OUT / 'sources.json'
if lock_path.exists():
    sources = json.loads(lock_path.read_text())
else:
    sources = {name: {'repository': repo, 'revision': get_json(
        f'https://api.github.com/repos/{repo}/commits/' + ('master' if name == 'steel' else 'main')
    )['sha']} for name, repo in repos.items()}
    lock_path.write_text(json.dumps(sources, indent=2) + '\n')

steel = ['MartinGM2_040__E2_1.wav', 'MartinGM2_043__G2_1.wav',
         'MartinGM2_046_Bb2_1.wav', 'MartinGM2_049_Db3_1.wav',
         'MartinGM2_052__E3_1.wav', 'MartinGM2_055__G3_1.wav',
         'MartinGM2_058_Bb3_1.wav', 'MartinGM2_061_Db4_1.wav',
         'MartinGM2_064__E4_1.wav', 'MartinGM2_068_Ab4_1.wav',
         'MartinGM2_071__B4_1.wav', 'MartinGM2_074__D5_1.wav',
         'MartinGM2_077__F5_1.wav', 'MartinGM2_080_Ab5_1.wav',
         'MartinGM2_083__B5_1.wav']
notes = {'E2': 40, 'G2': 43, 'B2': 47, 'D3': 50, 'E3': 52,
         'G3': 55, 'B3': 59, 'D4': 62, 'E4': 64, 'G4': 67,
         'B4': 71, 'D5': 74, 'E5': 76, 'G5': 79, 'A5': 81}
jobs = []
for filename in steel:
    jobs.append(('steel', int(filename.split('_')[1]), None, 'normal',
                 'Discord GM/Melodic/026-Acoustic Guitar (steel)/' + filename))
for note, midi in notes.items():
    jobs.append(('nylon', midi, None, 'normal', f'samples/{note}.flac'))

clean_source = sources['clean']
listing = get_json(f"https://api.github.com/repos/{repos['clean']}/contents/samples/bridge?ref={clean_source['revision']}")
available = {file['name'] for file in listing}
clean_notes = {'E2':40, 'F2':41, 'A2':45, 'C3':48, 'D3':50, 'E3':52,
               'G3':55, 'B3':59, 'C#4':61, 'E4':64, 'G4':67, 'B4':71,
               'D5':74, 'F5':77, 'G#5':80, 'A#5':82, 'C#6':85}
for note, midi in clean_notes.items():
    for take in ['01', '02', 'soft_01']:
        candidates = sorted(f for f in available if f.startswith(note + '_s')
                            and f.endswith('_' + take + '.flac')
                            and (take.startswith('soft') or '_soft_' not in f))
        if candidates:
            filename = candidates[0]
            string = 6 - int(filename.split('_')[1][1:])
            jobs.append(('clean', midi, string, 'soft' if 'soft' in take else 'normal',
                         'samples/bridge/' + filename))

def convert(job):
    bank, midi, string, layer, source_path = job
    filename = Path(source_path).stem.replace('#', 's') + '.mp3'
    dest = OUT / bank / filename
    dest.parent.mkdir(exist_ok=True)
    source = sources[bank]
    url = f"https://raw.githubusercontent.com/{source['repository']}/{source['revision']}/" + urllib.parse.quote(source_path)
    if not dest.exists():
        with tempfile.TemporaryDirectory() as temp:
            original = Path(temp) / Path(source_path).name
            with urllib.request.urlopen(url, timeout=90) as response:
                original.write_bytes(response.read())
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                '-i', str(original), '-t', '8', '-ac', '1', '-ar', '44100',
                '-af', 'afade=t=out:st=7.5:d=0.5', '-codec:a', 'libmp3lame',
                '-q:a', '3', str(dest)], check=True)
    result = {'bank': bank, 'midi': midi, 'layer': layer,
              'file': f'{bank}/{filename}', 'source': url,
              'sha256': hashlib.sha256(dest.read_bytes()).hexdigest()}
    if string is not None:
        result['string'] = string
    return result

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    samples = list(pool.map(convert, jobs))
(OUT / 'manifest.json').write_text(json.dumps(samples, indent=2) + '\n')
print(f'Bundled {len(samples)} samples, {sum(p.stat().st_size for p in OUT.rglob("*.mp3")) / 1e6:.1f} MB')

# Preserve each bank's original authorship and license notice beside the audio.
notices = OUT / 'licenses'
notices.mkdir(exist_ok=True)
for bank, source_path in {
    'steel': 'Discord GM/Melodic/026-Acoustic Guitar (steel).sfz',
    'nylon': 'README.md',
    'clean': 'README.txt',
}.items():
    source = sources[bank]
    url = f"https://raw.githubusercontent.com/{source['repository']}/{source['revision']}/" + urllib.parse.quote(source_path)
    content = urllib.request.urlopen(url, timeout=45).read().decode()
    if bank == 'steel':
        content = '\n'.join(content.splitlines()[:4]) + '\n'
    (notices / (bank + '-notice.txt')).write_text(content + '\nSource: ' + url + '\n')
