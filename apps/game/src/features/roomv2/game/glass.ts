import * as THREE from 'three';

/*
 * Rain-on-glass, after the rain.
 * Droplet functions adapted from "Heartfelt" by Martijn Steinrucken (BigWings), 2017
 * (CC BY-NC-SA 3.0). Here they refract a mip-mapped render target of the 3D city
 * rendered from the same camera, so the drops lens real parallax-correct lights.
 */
export function createRainGlass(cityTex: THREE.Texture, paneSize: THREE.Vector2, seed: number) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tCity: { value: cityTex },
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uScale: { value: new THREE.Vector2(paneSize.x / 0.45, paneSize.y / 0.45) },
      uSeed: { value: seed },
      uFog: { value: 0.55 },
      uWarm: { value: new THREE.Color(0, 0, 0) },
      uSliding: { value: 0.35 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vN;
      void main(){
        vUv = uv;
        vec4 w = modelMatrix * vec4(position,1.0);
        vWorld = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tCity;
      uniform vec2 uRes;
      uniform float uTime;
      uniform vec2 uScale;
      uniform float uSeed;
      uniform float uFog;
      uniform vec3 uWarm;
      uniform float uSliding;
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vN;
      #define S(a,b,t) smoothstep(a,b,t)

      vec3 N13(float p){
        vec3 p3 = fract(vec3(p) * vec3(.1031,.11369,.13787));
        p3 += dot(p3, p3.yzx + 19.19);
        return fract(vec3((p3.x + p3.y)*p3.z, (p3.x+p3.z)*p3.y, (p3.y+p3.z)*p3.x));
      }
      float N(float t){ return fract(sin(t*12345.564)*7658.76); }
      float Saw(float b, float t){ return S(0., b, t)*S(1., b, t); }

      vec2 DropLayer2(vec2 uv, float t){
        vec2 UV = uv;
        uv.y += t*0.75;
        vec2 a = vec2(6., 1.);
        vec2 grid = a*2.;
        vec2 id = floor(uv*grid);
        float colShift = N(id.x + uSeed);
        uv.y += colShift;
        id = floor(uv*grid);
        vec3 n = N13(id.x*35.2+id.y*2376.1 + uSeed);
        vec2 st = fract(uv*grid)-vec2(.5, 0);
        float x = n.x-.5;
        float y = UV.y*20.;
        float wiggle = sin(y+sin(y));
        x += wiggle*(.5-abs(x))*(n.z-.5);
        x *= .7;
        float ti = fract(t+n.z);
        y = (Saw(.85, ti)-.5)*.9+.5;
        vec2 p = vec2(x, y);
        float d = length((st-p)*a.yx);
        float mainDrop = S(.4, .0, d);
        float r = sqrt(S(1., y, st.y));
        float cd = abs(st.x-x);
        float trail = S(.23*r, .15*r*r, cd);
        float trailFront = S(-.02, .02, st.y-y);
        trail *= trailFront*r*r;
        y = UV.y;
        float trail2 = S(.2*r, .0, cd);
        float droplets = max(0., (sin(y*(1.-y)*120.)-st.y))*trail2*trailFront*n.z;
        y = fract(y*10.)+(st.y-.5);
        float dd = length(st-vec2(x, y));
        droplets = S(.3, 0., dd);
        float m = mainDrop+droplets*r*trailFront;
        // only some columns still run after the rain
        float runOn = step(1.0 - uSliding, N(id.x*7.13 + uSeed));
        return vec2(m, trail) * runOn;
      }

      float StaticDrops(vec2 uv, float t){
        uv *= 34.;
        vec2 id = floor(uv);
        uv = fract(uv)-.5;
        vec3 n = N13(id.x*107.45+id.y*3543.654 + uSeed);
        vec2 p = (n.xy-.5)*.7;
        float d = length(uv-p);
        // persistent beads, slowly evaporating & re-forming
        float fade = 0.55 + 0.45*Saw(.05, fract(t*0.03 + n.z));
        float c = S(.32, 0., d) * step(0.25, fract(n.z*10.)) * fade;
        return c;
      }

      vec2 Drops(vec2 uv, float t){
        float s = StaticDrops(uv, t);
        vec2 m1 = DropLayer2(uv, t);
        vec2 m2 = DropLayer2(uv*1.85, t*0.8);
        float c = s + m1.x + m2.x*0.7;
        c = S(.3, 1., c);
        return vec2(c, max(m1.y, m2.y));
      }

      void main(){
        vec2 uv = vUv * uScale;
        float t = uTime * .12;
        vec2 c = Drops(uv, t);
        vec2 e = vec2(.0015, 0.);
        float cx = Drops(uv+e, t).x;
        float cy = Drops(uv+e.yx, t).x;
        vec2 n = vec2(cx-c.x, cy-c.x);

        // condensation: heavier near the bottom & edges, cut by trails
        vec2 q = vUv;
        float edge = 1.0 - S(0.0, 0.18, min(min(q.x, 1.0-q.x), min(q.y*0.6, 1.0-q.y)));
        float fog = clamp(uFog * (0.35 + edge*0.8 + (1.0-q.y)*0.25), 0., 1.);
        fog *= 1.0 - clamp(c.y*1.5, 0., 1.);
        float focus = mix(1.0 + fog*5.5, 0.0, S(.1, .25, c.x));

        vec2 suv = gl_FragCoord.xy / uRes;
        vec3 col = textureLod(tCity, suv + n*0.9, focus).rgb;
        // drops are tiny lenses: flip & brighten what they see
        col *= 1.0 + c.x*0.35;
        // frosted veil
        vec3 veil = textureLod(tCity, suv, 6.0).rgb * 0.8 + vec3(0.012,0.014,0.02);
        col = mix(col, veil, fog*0.55*(1.0 - S(.1,.25,c.x)));

        // interior reflection on the night glass (warm room light, fresnel)
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - abs(dot(V, normalize(vN))), 3.0);
        col += uWarm * (0.05 + 0.35*fres) * (1.0 - c.x*0.6);
        col *= 0.92;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  return mat;
}
