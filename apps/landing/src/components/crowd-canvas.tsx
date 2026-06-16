"use client";

import { memo, useEffect, useRef } from "react";
import gsap from "gsap";

type Peep = {
  image: HTMLImageElement;
  rect: [number, number, number, number];
  width: number;
  height: number;
  x: number;
  y: number;
  anchorY: number;
  scaleX: number;
  walk?: gsap.core.Timeline;
};

function CrowdCanvasComponent() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let context: CanvasRenderingContext2D | null = null;
    try {
      context = canvas.getContext("2d");
    } catch {
      return;
    }
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const image = new Image();
    const peeps: Peep[] = [];
    const stage = { width: 0, height: 0 };
    let active = true;
    let pixelRatio = 1;

    const render = () => {
      if (!active || !context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.save();
      context.scale(pixelRatio, pixelRatio);
      peeps.toSorted((a, b) => a.anchorY - b.anchorY).forEach((peep) => {
        context?.save();
        context?.translate(peep.x, peep.y);
        context?.scale(peep.scaleX, 1);
        context?.drawImage(
          peep.image,
          ...peep.rect,
          0,
          0,
          peep.width,
          peep.height,
        );
        context?.restore();
      });
      context.restore();
    };

    const beginWalk = (peep: Peep, index: number) => {
      const direction = index % 2 === 0 ? 1 : -1;
      const startX = direction === 1 ? -peep.width : stage.width + peep.width;
      const endX = direction === 1 ? stage.width + peep.width : -peep.width;
      peep.x = reducedMotion ? (stage.width / Math.max(peeps.length, 1)) * index : startX;
      peep.scaleX = direction;

      if (!reducedMotion) {
        peep.walk = gsap.timeline({ repeat: -1, delay: -(index * 0.43) });
        peep.walk.to(peep, { x: endX, duration: 12 + (index % 5), ease: "none" }, 0);
        peep.walk.to(peep, { y: peep.anchorY - 9, duration: 0.28, repeat: -1, yoyo: true, ease: "sine.inOut" }, 0);
      }
    };

    const resize = () => {
      stage.width = canvas.clientWidth;
      stage.height = canvas.clientHeight;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(stage.width * pixelRatio));
      canvas.height = Math.max(1, Math.floor(stage.height * pixelRatio));
      peeps.forEach((peep, index) => {
        peep.walk?.kill();
        peep.anchorY = stage.height - peep.height + 20 + (index % 4) * 26;
        peep.y = peep.anchorY;
        beginWalk(peep, index);
      });
      render();
    };

    image.onload = () => {
      if (!active) return;
      const rows = 15;
      const cols = 7;
      const spriteWidth = image.naturalWidth / rows;
      const spriteHeight = image.naturalHeight / cols;
      const visibleCount = window.innerWidth < 640 ? 10 : 18;

      for (let index = 0; index < visibleCount; index += 1) {
        const spriteIndex = (index * 7 + 3) % (rows * cols);
        const scale = window.innerWidth < 640 ? 0.62 : 0.82 + (index % 3) * 0.08;
        peeps.push({
          image,
          rect: [
            (spriteIndex % rows) * spriteWidth,
            Math.floor(spriteIndex / rows) * spriteHeight,
            spriteWidth,
            spriteHeight,
          ],
          width: spriteWidth * scale,
          height: spriteHeight * scale,
          x: 0,
          y: 0,
          anchorY: 0,
          scaleX: 1,
        });
      }
      resize();
      gsap.ticker.add(render);
    };

    image.src = "/images/peeps/all-peeps.png";
    window.addEventListener("resize", resize, { passive: true });

    return () => {
      active = false;
      window.removeEventListener("resize", resize);
      gsap.ticker.remove(render);
      peeps.forEach((peep) => peep.walk?.kill());
    };
  }, []);

  return <canvas ref={canvasRef} aria-label="Animated crowd of event attendees" className="absolute inset-x-0 bottom-0 h-[48%] w-full" />;
}

export const CrowdCanvas = memo(CrowdCanvasComponent);
