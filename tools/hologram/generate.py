"""Offline V2 assets: source-aligned relief, feature sampling, and photographic detail."""
from pathlib import Path
import hashlib
import io
import json
import os
import struct

ROOT = Path(__file__).resolve().parents[2]
os.environ.setdefault('MPLCONFIGDIR', str(ROOT / '.cache/matplotlib'))
os.environ.setdefault('XDG_CACHE_HOME', str(ROOT / '.cache'))
import cv2
import mediapipe as mp
import numpy as np
from PIL import Image, ImageDraw
from scipy.interpolate import CloughTocher2DInterpolator, LinearNDInterpolator, NearestNDInterpolator
from scipy.ndimage import gaussian_filter, map_coordinates, distance_transform_edt
from scipy.stats import qmc

SOURCE = ROOT / 'public/images/dilshan-portrait.jpg'
MODEL = ROOT / 'tools/hologram/models/face_landmarker.task'
OUTPUT = ROOT / 'public/hologram'
PRIVATE = ROOT / 'tools/hologram/private'
MODEL_SHA = '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff'
SOURCE_SHA = '821873a3c68b9780bce4dcdc292e32fe29bcb1bfb387abc29a30522bc49f5f52'
CROP = (104, 24, 310, 244)
CENTER = (207., 132.)
SCALE = 70.


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def sample(field, x, y):
    return map_coordinates(field, [y, x], order=1, mode='nearest')


def srgb_to_linear(color):
    return np.where(color <= .04045, color / 12.92, ((color + .055) / 1.055) ** 2.4)


def linear_to_srgb(color):
    color = np.maximum(color, 0)
    return np.where(color <= .0031308, color * 12.92, 1.055 * color ** (1 / 2.4) - .055)


def world(x, y, depth, center_z):
    return np.column_stack(((x-CENTER[0])/SCALE, (CENTER[1]-y)/SCALE,
                            np.clip((center_z-depth)/SCALE*.72, -.5, .5)))


def detect(image):
    options = mp.tasks.vision.FaceLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(MODEL), delegate=mp.tasks.BaseOptions.Delegate.CPU),
        running_mode=mp.tasks.vision.RunningMode.IMAGE, num_faces=1,
        min_face_detection_confidence=.6, output_face_blendshapes=False,
        output_facial_transformation_matrixes=False)
    with mp.tasks.vision.FaceLandmarker.create_from_options(options) as detector:
        result = detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(image)))
    assert len(result.face_landmarks) == 1, 'No reliable face detected; do not substitute a head.'
    points = np.array([[p.x*400, p.y*400, p.z*400] for p in result.face_landmarks[0]])
    assert points.shape == (478, 3) and np.isfinite(points).all()
    np.save(PRIVATE / 'detected-landmarks.npy', points)
    preview = image.resize((800, 800))
    draw = ImageDraw.Draw(preview)
    for x, y, _ in points:
        draw.ellipse((x*2-1, y*2-1, x*2+1, y*2+1), fill='#49e5ff')
    preview.save(PRIVATE / 'landmark-check.jpg', quality=95)
    return points


def segmentation(rgb):
    # Source-specific trimap. Trace the ears and jacket separately from the hair.
    outline = [(148,119),(149,114),(149,106),(147,99),(143,90),(144,79),(142,74),
        (145,70),(149,63),(155,60),(158,53),(164,49),(170,43),(174,40),
        (173,34),(178,38),(181,38),(189,36),(197,37),(204,38),(216,41),
        (227,44),(238,46),(247,51),(253,57),(259,64),(263,67),(269,62),
        (267,69),(275,66),(271,73),(278,72),(269,80),(266,87),(261,99),
        (258,113),(256,123),(260,124),(263,129),(263,136),(260,145),
        (256,151),(250,157),(242,160),(241,168),(240,177),(241,185),
        (246,194),(253,201),(264,209),(279,215),(305,221),(330,233),
        (330,260),(77,260),(77,229),(106,223),(128,217),(144,211),
        (154,203),(161,196),(166,185),(166,176),(162,168),(159,160),
        (158,156),(152,152),(149,147),(148,142),(147,137),(146,132),(147,126),(147,122)]
    seed_image = Image.new('L', (400, 400))
    ImageDraw.Draw(seed_image).polygon(outline, fill=1)
    seed = np.asarray(seed_image).astype(bool)
    inside = distance_transform_edt(seed)
    outside = distance_transform_edt(~seed)
    distance = np.where(seed, inside - .5, .5 - outside)
    yy, xx = np.mgrid[:400, :400]
    # Keep a wider unknown band where the source contains fine hair.
    band = np.where(yy < 105, 3.6, 1.8)
    foreground = distance >= band
    background = distance <= -band
    _, near_fg = distance_transform_edt(~foreground, return_indices=True)
    _, near_bg = distance_transform_edt(~background, return_indices=True)

    linear = srgb_to_linear(rgb)
    fg = linear[tuple(near_fg)]
    bg = linear[tuple(near_bg)]
    difference = fg - bg
    separation = np.sum(difference**2, axis=2)
    color_alpha = np.sum((linear - bg) * difference, axis=2) / np.maximum(separation, 1e-5)
    shape_alpha = smoothstep(-band, band, distance)
    # The traced boundary anchors low-contrast edges. Strong color separation
    # allows the observed source pixel to decide where the antialiasing falls.
    confidence = .86 * smoothstep(.004, .078, separation)
    confidence *= 1 - smoothstep(band * .55, band, np.abs(distance))
    alpha = np.clip(shape_alpha * (1 - confidence) + np.clip(color_alpha, 0, 1) * confidence, 0, 1)
    alpha[foreground] = 1
    alpha[background] = 0

    # The backdrop is teal above the collar and foliage-green below it.
    # Reject that chroma only in the narrow border; keep interior source color.
    green = rgb[:, :, 1] - rgb[:, :, 0]
    spill = smoothstep(.015, .065, green) * np.where(yy > 186, .45, 1)
    edge = 1 - smoothstep(.5, band + 1.1, distance)
    alpha *= 1 - spill * edge

    # Invert the observed composite in linear light. Regularize uncertain pixels
    # toward the nearby foreground, which also pads color beyond the alpha edge.
    estimated = (linear - (1 - alpha[:, :, None]) * bg) / np.maximum(alpha[:, :, None], .10)
    support = smoothstep(.04, .70, alpha)[:, :, None]
    clean = np.clip(fg * (1 - support) + np.clip(estimated, 0, 1) * support, 0, 1)
    clean[foreground] = linear[foreground]

    # The source jacket extends out of the photo. Dissolve the bust through the
    # jacket below the neck, with a rounded shoulder falloff at the crop edges.
    shoulders = (xx - CENTER[0]) / 100
    cloth = 1 - smoothstep(0, 1, (yy - 216) / 25 + shoulders**2 * .84)
    alpha *= np.where(yy > 183, 1 + (cloth - 1) * smoothstep(183, 217, yy), 1)
    alpha *= (xx > CROP[0]) & (xx < CROP[2]) & (yy > CROP[1]) & (yy < CROP[3])
    Image.fromarray(np.rint(alpha * 255).astype('u1')).save(PRIVATE / 'segmentation.png')
    rgba = Image.fromarray(np.rint(np.dstack((linear_to_srgb(clean), alpha)) * 255).astype('u1'))
    rgba = rgba.crop((CROP[0], CROP[1], CROP[2] + 1, CROP[3] + 1)).resize((621, 663), Image.Resampling.LANCZOS)
    for name, color in [('dark', '#080d18'), ('light', '#e7edf1')]:
        backdrop = Image.new('RGBA', rgba.size, color)
        Image.alpha_composite(backdrop, rgba).convert('RGB').save(PRIVATE / f'matte-{name}.png')
    return alpha, clean


def feature_map(points, rgb, alpha):
    yy, xx = np.mgrid[:400, :400]
    regions = np.zeros_like(alpha)
    groups = [
        ('LEFT_EYE', 3.5), ('RIGHT_EYE', 3.5),
        ('LEFT_EYEBROW', 3.4), ('RIGHT_EYEBROW', 3.4),
        ('LEFT_IRIS', 2.6), ('RIGHT_IRIS', 2.6),
        ('LIPS', 3.6), ('FACE_OVAL', 2.2),
    ]
    for name, radius in groups:
        links = getattr(mp.tasks.vision.FaceLandmarksConnections, 'FACE_LANDMARKS_' + name)
        for index in {i for pair in links for i in (pair.start, pair.end)}:
            x, y = points[index, :2]
            weight = .52 if name == 'FACE_OVAL' else .87
            bump = weight * np.exp(-((xx - x)**2 + (yy - y)**2) / (2 * radius**2))
            np.maximum(regions, bump, out=regions)
    for index in [168, 195, 5, 4, 1, 98, 327]:
        x, y = points[index, :2]
        bump = .82 * np.exp(-((xx - x)**2 + (yy - y)**2) / (2 * 4.0**2))
        np.maximum(regions, bump, out=regions)
    # Source gradients guide density along the real hairstyle and facial hair.
    luminance = rgb @ np.array([.2126, .7152, .0722])
    gy, gx = np.gradient(gaussian_filter(luminance, .55))
    texture = np.clip(gaussian_filter(np.hypot(gx, gy), .85) * 8, 0, 1)
    features = np.maximum(regions, texture * .85) * alpha
    Image.fromarray(np.uint8(features * 255)).save(PRIVATE / 'feature-density.png')
    return features


def reconstruct(points, alpha):
    face = points[:468]
    yy, xx = np.mgrid[:400,:400]
    query = np.column_stack((xx.ravel(), yy.ravel()))
    linear = LinearNDInterpolator(face[:,:2],face[:,2])(query).reshape(400,400)
    cubic = CloughTocher2DInterpolator(face[:,:2],face[:,2])(query).reshape(400,400)
    inside = np.isfinite(linear)
    # C1-continuous interpolation, bounded against the linear reference to prevent
    # cubic overshoot at the nose, eyelids and lips; no landmark XY is moved.
    facial = np.clip(cubic, linear-1.2, linear+1.2)
    nearest = NearestNDInterpolator(face[:,:2],face[:,2])(query).reshape(400,400)
    extended = gaussian_filter(nearest, 5) + np.maximum(0,90-yy)*.07 + np.maximum(0,yy-190)*.08
    depth = np.where(inside, facial, extended)
    depth = gaussian_filter(depth,.55)
    # Smooth the transition from detected forehead to the conservative hair shell.
    distance = distance_transform_edt(~inside)
    blend = np.clip(distance/7,0,1)
    depth = np.where(inside,depth,depth*(1-blend)+gaussian_filter(depth,3)*blend)
    center_z = float(np.median(face[:,2]))
    error = sample(depth,face[:,0],face[:,1])-face[:,2]
    bounds = (float(depth[alpha>.1].min()),float(depth[alpha>.1].max()))
    return depth, center_z, {'landmarkDepthRmsePixels': float(np.sqrt(np.mean(error**2))), 'depthRangePixels': bounds}


def particles(rgb, alpha, feature, depth, center_z, light=False):
    # Scrambled Halton candidates give progressive spatial coverage. Feature-aware
    # rejection and a spatial exclusion radius prevent V1's replacement clumps.
    candidates = qmc.Halton(3,scramble=True,seed=4139 if light else 1989).random(240000)
    xs = CROP[0]+candidates[:,0]*(CROP[2]-CROP[0])
    ys = CROP[1]+candidates[:,1]*(CROP[3]-CROP[1])
    strength = sample(feature,xs,ys)
    coverage = sample(alpha,xs,ys)
    if light:
        # On a pale stage, ink coverage carries the source's shadows. A local
        # contrast pass resolves eyelids and lips without changing their positions.
        gray = rgb @ np.array([.2126, .7152, .0722])
        neighborhood = gaussian_filter(gray * alpha, 2.2) / np.maximum(gaussian_filter(alpha, 2.2), .01)
        tone = np.clip(gray + .65 * (gray - neighborhood), 0, 1)
        ink = 1 - smoothstep(.045, .91, sample(tone, xs, ys))
        density = .44 + .46*ink + .10*strength
        radii = .74 - .18*ink - .11*strength
    else:
        density = .65+.35*strength
        radii = .55+.36*(1-strength)
    valid = candidates[:,2] < density * smoothstep(.08, .66, coverage)
    bins, selected = {}, []
    cell = 1.
    limit = 23500 if light else 21000
    for index in np.flatnonzero(valid):
        x,y = xs[index],ys[index]
        radius = radii[index]
        bx,by = int(x/cell),int(y/cell)
        crowded = False
        for dx in [-1,0,1]:
            for dy in [-1,0,1]:
                for px,py,pr in bins.get((bx+dx,by+dy),[]):
                    if (x-px)**2+(y-py)**2 < ((radius+pr)*.5)**2:
                        crowded=True;break
                if crowded:break
            if crowded:break
        if crowded:continue
        bins.setdefault((bx,by),[]).append((x,y,radius))
        selected.append(index)
        if len(selected)==limit:break
    assert len(selected)>=12000, 'Sampling failed to provide useful coverage.'
    chosen=np.array(selected)
    x,y=xs[chosen],ys[chosen]
    features=strength[chosen]
    positions=world(x,y,sample(depth,x,y),center_z)
    colors=np.column_stack([sample(rgb[:,:,i],x,y) for i in range(3)])
    sizes=.88-.16*features
    if light:
        weights = ink[chosen]
        colors = np.repeat(weights[:, None], 3, axis=1)
        sizes = .76 + .14*weights - .11*features
    records=np.zeros(len(chosen),dtype=[('position','<f4',(3,)),('color','u1',(3,)),('size','u1'),('seed','<f4'),('feature','<f4')])
    records['position']=positions
    records['color']=np.rint(colors*255).astype('u1')
    records['size']=np.rint(sizes*150).astype('u1')
    records['seed']=np.mod(np.arange(len(chosen))*.61803398875,1)
    records['feature']=features
    filename = 'facial-particles-light.bin' if light else 'facial-particles.bin'
    (OUTPUT/filename).write_bytes(b'DBHP'+struct.pack('<III',2,len(chosen),24)+records.tobytes())
    return positions, colors, sizes, features


def surface(alpha,feature,depth,center_z):
    xs=np.arange(CROP[0],CROP[2]+1,2.)
    ys=np.arange(CROP[1],CROP[3]+1,2.)
    x,y=np.meshgrid(xs,ys)
    positions=world(x.ravel(),y.ravel(),sample(depth,x.ravel(),y.ravel()),center_z)
    width, height = CROP[2] - CROP[0] + 1, CROP[3] - CROP[1] + 1
    uv=np.column_stack(((x.ravel()-CROP[0]+.5)/width,1-(y.ravel()-CROP[1]+.5)/height))
    attributes=np.column_stack((positions,uv,sample(feature,x.ravel(),y.ravel()))).astype('<f4')
    (OUTPUT/'facial-detail.bin').write_bytes(b'DBHS'+struct.pack('<III',1,len(xs),len(ys))+attributes.tobytes())
    indices=[]
    for row in range(len(ys)-1):
        for col in range(len(xs)-1):
            a=row*len(xs)+col;b=a+1;c=a+len(xs);d=c+1
            if alpha[int(ys[row]),int(xs[col])]<.01 and alpha[int(ys[row+1]),int(xs[col+1])]<.01:continue
            indices.extend([a,c,b,b,c,d])
    return positions,uv,np.asarray(indices,dtype='<u2'),len(xs),len(ys)


def write_glb(positions,uv,indices,texture):
    parts=[np.asarray(positions,dtype='<f4').tobytes(),np.asarray(uv,dtype='<f4').tobytes(),indices.tobytes(),texture]
    raw=bytearray();views=[]
    for part in parts:
        raw.extend(b'\0'*(-len(raw)%4));views.append({'buffer':0,'byteOffset':len(raw),'byteLength':len(part)});raw.extend(part)
    doc={'asset':{'version':'2.0','generator':'Portrait-specific local 2.5D V2'},'scene':0,'scenes':[{'nodes':[0]}],
        'nodes':[{'mesh':0}],'meshes':[{'primitives':[{'attributes':{'POSITION':0,'TEXCOORD_0':1},'indices':2,'material':0}]}],
        'buffers':[{'byteLength':len(raw)}],'bufferViews':views,
        'accessors':[{'bufferView':0,'componentType':5126,'count':len(positions),'type':'VEC3','min':positions.min(axis=0).tolist(),'max':positions.max(axis=0).tolist()},
            {'bufferView':1,'componentType':5126,'count':len(uv),'type':'VEC2'},
            {'bufferView':2,'componentType':5123,'count':len(indices),'type':'SCALAR'}],
        'images':[{'bufferView':3,'mimeType':'image/png'}],'textures':[{'source':0}],
        'materials':[{'alphaMode':'BLEND','doubleSided':True,'pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':0,'roughnessFactor':1}}]}
    encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4);raw.extend(b'\0'*(-len(raw)%4))
    (OUTPUT/'facial-surface.glb').write_bytes(struct.pack('<III',0x46546c67,2,12+8+len(encoded)+8+len(raw))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(raw),0x004e4942)+raw)


def previews(image,rgb,alpha,feature,depth,center_z,positions,colors,sizes,features):
    image.save(PRIVATE/'original.jpg',quality=95)
    yy,xx=np.mgrid[:400,:400]
    z=world(xx.ravel(),yy.ravel(),depth.ravel(),center_z)[:,2].reshape(400,400)
    gy,gx=np.gradient(z*SCALE)
    normal=np.dstack((-gx,gy,np.ones_like(z)))
    normal/=np.linalg.norm(normal,axis=2,keepdims=True)
    lighting=np.clip(normal@np.array([-.2,.3,.93]),0,1)*.75+.12
    relief=(np.array([.52,.72,.82])*lighting[:,:,None])*alpha[:,:,None]
    Image.fromarray(np.uint8(np.clip(relief,0,1)*255)).save(PRIVATE/'facial-surface.png')
    # Same neutral photographic shading as the GPU detail material.
    linear=srgb_to_linear(rgb)
    lum=linear@np.array([.2126,.7152,.0722])
    cool=lum[:,:,None]*np.array([.72,.9,1.02])
    shade=cool*.72+linear*.28
    opacity=(.42+.36*feature)*alpha
    detail=linear_to_srgb(shade)*opacity[:,:,None]
    # Project source coordinates to exactly the same 4-world-unit framing as R3F.
    transform=(SCALE/192,0,CENTER[0]-384*SCALE/192,0,SCALE/192,CENTER[1]-384*SCALE/192)
    def project(field):
        return Image.fromarray(np.uint8(np.clip(field,0,1)*255)).transform((768,768),Image.Transform.AFFINE,transform,resample=Image.Resampling.BICUBIC)
    detail_canvas=project(detail)
    neutral=Image.new('RGB',(768,768),'#05060b')
    draw=ImageDraw.Draw(neutral)
    for p,c,size,f in zip(positions,colors,sizes,features):
        lum=float(c@np.array([.2126,.7152,.0722]))
        tint=np.array([.7,.88,1.])*lum*.8+c*.2
        x,y=384+p[0]*192,384-p[1]*192
        radius=size*.55
        draw.ellipse((x-radius,y-radius,x+radius,y+radius),fill=tuple(np.rint(np.clip(tint,0,1)*255).astype(int)))
    neutral.save(PRIVATE/'neutral-particles.webp',quality=95)
    # A softer stipple over real source detail: no unsupported enhancement.
    from PIL import ImageChops
    final=ImageChops.add(detail_canvas,Image.blend(Image.new('RGB',neutral.size),neutral,.20))
    final=ImageChops.add(final,Image.new('RGB',final.size,'#05060b'))

    final.save(PRIVATE/'hybrid-frontal.webp',quality=95)
    entries=[('SOURCE',image.crop(CROP)),('LANDMARKS',Image.open(PRIVATE/'landmark-check.jpg').crop(tuple(v*2 for v in CROP))),
        ('SURFACE',Image.fromarray(np.uint8(np.clip(relief,0,1)*255)).crop(CROP)),('PARTICLES / NO FX',neutral.crop((190,90,600,675))),('HYBRID / NO FX',final.crop((190,90,600,675)))]
    sheet=Image.new('RGB',(1400,440),'#05060b');draw=ImageDraw.Draw(sheet)
    for i,(label,preview) in enumerate(entries):
        factor=min(258/preview.width,350/preview.height)
        preview=preview.resize((round(preview.width*factor),round(preview.height*factor)),Image.Resampling.LANCZOS)
        sheet.paste(preview,(i*280+(280-preview.width)//2,45))
        draw.text((i*280+20,15),label,fill='#b9cad7')
    sheet.save(PRIVATE/'diagnostic-comparison.jpg',quality=95)




def smoothstep(lo, hi, value):
    t = np.clip((value - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def reveal_previews(rgb, alpha, particle_sets):
    """Rasterize the assembled points for startup, reduced motion and WebGL failure."""
    palettes = json.loads((ROOT / 'src/lib/hologram/palettes.json').read_text())
    transform = (SCALE/192, 0, CENTER[0]-384*SCALE/192, 0, SCALE/192, CENTER[1]-384*SCALE/192)
    supersample = 3

    def linear_hex(value):
        return srgb_to_linear(np.array([int(value[i:i+2], 16) for i in (1, 3, 5)]) / 255)

    def save_asset(image, prefix):
        encoded = io.BytesIO()
        image.save(encoded, format='WEBP', lossless=True, method=6)
        content = encoded.getvalue()
        filename = prefix + '-' + hashlib.sha256(content).hexdigest()[:12] + '.webp'
        (OUTPUT / filename).write_bytes(content)
        for previous in OUTPUT.glob(prefix + '-*.webp'):
            if previous.name != filename:
                previous.unlink()
        return '/hologram/' + filename

    digital = {}
    for theme, palette in palettes.items():
        positions, colors, sizes, features = particle_sets[theme]
        gray = colors @ np.array([.2126, .7152, .0722])
        detail = smoothstep(.13, .36, gray) * (1 - smoothstep(.43, .68, gray))
        tone = smoothstep(.025, .88, gray + .13 * features * detail)
        x, y, z = positions.T
        matte = smoothstep(.06, .74, sample(alpha, CENTER[0] + x*SCALE, CENTER[1] - y*SCALE))
        depth = .80 + .20 * smoothstep(-.44, .20, z)
        violet = (.22 * smoothstep(0, .83, x) * (1 - tone))[:, None]
        shadow = linear_hex(palette['shadow'])
        highlight = linear_hex(palette['highlight'])
        if theme == 'light':
            ink = colors[:, 0]
            tint = highlight * (1 - ink[:, None]) + shadow * ink[:, None]
            opacity = palette['highlightOpacity'] + (palette['shadowOpacity'] - palette['highlightOpacity']) * ink
        else:
            mid = linear_hex(palette['mid'])
            accent = linear_hex(palette['violet'])
            low = smoothstep(0, .56, tone)[:, None]
            high = smoothstep(.44, 1, tone)[:, None]
            tint = shadow * (1 - low) + mid * low
            tint = tint * (1 - high) + highlight * high
            tint = tint * (1 - violet) + accent * violet
            opacity = palette['shadowOpacity'] + (palette['highlightOpacity'] - palette['shadowOpacity']) * tone
        tint = linear_to_srgb(tint * depth[:, None])
        opacity *= matte * (.92 + .08 * features)
        points = Image.new('RGBA', (768 * supersample, 768 * supersample))
        draw = ImageDraw.Draw(points)
        for px, py, size, edge, rgb_point, a in zip(x, y, sizes, matte, tint, opacity):
            if a < .004:
                continue
            cx, cy = (384 + px * 192) * supersample, (384 - py * 192) * supersample
            radius = size * 1.26 * (.75 + .25 * edge) * supersample
            fill = tuple(np.rint(rgb_point * 255).astype(int)) + (round(a * 255),)
            draw.ellipse((cx-radius, cy-radius, cx+radius, cy+radius), fill=fill)
        digital[theme] = save_asset(points.resize((768, 768), Image.Resampling.LANCZOS),
                                    'portrait-particles-' + theme)

    real = Image.fromarray(np.rint(np.dstack((rgb, alpha)) * 255).astype('u1')).transform(
        (768, 768), Image.Transform.AFFINE, transform, resample=Image.Resampling.BICUBIC)
    return digital, save_asset(real, 'portrait-real')


def main():
    assert sha(SOURCE)==SOURCE_SHA,'Reinspect and retrace if the source changes.'
    assert sha(MODEL)==MODEL_SHA,'Unexpected landmark model checksum.'
    OUTPUT.mkdir(exist_ok=True,parents=True);PRIVATE.mkdir(exist_ok=True,parents=True)
    image=Image.open(SOURCE).convert('RGB');assert image.size==(400,400)
    rgb=np.asarray(image)/255.
    points=detect(image)
    alpha, clean=segmentation(rgb)
    rgb=linear_to_srgb(clean)
    feature=feature_map(points,rgb,alpha)
    depth,center_z,audit=reconstruct(points,alpha)
    dark_particles=particles(rgb,alpha,feature,depth,center_z)
    light_particles=particles(rgb,alpha,feature,depth,center_z,light=True)
    positions,colors,sizes,features=dark_particles
    vertices,uv,indices,cols,rows=surface(alpha,feature,depth,center_z)
    crop = np.s_[CROP[1]:CROP[3]+1, CROP[0]:CROP[2]+1]
    # Store linear-premultiplied color encoded as sRGB. GPU filtering and mips
    # operate on linear premultiplied values; the fragment shader recovers RGB.
    premultiplied = np.dstack((linear_to_srgb(clean * alpha[:, :, None]), alpha))
    texture = np.rint(premultiplied[crop] * 255).astype('u1')
    texture_image=Image.fromarray(texture)
    texture_image.save(OUTPUT/'portrait-detail.webp',lossless=True,method=6)
    embedded=io.BytesIO();Image.fromarray(np.rint(np.dstack((rgb, alpha))[crop] * 255).astype('u1')).save(embedded,format='PNG')
    write_glb(vertices,uv,indices,embedded.getvalue())
    previews(image,rgb,alpha,feature,depth,center_z,positions,colors,sizes,features)
    digital_fallback, real_fallback=reveal_previews(rgb,alpha,{'dark':dark_particles,'light':light_particles})
    summary={'version':8,'digitalFallback':digital_fallback,'realFallback':real_fallback,'source':'/images/dilshan-portrait.jpg','sourceSha256':SOURCE_SHA,'model':'MediaPipe Face Landmarker float16 v1','modelSha256':MODEL_SHA,
        'landmarks':len(points),'surfaceVertices':len(vertices),'surfaceTriangles':len(indices)//3,'surfaceColumns':cols,'surfaceRows':rows,
        'particles':len(positions),'lightParticles':len(light_particles[0]),'particleStride':24,'audit':audit,
        'sampling':'Deterministic scrambled Halton candidates, feature-weighted rejection, local spacing exclusion; no replacement clumps.',
        'limitations':'Source-aligned approximate 2.5D; inferred depth compressed to preserve likeness. Hair/ear/neck depth is conservative. The photo remains 400x400; no hidden or enhanced facial details are generated.',
        'assets':{p.name:{'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(OUTPUT.iterdir()) if p.name in {
            'facial-particles.bin', 'facial-particles-light.bin', 'facial-detail.bin', 'facial-surface.glb',
            'portrait-detail.webp', Path(real_fallback).name, *(Path(url).name for url in digital_fallback.values())}}}
    (OUTPUT/'manifest.json').write_text(json.dumps(summary,indent=2)+'\n')
    print(json.dumps(summary,indent=2))

if __name__=='__main__':main()
