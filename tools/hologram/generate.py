"""Offline portrait-specific 2.5D assets. No network calls or biometric embeddings."""
from pathlib import Path
import hashlib
import json
import os
import struct

ROOT = Path(__file__).resolve().parents[2]
os.environ.setdefault('MPLCONFIGDIR', str(ROOT / '.cache/matplotlib'))
os.environ.setdefault('XDG_CACHE_HOME', str(ROOT / '.cache'))
import mediapipe as mp
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.interpolate import LinearNDInterpolator, NearestNDInterpolator
from scipy.ndimage import gaussian_filter, map_coordinates, distance_transform_edt
from scipy.spatial import Delaunay

SOURCE = ROOT / 'public/images/dilshan-portrait.jpg'
MODEL = ROOT / 'tools/hologram/models/face_landmarker.task'
OUTPUT = ROOT / 'public/hologram'
PRIVATE = ROOT / 'tools/hologram/private'
MODEL_SHA = '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_glb(vertices, triangles):
    """Reusable actual-face landmark surface, without a generic head template."""
    positions = np.asarray(vertices, dtype='<f4')
    indices = np.asarray(triangles, dtype='<u2').ravel()
    raw = positions.tobytes() + indices.tobytes()
    doc = {
        'asset': {'version': '2.0', 'generator': 'Dilshan local portrait reconstruction'},
        'scene': 0, 'scenes': [{'nodes': [0]}],
        'nodes': [{'mesh': 0, 'name': 'Portrait-derived approximate facial surface'}],
        'meshes': [{'primitives': [{'attributes': {'POSITION': 0}, 'indices': 1}]}],
        'buffers': [{'byteLength': len(raw)}],
        'bufferViews': [
            {'buffer': 0, 'byteOffset': 0, 'byteLength': positions.nbytes, 'target': 34962},
            {'buffer': 0, 'byteOffset': positions.nbytes, 'byteLength': indices.nbytes, 'target': 34963}],
        'accessors': [
            {'bufferView': 0, 'componentType': 5126, 'count': len(positions), 'type': 'VEC3',
             'min': positions.min(axis=0).tolist(), 'max': positions.max(axis=0).tolist()},
            {'bufferView': 1, 'componentType': 5123, 'count': len(indices), 'type': 'SCALAR'}],
    }
    json_bytes = json.dumps(doc, separators=(',', ':')).encode()
    json_bytes += b' ' * (-len(json_bytes) % 4)
    raw += b'\0' * (-len(raw) % 4)
    total = 12 + 8 + len(json_bytes) + 8 + len(raw)
    (OUTPUT / 'facial-surface.glb').write_bytes(
        struct.pack('<III', 0x46546C67, 2, total) + struct.pack('<II', len(json_bytes), 0x4E4F534A)
        + json_bytes + struct.pack('<II', len(raw), 0x004E4942) + raw)


def main():
    assert SOURCE.is_file(), 'Original portrait is required.'
    assert sha(SOURCE) == '821873a3c68b9780bce4dcdc292e32fe29bcb1bfb387abc29a30522bc49f5f52', 'Re-trace silhouette if the original portrait changes.'
    assert sha(MODEL) == MODEL_SHA, 'Unexpected model checksum; stop before inference.'
    OUTPUT.mkdir(exist_ok=True, parents=True)
    PRIVATE.mkdir(exist_ok=True, parents=True)
    image = Image.open(SOURCE).convert('RGB')
    assert image.size == (400, 400), 'Photo-traced silhouette is specific to this 400x400 source.'
    rgb = np.asarray(image) / 255.0
    options = mp.tasks.vision.FaceLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(MODEL), delegate=mp.tasks.BaseOptions.Delegate.CPU),
        running_mode=mp.tasks.vision.RunningMode.IMAGE,
        num_faces=1, min_face_detection_confidence=.6,
        output_face_blendshapes=False, output_facial_transformation_matrixes=False)
    with mp.tasks.vision.FaceLandmarker.create_from_options(options) as detector:
        result = detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(image)))
    assert len(result.face_landmarks) == 1, 'No reliable face detected; do not substitute a head.'
    landmarks = np.array([[p.x * 400, p.y * 400, p.z * 400] for p in result.face_landmarks[0]])
    face = landmarks[:468]
    assert np.isfinite(face).all()
    np.save(PRIVATE / 'detected-landmarks.npy', landmarks)
    diagnostic = image.resize((800, 800))
    draw = ImageDraw.Draw(diagnostic)
    for x, y, _ in landmarks:
        draw.ellipse((x*2-1,y*2-1,x*2+1,y*2+1), fill='#49e5ff')
    diagnostic.save(PRIVATE / 'landmark-check.jpg')

    # Manually traced from this exact photograph, not a generic head mask.
    # Includes visible hair, ears, jaw and a short neck; excludes background and suit.
    outline = [(146,110),(143,96),(143,85),(146,73),(149,64),(155,54),(164,47),
        (166,35),(171,42),(177,36),(185,39),(193,35),(205,39),(217,37),(230,41),
        (241,43),(250,51),(260,55),(268,61),(276,62),(269,73),(274,71),
        (268,83),(266,96),(262,111),(262,121),(267,119),(268,130),(263,142),
        (256,147),(253,162),(246,178),(239,188),(235,204),(239,218),(223,227),
        (201,231),(180,220),(175,207),(174,191),(164,179),(157,161),(153,147),
        (148,142),(146,133),(144,122),(146,117)]
    mask_image = Image.new('L', image.size)
    ImageDraw.Draw(mask_image).polygon(outline, fill=255)
    mask = np.asarray(mask_image) > 0
    yy, xx = np.mgrid[:400, :400]
    query = np.column_stack((xx.ravel(), yy.ravel()))
    depth_linear = LinearNDInterpolator(face[:, :2], face[:, 2])(query).reshape(400, 400)
    inside_face = np.isfinite(depth_linear)
    nearest = NearestNDInterpolator(face[:, :2], face[:, 2])(query).reshape(400, 400)
    # Outside the detected face, extend a shallow scalp/neck envelope. Its depth is
    # an explicit artistic approximation, never claimed as measured hair geometry.
    envelope = nearest + np.maximum(0, 90 - yy) * .11 + np.maximum(0, yy - 190) * .12
    depth = np.where(inside_face, depth_linear, envelope)
    depth = gaussian_filter(depth, .8)
    center_x, center_y, scale = 207., 132., 70.
    center_z = np.median(face[:, 2])

    def to_world(x, y, z):
        return np.column_stack(((x-center_x)/scale, (center_y-y)/scale, np.clip((center_z-z)/scale, -.65, .65)))

    lum = rgb @ np.array([.2126, .7152, .0722])
    local_detail = lum - gaussian_filter(lum, 1.4)
    grad_y, grad_x = np.gradient(gaussian_filter(lum, .6))
    edge = np.clip(np.hypot(grad_x, grad_y)*4, 0, 1)
    boundary = np.exp(-distance_transform_edt(mask)/2.0) * mask
    rng = np.random.default_rng(1989)
    probability = (.8 + edge * 2 + inside_face * .5) * mask
    probability /= probability.sum()
    count = 24000
    pixels = rng.choice(160000, count, replace=True, p=probability.ravel())
    py, px = np.divmod(pixels, 400)
    x = px + rng.uniform(-.48, .48, count)
    y = py + rng.uniform(-.48, .48, count)
    z = map_coordinates(depth, [y, x], order=1, mode='nearest')
    positions = to_world(x, y, z)
    brightness = np.clip(.09 + .86 * lum[py, px] + local_detail[py, px]*.9 + boundary[py, px]*.15, .06, 1)
    brightness *= np.clip((222-y)/30, 0, 1)
    # The source's tonal values preserve eyes, brows, facial hair and hairstyle.
    violet = np.clip((x-190)/110, 0, 1) * .7
    cyan = np.array([.22, .86, 1.])
    purple = np.array([.64, .46, 1.])
    tint = cyan[None, :] * (1-violet[:, None]) + purple[None, :] * violet[:, None]
    highlights = np.clip((lum[py, px]-.7)*1.8, 0, .5)
    tint = tint * (1-highlights[:, None]) + highlights[:, None]
    colors = np.clip(tint * brightness[:, None] * 1.3, 0, 1)
    sizes = rng.uniform(.75, 1.2, count)
    records = np.zeros(count, dtype=[('position', '<f4', (3,)), ('color', 'u1', (3,)), ('size', 'u1'), ('seed', '<f4')])
    records['position'] = positions
    records['color'] = np.rint(colors * 255).astype('u1')
    records['size'] = np.rint(sizes * 150).astype('u1')
    records['seed'] = rng.random(count)
    (OUTPUT / 'facial-particles.bin').write_bytes(b'DBHP' + struct.pack('<III', 1, count, 20) + records.tobytes())

    # Only selected feature contours; never a heavy full-face wireframe.
    connections = set()
    for name in ['FACE_LANDMARKS_LEFT_EYE', 'FACE_LANDMARKS_RIGHT_EYE',
                 'FACE_LANDMARKS_LEFT_EYEBROW', 'FACE_LANDMARKS_RIGHT_EYEBROW',
                 'FACE_LANDMARKS_LIPS', 'FACE_LANDMARKS_FACE_OVAL']:
        for connection in getattr(mp.tasks.vision.FaceLandmarksConnections, name):
            connections.add(tuple(sorted((connection.start, connection.end))))
    world_face = to_world(face[:, 0], face[:, 1], face[:, 2])
    lines = np.array([world_face[i] for pair in sorted(connections) for i in pair], dtype='<f4')
    (OUTPUT / 'facial-contours.bin').write_bytes(lines.tobytes())
    triangulation = Delaunay(face[:, :2])
    write_glb(world_face, triangulation.simplices)

    # Render the SAME point data for the static fallback; all processing stays local.
    canvas = Image.new('RGB', (768, 768), '#05060b')
    points = Image.new('RGB', canvas.size)
    point_draw = ImageDraw.Draw(points)
    for position, color, size in zip(positions, colors, sizes):
        cx, cy = 384 + position[0]*192, 384-position[1]*192
        radius = size * .48
        fill = tuple(np.rint(np.clip(color*1.3, 0, 1)*255).astype(int))
        point_draw.ellipse((cx-radius,cy-radius,cx+radius,cy+radius), fill=fill)
    from PIL import ImageChops
    canvas = ImageChops.add(canvas, points)
    glow = Image.blend(Image.new('RGB', canvas.size), points.filter(ImageFilter.GaussianBlur(2)), .2)
    canvas = ImageChops.add(canvas, glow)
    canvas.save(OUTPUT / 'portrait-fallback.webp', quality=92, method=6)
    # Side/front comparison for local geometry review, not served to visitors.
    preview = Image.new('RGB', (1152, 768), '#05060b')
    preview.paste(canvas.resize((576, 576)), (0, 96))
    side = ImageDraw.Draw(preview)
    angle = np.deg2rad(25)
    turned = positions.copy()
    turned[:, 0] = positions[:, 0]*np.cos(angle) + positions[:, 2]*np.sin(angle)
    for p,c in zip(turned, colors):
        sx,sy = 864+p[0]*145,384-p[1]*145
        side.ellipse((sx-.6,sy-.6,sx+.6,sy+.6),fill=tuple(np.rint(c*255).astype(int)))
    preview.save(PRIVATE / 'surface-review.jpg', quality=95)
    summary = {
        'source': '/images/dilshan-portrait.jpg', 'sourceSha256': sha(SOURCE),
        'model': 'MediaPipe Face Landmarker float16 v1', 'modelSha256': MODEL_SHA,
        'landmarks': len(landmarks), 'surfaceVertices': len(face),
        'surfaceTriangles': len(triangulation.simplices), 'particles': count,
        'contourVertices': len(lines), 'particleStride': 20,
        'positionMin': positions.min(axis=0).round(5).tolist(),
        'positionMax': positions.max(axis=0).round(5).tolist(),
        'limitations': 'Approximate front-facing 2.5D. Landmark depth is inferred, not measured. Hair/ears/neck depth is extrapolated from a source-specific silhouette. No hidden surfaces reconstructed.',
        'assets': {p.name: {'bytes': p.stat().st_size, 'sha256': sha(p)} for p in OUTPUT.iterdir() if p.suffix in ['.bin','.glb','.webp']},
    }
    (OUTPUT / 'manifest.json').write_text(json.dumps(summary, indent=2)+'\n')
    print(json.dumps(summary, indent=2))

if __name__ == '__main__':
    main()
