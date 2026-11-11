import { useEffect, useRef, type CSSProperties } from 'react';
import styles from './AmbientBackground.module.css';

export type AmbientMotion = 'flow' | 'calm' | 'still';
interface Props {
  style: CSSProperties;
  motion: AmbientMotion;
  light: boolean;
  enabled: boolean;
}
const VERTEX = `attribute vec2 position; varying vec2 uv;
void main() { uv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }`;
const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 uv;
uniform float time;
uniform float aspect;
uniform float light;
uniform vec3 colorA;
uniform vec3 colorB;
uniform vec3 colorC;
float merge(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b-a)/k, 0.0, 1.0);
  return mix(b, a, h) - k*h*(1.0-h);
}
void main() {
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * 2.0;
  float field = 8.0;
  vec3 weighted = vec3(0.0);
  float weightSum = 0.0;
  for (int i=0; i<6; i++) {
    float f = float(i);
    float phase = f * 2.399;
    float t = time * (0.045 + f*0.004);
    vec2 center = vec2(
      sin(t*0.62 + phase) * aspect * 0.72,
      sin(t + phase*1.43) * 0.92
    );
    vec2 q = p-center;
    float angle = sin(t*0.7+phase)*0.6;
    q = mat2(cos(angle), -sin(angle), sin(angle), cos(angle))*q;
    q.y *= 0.65 + 0.14*sin(t*1.2+phase);
    float radius = 0.30 + 0.09*sin(t*0.8+phase);
    float d = length(q) - radius;
    field = merge(field, d, 0.26);
    float w = 1.0/(0.08+dot(q,q));
    vec3 col = mix(colorA, colorB, 0.5+0.5*sin(phase));
    col = mix(col, colorC, 0.10+0.10*sin(t+phase));
    weighted += col*w; weightSum += w;
  }
  // Airbrushed pools and a pale, chromatic edge, like light on aged film.
  // The field still merges and separates; these broad bands soften its surface.
  float body = 1.0-smoothstep(-0.20, 0.24, field);
  float halo = exp(-max(field, 0.0)*3.2)*0.16;
  float bloom = exp(-pow((field-0.015)*4.7, 2.0));
  float core = 1.0-smoothstep(-0.42, -0.04, field);
  vec3 color = weighted/max(weightSum, 0.001);
  float wash = 0.5+0.5*sin(p.x*0.8-p.y*1.1+time*0.018);
  vec3 background = mix(vec3(0.012,0.020,0.022), vec3(0.95,0.95,0.92), light);
  vec3 liquid = color*(0.80+wash*0.25);
  liquid = mix(liquid, mix(color, vec3(1.0), 0.30), light);
  vec3 result = mix(background + color*halo, liquid, body*0.95);
  vec3 edge = mix(colorB, colorC, 0.3+wash*0.5);
  edge = mix(edge, vec3(0.94,0.96,1.0), 0.20);
  result = mix(result, edge, bloom*0.56);
  result = mix(result, color*0.44, core*0.35*(1.0-light));
  float grain = fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))))-0.5;
  gl_FragColor = vec4(result+grain*0.05,1.0);
}`;
function rgb(value: string): number[] {
  return [1, 3, 5].map(offset => parseInt(value.slice(offset, offset + 2), 16) / 255);
}

/** A single persistent field: key changes recolor the liquid without restarting its motion. */
export function AmbientBackground({ style, motion, light, enabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settings = useRef({ colors: ['#e4c928', '#ba7618', '#ffe77b'], motion, light, enabled });
  const wakeRenderer = useRef(() => {});
  useEffect(() => {
    const vars = style as Record<string, string>;
    settings.current = { colors: [vars['--blob-1'], vars['--blob-2'], vars['--blob-3']], motion, light, enabled };
    wakeRenderer.current();
  }, [style, motion, light, enabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposeRenderer = () => {};
    const initialize = () => {
      disposeRenderer();
      const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
      if (!gl) return;
      const compile = (type: number, text: string) => {
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, text); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
        return shader;
      };
      const vertex = compile(gl.VERTEX_SHADER, VERTEX);
      const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
      if (!vertex || !fragment) { if (vertex) gl.deleteShader(vertex); if (fragment) gl.deleteShader(fragment); return; }
      const program = gl.createProgram()!;
      gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment); return; }
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
      const attribute = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
      const uniforms = Object.fromEntries(['time', 'aspect', 'light', 'colorA', 'colorB', 'colorC'].map(key => [key, gl.getUniformLocation(program, key)]));
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      let colors = settings.current.colors.map(rgb);
      let currentLight = settings.current.light ? 1 : 0;
      let elapsed = 18;
      let previous = performance.now();
      let lastDraw = 0;
      let raf = 0;
      const resize = () => {
        // The fluid stays smooth at a modest resolution; audio gets the headroom.
        const ratio = Math.min(1, 1000 / window.innerWidth);
        canvas.width = Math.round(window.innerWidth * ratio);
        canvas.height = Math.round(window.innerHeight * ratio);
        gl.viewport(0, 0, canvas.width, canvas.height);
        wakeRenderer.current();
      };
      resize();
      canvas.dataset.ready = 'true';
      const render = (now: number) => {
        raf = 0;
        if (document.hidden || !settings.current.enabled) { previous = now; return; }
        if (now-lastDraw < 1000/30) { raf = requestAnimationFrame(render); return; }
        const dt = Math.min((now-previous)/1000, 0.1);
        previous = now; lastDraw = now;
        const { motion: movement, colors: targets, light: lightCanvas } = settings.current;
        const speed = reduced.matches || movement === 'still' ? 0 : movement === 'calm' ? 0.3 : 1;
        elapsed += dt*speed;
        const blend = reduced.matches ? 1 : 1-Math.exp(-dt*1.4);
        const targetColors = targets.map(rgb);
        colors = colors.map((color, i) => color.map((channel, j) => channel + (targetColors[i][j]-channel)*blend));
        currentLight += ((lightCanvas ? 1 : 0)-currentLight)*blend;
        gl.uniform1f(uniforms.time, elapsed);
        gl.uniform1f(uniforms.aspect, canvas.width/canvas.height);
        gl.uniform1f(uniforms.light, currentLight);
        ['colorA','colorB','colorC'].forEach((name, i) => gl.uniform3fv(uniforms[name], colors[i]));
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        const recoloring = colors.some((color, i) => color.some((channel, j) => Math.abs(channel-targetColors[i][j]) > 0.001))
          || Math.abs(currentLight-(lightCanvas ? 1 : 0)) > 0.001;
        if (speed || recoloring) raf = requestAnimationFrame(render);
      };
      const visibility = () => { if (!document.hidden && !raf) { previous = performance.now(); raf = requestAnimationFrame(render); } };
      wakeRenderer.current = visibility;
      reduced.addEventListener('change', visibility);
      raf = requestAnimationFrame(render);
      window.addEventListener('resize', resize);
      document.addEventListener('visibilitychange', visibility);
      disposeRenderer = () => {
        cancelAnimationFrame(raf); raf = 0; wakeRenderer.current = () => {};
        reduced.removeEventListener('change', visibility);
        window.removeEventListener('resize', resize);
        document.removeEventListener('visibilitychange', visibility);
        gl.deleteBuffer(buffer); gl.deleteProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment);
      };
    };
    const lost = (event: Event) => { event.preventDefault(); disposeRenderer(); delete canvas.dataset.ready; };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', initialize);
    initialize();
    return () => { disposeRenderer(); canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('webglcontextrestored', initialize); };
  }, []);

  return <div className={styles.root} style={style} data-motion={motion} aria-hidden="true">
    <div className={styles.fallback}><i /><i /><i /></div>
    <canvas className={styles.canvas} ref={canvasRef} />
    <div className={styles.shade} />
    <div className={styles.grain} />
  </div>;
}
