import * as THREE from "three/webgpu";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { Pane } from "tweakpane";
import {
  mx_noise_float,
  color,
  cross,
  dot,
  float,
  transformNormalToView,
  positionLocal,
  positionWorld,
  cameraPosition,
  modelWorldMatrix,
  transformedNormalWorld,
  cameraProjectionMatrix,
  cameraViewMatrix,
  sign,
  step,
  Fn,
  uniform,
  varying,
  vec2,
  vec3,
  vec4,
  mat4,
  add,
  mul,
  sub,
  div,
  pow,
  mix,
  floor,
  fract,
  uv,
  texture,
  attribute,
  normalize,
  length,
  screenUV,
  normalWorld,
  textureBicubic,
  negate,
  Loop,
  roughness,
  sin,
  abs,
} from "three/tsl";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { ParametricGeometry } from "three/addons/geometries/ParametricGeometry.js";
import tt from "/spiral/tru.png";
import palletes from "nice-color-palettes";

let pallete = palletes[Math.floor(Math.random() * palletes.length)];

export default class Sketch {
  constructor(options) {
    this.scene = new THREE.Scene();

    this.container = options.dom;

    // Ensure container has dimensions before proceeding
    if (this.container.clientWidth === 0 || this.container.clientHeight === 0) {
      this.container.style.width = "100%";
      this.container.style.height = "100vh";
    }

    this.width = Math.max(1, this.container.clientWidth);
    this.height = Math.max(1, this.container.clientHeight);

    this.init(options);
  }

  async init(options) {
    try {
      // Create WebGPU renderer
      this.renderer = new THREE.WebGPURenderer({ antialias: true });

      // Wait for the renderer to initialize
      await this.renderer.init();

      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // Ensure dimensions are valid
      this.width = Math.max(1, this.container.clientWidth);
      this.height = Math.max(1, this.container.clientHeight);
      console.log("Setting renderer size:", this.width, this.height);

      this.renderer.setSize(this.width, this.height);
      this.renderer.setClearColor(0xffffff, 1);

      this.container.appendChild(this.renderer.domElement);

      this.camera = new THREE.PerspectiveCamera(
        35,
        this.width / this.height,
        0.01,
        100
      );
      this.camera.position.set(0, -1, 20);
      // this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.time = 0;

      this.isPlaying = true;

      this.addObjects();
      this.addLights();
      this.setupResize();
      // this.setUpSettings();

      // Start rendering after initialization
      this.render();
    } catch (error) {
      console.error("WebGPU initialization error:", error);
    }
  }

  setUpSettings() {
    this.settings = {
      progress: 0,
    };
    this.pane = new Pane();
    this.pane.addBinding(this.settings, "progress", {
      min: 0,
      max: 1,
      step: 0.01,
    });
  }

  setupResize() {
    window.addEventListener("resize", this.resize.bind(this));
    // Initial resize
    this.resize();
  }

  resize() {
    // Ensure we have valid dimensions
    this.width = Math.max(1, this.container.clientWidth);
    this.height = Math.max(1, this.container.clientHeight);

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  addObjects() {
    this.material = new THREE.MeshPhysicalNodeMaterial({
      side: THREE.DoubleSide,
      color: 0x000099,
      roughness: 0.4,
      metalness: 0.2,
    });

    const getColor = Fn(({ pallete, random }) => {
      let c1 = color(color(pallete[0]));
      c1 = mix(c1, color(pallete[1]), step(0.2, random));
      c1 = mix(c1, color(pallete[2]), step(0.4, random));
      c1 = mix(c1, color(pallete[3]), step(0.6, random));
      c1 = mix(c1, color(pallete[4]), step(0.8, random));
      return c1;
    });

    let playhead = uniform(0);
    this.playhead = playhead;

    let mymap = new THREE.TextureLoader().load(tt);
    mymap.colorSpace = THREE.SRGBColorSpace;
    mymap.wrapS = THREE.RepeatWrapping;
    mymap.wrapT = THREE.RepeatWrapping;

    let calculated = Fn(() => {
      let row = floor(fract(uv().y.add(playhead)).mul(57));
      let randomValue = fract(sin(row.mul(123)).mul(456789.123));

      let color = getColor({ pallete, random: randomValue });

      let newuv = uv().toVar();

      newuv.y.add(playhead);
      newuv.x.mulAssign(7);
      // newuv.y.mulAssign(5);

      let rowSpeed = randomValue;
      newuv.x.addAssign(playhead.mul(rowSpeed));

      newuv.y.addAssign(playhead);
      // return texture(mymap, newuv).r.oneMinus().mul(randomValue);
      return color;
    });

    this.material.colorNode = calculated();
    this.material.roughnessNode = calculated();

    function bezier(a, b, c, d, t) {
      let oneMinusT = 1 - t;
      return (
        a * oneMinusT * oneMinusT * oneMinusT +
        b * t * oneMinusT * oneMinusT +
        c * t * t * oneMinusT +
        d * t * t * t
      );
    }

    function getRadius(t) {
      let x = bezier(70, 1, 1, 1, t);
      return x;
    }

    this.geometry = new ParametricGeometry(
      (u, v, target) => {
        let r = getRadius(v);
        let x = Math.sin(u * Math.PI * 2) * r;
        let y = Math.cos(u * Math.PI * 2) * r;
        let z = (v - 0.5) * 15;
        target.set(x, y, z);
      },
      325,
      325
    );

    this.plane = new THREE.Mesh(this.geometry, this.material);
    this.plane.rotation.x = -1;
    this.plane.rotation.y = -0.5;
    this.scene.add(this.plane);
  }

  addLights() {
    const light1 = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(light1);

    const light2 = new THREE.DirectionalLight(0xffffff, 0.5);
    light2.position.set(0.5, 0, 0.866);
    this.scene.add(light2);

    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = this.pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
  }

  async render() {
    if (!this.isPlaying) return;

    this.time -= 0.001;
    this.playhead.value = this.time;
    // Update controls
    // this.controls.update();

    try {
      // Use renderAsync for WebGPU
      await this.renderer.renderAsync(this.scene, this.camera);
      // Schedule next frame only after successful render
      requestAnimationFrame(this.render.bind(this));
    } catch (error) {
      console.error("Render error:", error);
      // Try to recover by scheduling next frame anyway
      requestAnimationFrame(this.render.bind(this));
    }
  }
}

// Wait for DOM to be ready
window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("canvas");
  if (canvas) {
    new Sketch({
      dom: canvas,
    });
  } else {
    console.error("Canvas element not found");
  }
});
