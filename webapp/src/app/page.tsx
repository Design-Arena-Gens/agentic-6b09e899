"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type GamePhase = "idle" | "running" | "gameover";

type Vector = {
  x: number;
  y: number;
};

type GameSnapshot = {
  jerry: Vector;
  tom: Vector;
  cheese: Vector;
  tomSpeed: number;
  frameScore: number;
  cheeseCollected: number;
  lastTimestamp: number;
};

const CANVAS_WIDTH = 880;
const CANVAS_HEIGHT = 540;
const JERRY_SPEED = 3.2;
const TOM_BASE_SPEED = 2.0;
const TOM_ACCELERATION = 0.08;
const CHEESE_RADIUS = 12;
const CHARACTER_RADIUS = 24;
const WALL_PADDING = CHARACTER_RADIUS + 6;

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const keyStateRef = useRef<Record<string, boolean>>({});
  const snapshotRef = useRef<GameSnapshot>({
    jerry: startingJerryPosition(),
    tom: { x: CANVAS_WIDTH / 6, y: CANVAS_HEIGHT / 2 },
    cheese: randomCheese(),
    tomSpeed: TOM_BASE_SPEED,
    frameScore: 0,
    cheeseCollected: 0,
    lastTimestamp: 0,
  });

  const [phase, setPhase] = useState<GamePhase>("idle");
  const [score, setScore] = useState(0);
  const [cheeseCollected, setCheeseCollected] = useState(0);
  const [best, setBest] = useState(0);

  const statusMessage = useMemo(() => {
    switch (phase) {
      case "running":
        return "Keep Jerry away from Tom!";
      case "gameover":
        return "Tom caught Jerry! Try again?";
      default:
        return "Help Jerry collect cheese and dodge Tom.";
    }
  }, [phase]);

  const startGame = useCallback(() => {
    snapshotRef.current = {
      jerry: startingJerryPosition(),
      tom: { x: CANVAS_WIDTH / 8, y: CANVAS_HEIGHT / 3 },
      cheese: randomCheese(),
      tomSpeed: TOM_BASE_SPEED,
      frameScore: 0,
      cheeseCollected: 0,
      lastTimestamp: 0,
    };
    keyStateRef.current = {};
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setScore(0);
    setCheeseCollected(0);
    setPhase("running");
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      keyStateRef.current[event.key.toLowerCase()] = true;
      if (event.key === " " && phase !== "running") {
        startGame();
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      keyStateRef.current[event.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [phase, startGame]);

  const updateCanvas = useCallback(
    function frame(time: number) {
      const canvas = canvasRef.current;
      if (!canvas || phase !== "running") {
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }

      const snapshot = snapshotRef.current;
      const delta =
        snapshot.lastTimestamp === 0
          ? 1
          : Math.min((time - snapshot.lastTimestamp) / (1000 / 60), 2.5);
      snapshot.lastTimestamp = time;

      moveJerry(snapshot, keyStateRef.current, delta);
      moveTom(snapshot, delta);

      if (charactersCollide(snapshot.jerry, snapshot.tom)) {
        setPhase("gameover");
        setBest((prev) => Math.max(prev, Math.floor(snapshot.frameScore)));
        if (animationRef.current !== null) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
        return;
      }

      if (charactersCollide(snapshot.jerry, snapshot.cheese, CHEESE_RADIUS)) {
        snapshot.cheese = randomCheese();
        snapshot.tomSpeed += TOM_ACCELERATION;
        snapshot.cheeseCollected += 1;
        snapshot.frameScore += 100;
        setCheeseCollected(snapshot.cheeseCollected);
      }

      snapshot.frameScore += 1.5 * delta;
      setScore(Math.floor(snapshot.frameScore));
      drawScene(ctx, snapshot);

      animationRef.current = requestAnimationFrame(frame);
    },
    [phase, setBest]
  );

  useEffect(() => {
    if (phase === "running") {
      animationRef.current = requestAnimationFrame(updateCanvas);
      return () => {
        if (animationRef.current !== null) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
      };
    }
    if (phase === "gameover") {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          drawScene(ctx, snapshotRef.current, true);
        }
      }
    }
    return undefined;
  }, [phase, updateCanvas]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && phase === "running") {
        setPhase("gameover");
        setBest((prev) => Math.max(prev, Math.floor(snapshotRef.current.frameScore)));
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [phase]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-amber-100 via-slate-100 to-blue-100 p-6 text-slate-900">
      <div className="w-full max-w-5xl rounded-2xl border border-white/60 bg-white/80 p-6 shadow-2xl backdrop-blur">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">
              Tom &amp; Jerry: Rooftop Chase
            </h1>
            <p className="text-sm font-medium text-slate-600 sm:text-base">{statusMessage}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm font-semibold sm:text-base">
            <ScoreBadge label="Score" value={score} />
            <ScoreBadge label="Cheese" value={cheeseCollected} />
            <ScoreBadge label="Best" value={best} />
          </div>
        </header>

        <div className="mt-6 flex flex-col items-center gap-4">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="w-full max-w-[880px] overflow-hidden rounded-xl border-4 border-slate-900 bg-[#0d1120] shadow-xl"
          />
          <div className="flex flex-col items-center gap-2 text-center text-xs text-slate-600 sm:text-sm">
            <p>
              Navigate Jerry with <strong>WASD</strong> or <strong>Arrow Keys</strong>. Collect
              cheese for bonus points and speed. Avoid Tom!
            </p>
            <p>Press <strong>Space</strong> or the button below to start or restart.</p>
            <button
              type="button"
              onClick={startGame}
              className="rounded-full bg-amber-400 px-6 py-2 text-sm font-bold text-slate-900 shadow-lg transition hover:bg-amber-300 hover:shadow-xl active:scale-95"
            >
              {phase === "running" ? "Restart" : phase === "gameover" ? "Play Again" : "Start Chase"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function startingJerryPosition(): Vector {
  return {
    x: CANVAS_WIDTH - WALL_PADDING * 3,
    y: CANVAS_HEIGHT / 2,
  };
}

function charactersCollide(a: Vector, b: Vector, radius = CHARACTER_RADIUS) {
  const distance = Math.hypot(a.x - b.x, a.y - b.y);
  return distance <= CHARACTER_RADIUS + radius;
}

function clampPosition(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function randomCheese(): Vector {
  const margin = WALL_PADDING * 1.5;
  return {
    x: margin + Math.random() * (CANVAS_WIDTH - margin * 2),
    y: margin + Math.random() * (CANVAS_HEIGHT - margin * 2),
  };
}

function moveJerry(
  snapshot: GameSnapshot,
  keyState: Record<string, boolean>,
  delta: number
) {
  const direction: Vector = { x: 0, y: 0 };
  if (keyState["arrowup"] || keyState["w"]) direction.y -= 1;
  if (keyState["arrowdown"] || keyState["s"]) direction.y += 1;
  if (keyState["arrowleft"] || keyState["a"]) direction.x -= 1;
  if (keyState["arrowright"] || keyState["d"]) direction.x += 1;

  if (direction.x !== 0 || direction.y !== 0) {
    const length = Math.hypot(direction.x, direction.y) || 1;
    const factor = (JERRY_SPEED * delta) / length;
    snapshot.jerry.x += direction.x * factor;
    snapshot.jerry.y += direction.y * factor;
  }

  snapshot.jerry.x = clampPosition(snapshot.jerry.x, WALL_PADDING, CANVAS_WIDTH - WALL_PADDING);
  snapshot.jerry.y = clampPosition(snapshot.jerry.y, WALL_PADDING, CANVAS_HEIGHT - WALL_PADDING);
}

function moveTom(snapshot: GameSnapshot, delta: number) {
  const { tom, jerry } = snapshot;
  const dx = jerry.x - tom.x;
  const dy = jerry.y - tom.y;
  const distance = Math.hypot(dx, dy) || 1;
  const speed = snapshot.tomSpeed * delta;

  tom.x += (dx / distance) * speed;
  tom.y += (dy / distance) * speed;
  snapshot.tomSpeed += 0.002 * delta;
}

function drawScene(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot, freeze = false) {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawBackground(ctx);
  drawCheese(ctx, snapshot.cheese);
  drawCharacter(ctx, snapshot.jerry, "#ffb703", "#ffd166");
  drawCharacter(ctx, snapshot.tom, "#3b82f6", "#93c5fd");
  drawTomPath(ctx, snapshot.tom, snapshot.jerry);
  if (freeze) {
    drawGameOver(ctx);
  }
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createLinearGradient(0, CANVAS_HEIGHT, 0, 0);
  gradient.addColorStop(0, "#0d1120");
  gradient.addColorStop(1, "#182a5c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  const grid = 60;
  for (let x = grid; x < CANVAS_WIDTH; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_HEIGHT);
    ctx.stroke();
  }
  for (let y = grid; y < CANVAS_HEIGHT; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_WIDTH, y);
    ctx.stroke();
  }
}

function drawCharacter(ctx: CanvasRenderingContext2D, position: Vector, primary: string, accent: string) {
  ctx.fillStyle = primary;
  ctx.beginPath();
  ctx.arc(position.x, position.y, CHARACTER_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(position.x, position.y, CHARACTER_RADIUS / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawCheese(ctx: CanvasRenderingContext2D, position: Vector) {
  ctx.fillStyle = "#ffe066";
  ctx.beginPath();
  ctx.arc(position.x, position.y, CHEESE_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffa94d";
  ctx.lineWidth = 4;
  ctx.stroke();
}

function drawTomPath(ctx: CanvasRenderingContext2D, tom: Vector, jerry: Vector) {
  ctx.strokeStyle = "rgba(147, 197, 253, 0.35)";
  ctx.setLineDash([8, 10]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(tom.x, tom.y);
  ctx.lineTo(jerry.x, jerry.y);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawGameOver(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(13,17,32,0.78)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 44px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Caught!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10);
  ctx.font = "24px 'Trebuchet MS', sans-serif";
  ctx.fillText("Press Space or Tap Start to Replay", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 32);
}

type ScoreBadgeProps = {
  label: string;
  value: number;
};

function ScoreBadge({ label, value }: ScoreBadgeProps) {
  return (
    <div className="flex flex-col items-center rounded-full bg-slate-900 px-5 py-2 text-white shadow">
      <span className="text-[10px] uppercase tracking-[0.35em] text-white/70">{label}</span>
      <span className="text-lg font-extrabold leading-none">{value}</span>
    </div>
  );
}
