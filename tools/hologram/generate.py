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
CROP = (138, 28, 280, 224)
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


def segmentation(image):
    # Photo-specific seed contour from V1. GrabCut refines only its boundary;
    # neither another head template nor a segmentation model is introduced.
    outline = [(146,110),(143,96),(143,85),(146,73),(149,64),(155,54),(164,47),
        (166,35),(171,42),(177,36),(185,39),(193,35),(205,39),(217,37),(230,41),
        (241,43),(250,51),(260,55),(268,61),(276,62),(269,73),(274,71),
        (268,83),(266,96),(262,111),(262,121),(267,119),(268,130),(263,142),
        (256,147),(253,162),(246,178),(239,188),(235,204),(239,218),(223,227),
        (201,231),(180,220),(175,207),(174,191),(164,179),(157,161),(153,147),
        (148,142),(146,133),(144,122),(146,117)]
    seed_image = Image.new('L', (400, 400))
    ImageDraw.Draw(seed_image).polygon(outline, fill=1)
    seed = np.asarray(seed_image).astype('uint8')
    expanded = cv2.dilate(seed, np.ones((9,9), 'uint8'))
    core = cv2.erode(seed, np.ones((5,5), 'uint8'))
    labels = np.full((400,400), cv2.GC_BGD, 'uint8')
    labels[expanded > 0] = cv2.GC_PR_BGD
    labels[seed > 0] = cv2.GC_PR_FGD
    labels[core > 0] = cv2.GC_FGD
    cv2.setRNGSeed(1989)
    cv2.grabCut(np.asarray(image), labels, None, np.zeros((1,65)), np.zeros((1,65)), 4, cv2.GC_INIT_WITH_MASK)
    mask = ((labels == cv2.GC_FGD) | (labels == cv2.GC_PR_FGD)).astype(float)
    # The exact source mask is kept within a tightly bounded original-photo crop.
    yy, xx = np.mgrid[:400, :400]
    mask *= (xx >= CROP[0]) & (xx <= CROP[2]) & (yy >= CROP[1]) & (yy <= CROP[3])
    alpha = gaussian_filter(mask, .55) * np.clip((218-yy)/23, 0, 1)
    Image.fromarray(np.uint8(alpha*255)).save(PRIVATE / 'segmentation.png')
    return alpha


def feature_map(points, rgb, alpha):
    lines = Image.new('L', (400,400))
    draw = ImageDraw.Draw(lines)
    connections = set()
    for name in ['FACE_LANDMARKS_LEFT_EYE', 'FACE_LANDMARKS_RIGHT_EYE',
                 'FACE_LANDMARKS_LEFT_EYEBROW', 'FACE_LANDMARKS_RIGHT_EYEBROW',
                 'FACE_LANDMARKS_LIPS', 'FACE_LANDMARKS_FACE_OVAL']:
        weight = 145 if 'OVAL' in name else 255
        for pair in getattr(mp.tasks.vision.FaceLandmarksConnections, name):
            a, b = pair.start, pair.end
            connections.add(tuple(sorted((a,b))))
            draw.line([tuple(points[a,:2]), tuple(points[b,:2])], fill=weight, width=2)
    # Actual detected nose landmarks, not hand-drawn facial proportions.
    for chain in [[168,6,197,195,5,4,1,19,94,2], [98,97,2,326,327]]:
        draw.line([tuple(points[i,:2]) for i in chain], fill=255, width=2)
        connections.update(tuple(sorted(pair)) for pair in zip(chain, chain[1:]))
    guided = np.clip(gaussian_filter(np.asarray(lines)/255., 2.2)*2.4, 0, 1)
    lum = rgb @ np.array([.2126,.7152,.0722])
    gy, gx = np.gradient(gaussian_filter(lum,.6))
    edge = np.clip(np.hypot(gx,gy)*7, 0, 1)
    # Preserve photographic facial-hair boundaries and actual hair strands.
    features = np.clip(np.maximum(guided, edge*.72), 0, 1) * alpha
    Image.fromarray(np.uint8(features*255)).save(PRIVATE / 'feature-density.png')
    return features, sorted(connections)


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


def particles(rgb, alpha, feature, depth, center_z):
    # Scrambled Halton candidates give progressive spatial coverage. Feature-aware
    # rejection and a spatial exclusion radius prevent V1's replacement clumps.
    candidates = qmc.Halton(3,scramble=True,seed=1989).random(240000)
    xs = CROP[0]+candidates[:,0]*(CROP[2]-CROP[0])
    ys = CROP[1]+candidates[:,1]*(CROP[3]-CROP[1])
    strength = sample(feature,xs,ys)
    valid = (sample(alpha,xs,ys)>.25) & (candidates[:,2] < .38+.62*strength)
    bins, selected = {}, []
    cell = 1.
    for index in np.flatnonzero(valid):
        x,y,f = xs[index],ys[index],strength[index]
        radius = .5+.42*(1-f)
        bx,by = int(x/cell),int(y/cell)
        crowded = False
        for dx in [-1,0,1]:
            for dy in [-1,0,1]:
                for px,py,pr in bins.get((bx+dx,by+dy),[]):
                    if (x-px)**2+(y-py)**2 < min(radius,pr)**2:
                        crowded=True;break
                if crowded:break
            if crowded:break
        if crowded:continue
        bins.setdefault((bx,by),[]).append((x,y,radius))
        selected.append(index)
        if len(selected)==18000:break
    assert len(selected)>=12000, 'Sampling failed to provide useful coverage.'
    chosen=np.array(selected)
    x,y=xs[chosen],ys[chosen]
    features=strength[chosen]
    positions=world(x,y,sample(depth,x,y),center_z)
    colors=np.column_stack([sample(rgb[:,:,i],x,y) for i in range(3)])
    sizes=.84-.29*features
    records=np.zeros(len(chosen),dtype=[('position','<f4',(3,)),('color','u1',(3,)),('size','u1'),('seed','<f4'),('feature','<f4')])
    records['position']=positions
    records['color']=np.rint(colors*255).astype('u1')
    records['size']=np.rint(sizes*150).astype('u1')
    records['seed']=np.mod(np.arange(len(chosen))*.61803398875,1)
    records['feature']=features
    (OUTPUT/'facial-particles.bin').write_bytes(b'DBHP'+struct.pack('<III',2,len(chosen),24)+records.tobytes())
    return positions, colors, sizes, features


def surface(alpha,feature,depth,center_z):
    xs=np.arange(CROP[0],CROP[2]+1,2.)
    ys=np.arange(CROP[1],CROP[3]+1,2.)
    x,y=np.meshgrid(xs,ys)
    positions=world(x.ravel(),y.ravel(),sample(depth,x.ravel(),y.ravel()),center_z)
    uv=np.column_stack(((x.ravel()-CROP[0])/(CROP[2]-CROP[0]),1-(y.ravel()-CROP[1])/(CROP[3]-CROP[1])))
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



def reveal_previews(image,rgb,alpha,feature,depth,center_z,positions,colors,sizes,features,contours):
    """Exactly aligned digital/real static states for touch, reduced motion and failure."""
    linear=srgb_to_linear(rgb)
    lum=linear@np.array([.2126,.7152,.0722])
    level=np.floor(np.clip(lum,0,.999)*6)/5
    gy,gx=np.gradient(gaussian_filter(lum,.45))
    edge=np.minimum(np.hypot(gx,gy)*4,.65)
    digital=np.array([.008,.035,.065])+level[:,:,None]*np.array([.10,.31,.40])*.9
    digital+=np.array([.10,.35,.43])*edge[:,:,None]*(.3+.7*feature[:,:,None])
    rgba=np.dstack((np.uint8(np.clip(linear_to_srgb(digital),0,1)*255),np.uint8(alpha*(.32+.14*feature)*255)))
    transform=(SCALE/192,0,CENTER[0]-384*SCALE/192,0,SCALE/192,CENTER[1]-384*SCALE/192)
    def project(pixels):
        return Image.fromarray(pixels).transform((768,768),Image.Transform.AFFINE,transform,resample=Image.Resampling.BICUBIC)
    base=project(rgba)
    layer=Image.new('RGBA',(768,768))
    draw=ImageDraw.Draw(layer)
    for p,c,size,f in zip(positions,colors,sizes,features):
        value=float(srgb_to_linear(c)@np.array([.2126,.7152,.0722]))**.8
        cyan=np.array([.12,.72,.93])*(.025+value*1.15)
        color=cyan*(1-f*.36)+np.array([.78,.95,1.])*value*f*.36
        fill=tuple(np.uint8(np.clip(linear_to_srgb(color),0,1)*255))+(185,)
        x,y=384+p[0]*192,384-p[1]*192
        radius=size*.62
        draw.ellipse((x-radius,y-radius,x+radius,y+radius),fill=fill)
    base=Image.alpha_composite(base,layer)
    lines=Image.new('RGBA',base.size);draw=ImageDraw.Draw(lines)
    for a,b in contours.reshape(-1,2,3):
        draw.line([(384+a[0]*192,384-a[1]*192),(384+b[0]*192,384-b[1]*192)],fill=(139,232,255,48),width=1)
    digital=Image.alpha_composite(base,lines)
    original=np.dstack((np.asarray(image),np.uint8(alpha*255)))
    real=project(original)
    digital.save(OUTPUT/'portrait-digital-v3.webp',quality=94,method=6)
    real.save(OUTPUT/'portrait-real-v3.webp',quality=97,method=6)
    sheet=Image.new('RGB',(1536,820),'#05060b')
    sheet.paste(digital,(0,45),digital);sheet.paste(real,(768,45),real)
    draw=ImageDraw.Draw(sheet);draw.text((35,15),'DIGITAL IDENTITY / DEFAULT',fill='#b8dbea');draw.text((803,15),'REAL IDENTITY / WHILE HOLDING',fill='#b8dbea')
    sheet.save(PRIVATE/'hold-reveal-states.jpg',quality=95)

def main():
    assert sha(SOURCE)==SOURCE_SHA,'Reinspect and retrace if the source changes.'
    assert sha(MODEL)==MODEL_SHA,'Unexpected landmark model checksum.'
    OUTPUT.mkdir(exist_ok=True,parents=True);PRIVATE.mkdir(exist_ok=True,parents=True)
    image=Image.open(SOURCE).convert('RGB');assert image.size==(400,400)
    rgb=np.asarray(image)/255.
    points=detect(image)
    alpha=segmentation(image)
    feature,connections=feature_map(points,rgb,alpha)
    depth,center_z,audit=reconstruct(points,alpha)
    positions,colors,sizes,features=particles(rgb,alpha,feature,depth,center_z)
    vertices,uv,indices,cols,rows=surface(alpha,feature,depth,center_z)
    texture=np.dstack((np.asarray(image),np.uint8(alpha*255)))[CROP[1]:CROP[3]+1,CROP[0]:CROP[2]+1]
    texture_image=Image.fromarray(texture)
    texture_image.save(OUTPUT/'portrait-detail.webp',lossless=True,method=6)
    embedded=io.BytesIO();texture_image.save(embedded,format='PNG')
    write_glb(vertices,uv,indices,embedded.getvalue())
    # Contours now sample the exact same smoothed depth surface as the detail mesh.
    xy=np.array([points[i,:2] for pair in connections for i in pair])
    contours=world(xy[:,0],xy[:,1],sample(depth,xy[:,0],xy[:,1]),center_z).astype('<f4')
    # Source-gradient strands keep hair and mustache detail specific to this photo.
    edges=cv2.Canny(np.asarray(image),60,120)
    yy,xx=np.mgrid[:400,:400]
    region=(yy<103)|((yy>140)&(yy<179)&(xx>170)&(xx<244))
    edges[(alpha<.8)|(~region)]=0
    strokes,_=cv2.findContours(edges,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
    extras=[]
    for stroke in strokes:
        length=cv2.arcLength(stroke,False)
        if length<6 or length>110:continue
        points2=cv2.approxPolyDP(stroke,.5,False).reshape(-1,2)
        for a,b in zip(points2,points2[1:]):
            if np.linalg.norm(a-b)>7:continue
            extras.extend([a,b])
        if len(extras)>1400:break
    if extras:
        xy2=np.array(extras)
        contours=np.concatenate((contours,world(xy2[:,0],xy2[:,1],sample(depth,xy2[:,0],xy2[:,1]),center_z).astype('<f4')))
    (OUTPUT/'facial-contours.bin').write_bytes(contours.tobytes())
    previews(image,rgb,alpha,feature,depth,center_z,positions,colors,sizes,features)
    reveal_previews(image,rgb,alpha,feature,depth,center_z,positions,colors,sizes,features,contours)
    summary={'version':3,'source':'/images/dilshan-portrait.jpg','sourceSha256':SOURCE_SHA,'model':'MediaPipe Face Landmarker float16 v1','modelSha256':MODEL_SHA,
        'landmarks':len(points),'surfaceVertices':len(vertices),'surfaceTriangles':len(indices)//3,'surfaceColumns':cols,'surfaceRows':rows,
        'particles':len(positions),'particleStride':24,'contourVertices':len(contours),'audit':audit,
        'sampling':'Deterministic scrambled Halton candidates, feature-weighted rejection, local spacing exclusion; no replacement clumps.',
        'limitations':'Source-aligned approximate 2.5D; inferred depth compressed to preserve likeness. Hair/ear/neck depth is conservative. The photo remains 400x400; no hidden or enhanced facial details are generated.',
        'assets':{p.name:{'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(OUTPUT.iterdir()) if p.suffix in ['.bin','.glb','.webp']}}
    (OUTPUT/'manifest.json').write_text(json.dumps(summary,indent=2)+'\n')
    print(json.dumps(summary,indent=2))

if __name__=='__main__':main()
