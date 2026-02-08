// bg

const fluidBackground = () => {
  const canvas = document.getElementById("fluid-bg");
  if (!canvas) return;

  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: false,
  });

  if (!gl) {
    console.warn("WebGL not available");
    return;
  }

  // mousetrack
  let mouseX = 0.5;
  let mouseY = 0.5;
  let smoothMouseX = 0.5;
  let smoothMouseY = 0.5;

  window.addEventListener(
    "mousemove",
    (e) => {
      // normalizemousepos
      mouseX = Math.max(0.2, Math.min(0.8, e.clientX / window.innerWidth));
      mouseY = Math.max(0.2, Math.min(0.8, e.clientY / window.innerHeight));
    },
    { passive: true },
  );

  // shaders

  const vertexSource = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    precision highp float;

    uniform float u_time;
    uniform vec2  u_resolution;
    uniform vec2  u_mouse;

    // Simplex noise
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
        -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m * m;
      m = m * m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g;
      g.x = a0.x * x0.x + h.x * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution;
      float aspect = u_resolution.x / u_resolution.y;
      vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
      float t = u_time;

      // Background
      vec3 bgColor = vec3(0.078, 0.078, 0.078);

      // Mouse position (centered coords, Y inverted)
      vec2 mouse = vec2((u_mouse.x - 0.5) * aspect, 0.5 - u_mouse.y);

      // Domain warping — two passes for organic, smooth deformation
      // First warp layer (very slow, large scale)
      float warp1x = snoise(p * 0.8 + vec2(t * 0.04, 0.0)) * 0.3;
      float warp1y = snoise(p * 0.8 + vec2(0.0, t * 0.035)) * 0.3;
      vec2 q = p + vec2(warp1x, warp1y);

      // Second warp layer (feeds back, creates depth)
      float warp2x = snoise(q * 1.2 + vec2(t * 0.025, 1.7)) * 0.15;
      float warp2y = snoise(q * 1.2 + vec2(3.2, t * 0.03)) * 0.15;
      vec2 r = q + vec2(warp2x, warp2y);

      // Combine into a smooth field
      float n1 = snoise(r * 1.0 + t * 0.02) * 0.5 + 0.5;
      float n2 = snoise(r * 1.6 - t * 0.015 + 5.0) * 0.5 + 0.5;
      float n3 = snoise(r * 0.6 + t * 0.03 + 10.0) * 0.5 + 0.5;

      // Blend noise layers smoothly
      float field = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;

      // Mouse influence — gentle radial push into the field
      float mouseDist = length(p - mouse);
      float mouseInfluence = smoothstep(0.6, 0.0, mouseDist) * 0.25;
      field += mouseInfluence;

      // Muted, cohesive color palette
      vec3 deepPurple = vec3(0.18, 0.10, 0.28);
      vec3 warmPurple = vec3(0.28, 0.16, 0.38);
      vec3 subtleTeal = vec3(0.08, 0.08, 0.09);

      // Smooth color transitions across the field
      vec3 color = mix(deepPurple, warmPurple, smoothstep(0.3, 0.65, field));
      color = mix(color, subtleTeal, smoothstep(0.55, 0.85, field) * 0.4);

      // Vignette — darken edges smoothly
      float vignette = 1.0 - smoothstep(0.3, 1.1, length(p * 0.9));

      // Final composite — subtle, refined blend
      float opacity = 0.45 * vignette;
      vec3 finalColor = mix(bgColor, color, opacity);

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  // compshaders
  const compileShader = (source, type) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vertexShader = compileShader(vertexSource, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(fragmentSource, gl.FRAGMENT_SHADER);

  if (!vertexShader || !fragmentShader) return;

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return;
  }

  gl.useProgram(program);

  // fullscreenquad
  const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const aPosition = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  // uniforms
  const uTime = gl.getUniformLocation(program, "u_time");
  const uResolution = gl.getUniformLocation(program, "u_resolution");
  const uMouse = gl.getUniformLocation(program, "u_mouse");

  // resize
  let dpr = Math.min(window.devicePixelRatio, 2);
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uResolution, canvas.width, canvas.height);
  };

  window.addEventListener("resize", resize);
  resize();

  // animate
  let animationId;
  const startTime = performance.now();

  const animate = () => {
    const elapsed = (performance.now() - startTime) * 0.001;

    // mousetrack
    smoothMouseX += (mouseX - smoothMouseX) * 0.05;
    smoothMouseY += (mouseY - smoothMouseY) * 0.05;

    gl.uniform1f(uTime, elapsed);
    gl.uniform2f(uMouse, smoothMouseX, smoothMouseY);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    animationId = requestAnimationFrame(animate);
  };

  // hiddentabpause
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(animationId);
    } else {
      animationId = requestAnimationFrame(animate);
    }
  });

  animationId = requestAnimationFrame(animate);
};

// animateonscroll

const observeSkills = () => {
  const skillsSection = document.querySelector(".skills");
  const progressBars = document.querySelectorAll(".skills__progress-fill");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          progressBars.forEach((bar, index) => {
            setTimeout(() => {
              const progress = bar.getAttribute("data-progress");
              bar.style.setProperty("--progress-width", `${progress}%`);
              bar.classList.add("animate");
            }, index * 150); // stagger
          });

          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.3, // ~trigger
    },
  );

  if (skillsSection) {
    observer.observe(skillsSection);
  }
};

// loadedDOMinit
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    fluidBackground();
    observeSkills();
    initSideNav();
    initSmoothScroll();
    initBlobMask();
  });
} else {
  fluidBackground();
  observeSkills();
  initSideNav();
  initSmoothScroll();
  initBlobMask();
}

// sidenav

const initSideNav = () => {
  const navItems = document.querySelectorAll(".side-nav__item");
  const sections = ["hero", "skills", "projects"];

  // clickscroll
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const sectionId = item.getAttribute("data-section");
      const target = document.getElementById(sectionId);
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  // highlightactive
  const updateActiveNav = () => {
    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    let currentSection = "hero";

    sections.forEach((id) => {
      const section = document.getElementById(id);
      if (section) {
        const rect = section.getBoundingClientRect();

        if (rect.top <= windowHeight * 0.4) {
          currentSection = id;
        }
      }
    });

    navItems.forEach((item) => {
      item.classList.toggle(
        "active",
        item.getAttribute("data-section") === currentSection,
      );
    });
  };

  // headerscroll
  const header = document.querySelector(".header");
  const scrollIndicator = document.querySelector(".hero__scroll-indicator");
  const updateHeader = () => {
    const scrolled = window.scrollY > 30;
    if (header) {
      header.classList.toggle("scrolled", scrolled);
    }
    if (scrollIndicator) {
      scrollIndicator.classList.toggle("hidden", scrolled);
    }
  };

  window.addEventListener(
    "scroll",
    () => {
      updateActiveNav();
      updateHeader();
    },
    { passive: true },
  );
  updateActiveNav();
  updateHeader();
};

// smoothscroll

const initSmoothScroll = () => {
  let currentScroll = window.scrollY;
  let targetScroll = window.scrollY;
  let isRunning = false;
  const ease = 0.025;
  const multiplier = 1.2;

  // interceptwheel
  window.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();

      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      targetScroll += e.deltaY * multiplier;
      targetScroll = Math.max(0, Math.min(targetScroll, maxScroll));

      if (!isRunning) {
        isRunning = true;
        requestAnimationFrame(smoothStep);
      }
    },
    { passive: false },
  );

  const smoothStep = () => {
    currentScroll += (targetScroll - currentScroll) * ease;

    if (Math.abs(targetScroll - currentScroll) < 0.5) {
      currentScroll = targetScroll;
      window.scrollTo(0, currentScroll);
      isRunning = false;
      return;
    }

    window.scrollTo(0, currentScroll);
    requestAnimationFrame(smoothStep);
  };

  // syncnavs
  window.addEventListener(
    "scroll",
    () => {
      if (!isRunning) {
        currentScroll = window.scrollY;
        targetScroll = window.scrollY;
      }
    },
    { passive: true },
  );
};

// blobmask

const initBlobMask = () => {
  const blobPath = document.getElementById("blob-path");
  if (!blobPath) return;

  const numPoints = 8;
  const cx = 0.5,
    cy = 0.5;
  const baseRadius = 0.4;
  const maxRadius = 0.495;

  const getPoints = (t) => {
    const pts = [];
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2 - Math.PI / 2;
      const wobble =
        Math.sin(t * 0.7 + i * 1.8) * 0.04 +
        Math.sin(t * 1.1 + i * 0.9 + 2.0) * 0.03 +
        Math.cos(t * 0.5 + i * 2.5) * 0.02;
      const r = Math.min(baseRadius + wobble, maxRadius);
      pts.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
      });
    }
    return pts;
  };

  // smoothclosed
  const buildPath = (pts) => {
    const n = pts.length;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const p3 = pts[(i + 2) % n];
      const tension = 6;
      const cp1x = p1.x + (p2.x - p0.x) / tension;
      const cp1y = p1.y + (p2.y - p0.y) / tension;
      const cp2x = p2.x - (p3.x - p1.x) / tension;
      const cp2y = p2.y - (p3.y - p1.y) / tension;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  };

  const animate = () => {
    const t = performance.now() * 0.001;
    blobPath.setAttribute("d", buildPath(getPoints(t)));
    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
};
