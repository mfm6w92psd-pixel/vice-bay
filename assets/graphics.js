// Mika: "ultra" graphics pass for Vice Bay. Pure three.js core, no addons, no files.
//   const gfx = setupGraphics(renderer, scene, camera, { quality: 'low'|'medium'|'high' });
//   gfx.upgrade(scene)  -> once after the world is built (and on anything spawned later, e.g. gfx.upgrade(carGroup))
//   gfx.update(dt, { sunDir, skyColor, fogColor, wet, night })  -> every frame
//     sunDir: THREE.Vector3 toward the sun; skyColor/fogColor: THREE.Color you already compute; wet 0..1 (rain); night 0..1.
// What it does: filmic ACES tone mapping, a sky dome with sun disc + glow + horizon haze that matches the fog,
// sky reflections on everything (PMREM environment, refreshed as the sky changes), clear-coat car paint,
// reflective glass facades, wet shiny roads with puddle sheen when it rains, softer shadows, sharper textures.
import * as THREE from 'three';

const SKY_VS = `varying vec3 vDir; void main(){ vDir = normalize((modelMatrix * vec4(position,1.0)).xyz - cameraPosition); gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`;
const SKY_FS = `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunSize; uniform float night; varying vec3 vDir;
float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
void main(){
  vec3 d = normalize(vDir); float y = d.y;
  vec3 col = mix(horizon, top, pow(clamp(y, 0.0, 1.0), 0.45));
  col = mix(col, horizon * 0.85, smoothstep(0.0, -0.25, y));            // below horizon -> haze
  float s = max(dot(d, normalize(sunDir)), 0.0);
  col += sunColor * (pow(s, 8.0) * 0.25 + pow(s, 64.0) * 0.6);          // glow
  col += sunColor * smoothstep(1.0 - sunSize, 1.0 - sunSize * 0.6, s) * 4.0; // disc (HDR, tone-mapped)
  if (night > 0.01 && y > 0.0) { vec3 c = floor(d * 400.0); float st = step(0.9985, h(c)); col += vec3(st) * night * smoothstep(0.0, 0.3, y); } // stars
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function setupGraphics(renderer, scene, camera, { quality = 'medium' } = {}) {
  const Q = { low: 0, medium: 1, high: 2 }[quality] ?? 1;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (Q >= 2) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (Q >= 1) renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q >= 2 ? 2 : 1.5));
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  // Sky dome (follows the camera, always behind everything, ignores fog)
  const skyU = { top: { value: new THREE.Color(0x3d7fd6) }, horizon: { value: new THREE.Color(0xbfe3ff) }, sunDir: { value: new THREE.Vector3(0.4, 0.6, 0.3) },
    sunColor: { value: new THREE.Color(1, 0.92, 0.8) }, sunSize: { value: 0.0018 }, night: { value: 0 } };
  const skyMat = new THREE.ShaderMaterial({ uniforms: skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), skyMat); sky.frustumCulled = false; sky.renderOrder = -1; sky.scale.setScalar(Math.max(100, camera.far * 0.9));
  scene.add(sky);

  // Environment reflections from the same sky (plus a dark ground so things don't glow from below)
  const pmrem = new THREE.PMREMGenerator(renderer); let envRT = null, envSig = '', envTimer = 0;
  const envScene = new THREE.Scene(); const envSky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat); envScene.add(envSky);
  const envGround = new THREE.Mesh(new THREE.CircleGeometry(9.5, 24), new THREE.MeshBasicMaterial({ color: 0x3a3d40 })); envGround.rotation.x = -Math.PI / 2; envGround.position.y = -0.5; envScene.add(envGround);
  function refreshEnv() {
    if (Q === 0) return; const old = envRT; envRT = pmrem.fromScene(envScene, 0.02); scene.environment = envRT.texture; if (old) old.dispose();
  }

  // Material upgrades
  const roads = [], paints = [], facades = [];
  const tex = m => ['map', 'roughnessMap', 'metalnessMap'].forEach(k => { if (m[k]) { m[k].anisotropy = Math.min(maxAniso, Q >= 2 ? 8 : 4); m[k].needsUpdate = true; } });
  function upgrade(root) {
    const seen = new Set();
    root.traverse(o => {
      if (!o.isMesh) return; const list = [].concat(o.material);
      list.forEach((m, i) => {
        if (m && m.userData.swap) { const p = m.userData.swap; if (Array.isArray(o.material)) o.material = o.material.map(x => x === m ? p : x); else o.material = p; return; } // New Bot: later-spawned cars reuse the clear-coat paint
        if (!m || seen.has(m) || !m.isMeshStandardMaterial || m.userData.gfx) return; seen.add(m); m.userData.gfx = true; tex(m);
        const flat = o.geometry?.type === 'PlaneGeometry' && Math.abs(o.rotation.x + Math.PI / 2) < 0.01;
        if (m.userData.road || (flat && m.map && m.roughness >= 0.85)) { m.userData.baseRough = m.roughness; m.userData.baseColor = m.color.clone(); m.envMapIntensity = 0.6; roads.push(m); }
        else if (m.userData.facade) { m.envMapIntensity = 0.9; facades.push(m); }
        else if (m.metalness >= 0.5 && m.roughness <= 0.4 && !m.transparent) { // car paint
          if (Q >= 2 && !m.isMeshPhysicalMaterial) {
            const p = new THREE.MeshPhysicalMaterial({ color: m.color, metalness: 0.55, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.06, flatShading: m.flatShading, envMapIntensity: 1.4 });
            p.userData.gfx = true; seen.add(p);
            // shared through the material cache, so swap every user of the old material
            root.traverse(q => { if (q.isMesh) { if (q.material === m) q.material = p; else if (Array.isArray(q.material)) q.material = q.material.map(x => x === m ? p : x); } });
            paints.push(p); m.userData.swap = p;
          } else { m.roughness = 0.22; m.envMapIntensity = 1.3; paints.push(m); }
        } else if (m.color && m.color.r + m.color.g + m.color.b < 0.6 && m.metalness < 0.3 && m.roughness < 0.5) { m.envMapIntensity = 1.5; m.roughness = 0.05; m.metalness = 0.4; } // dark glass / windshields
        else m.envMapIntensity = Q === 0 ? 0 : 0.5;
        m.needsUpdate = true;
      });
    });
    return root;
  }

  const tmp = new THREE.Color(), wetTint = new THREE.Color(0x2a2c31);
  let lastWet = -1;
  function update(dt, { sunDir, skyColor, fogColor, wet = 0, night = 0 } = {}) {
    sky.position.copy(camera.position);
    if (sunDir) skyU.sunDir.value.copy(sunDir).normalize();
    const sd = skyU.sunDir.value, up = THREE.MathUtils.clamp(sd.y, -0.2, 1);
    if (fogColor || skyColor) {
      const hz = (fogColor || skyColor); skyU.horizon.value.copy(hz);
      skyU.top.value.copy(skyColor || hz).multiplyScalar(0.62).lerp(tmp.set(0x1d4f9e), 0.25 * Math.max(up, 0));
    }
    skyU.sunColor.value.setRGB(1, 0.75 + 0.2 * Math.max(up, 0), 0.55 + 0.35 * Math.max(up, 0)).multiplyScalar(THREE.MathUtils.smoothstep(up, -0.08, 0.05) * (1 - wet * 0.85));
    skyU.night.value = night * (1 - wet);
    renderer.toneMappingExposure = 1.05 + night * 0.25;
    // wet roads: darker, smoother -> reflect sky and lights
    if (Math.abs(wet - lastWet) > 0.01) { lastWet = wet; for (const m of roads) { m.roughness = THREE.MathUtils.lerp(m.userData.baseRough, 0.3, wet); m.metalness = 0.1 * wet; m.color.copy(m.userData.baseColor).lerp(wetTint, wet * 0.55); m.envMapIntensity = 0.6 + wet * 0.3; } }
    // refresh reflections when the sky noticeably changes (cheap: at most every 2s)
    envTimer -= dt; const sig = [skyU.horizon.value.getHexString(), (sd.x * 10 | 0), (sd.y * 10 | 0), (wet * 5 | 0)].join();
    if (Q > 0 && (envRT === null || (sig !== envSig && envTimer <= 0))) { envSig = sig; envTimer = 2; refreshEnv(); }
  }
  refreshEnv();
  return { upgrade, update, sky, setExposure: v => (renderer.toneMappingExposure = v), dispose() { pmrem.dispose(); envRT?.dispose(); scene.remove(sky); } };
}
