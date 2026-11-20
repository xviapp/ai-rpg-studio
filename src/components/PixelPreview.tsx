import { useEffect, useRef } from 'react';
import { PREFAB_CATALOG } from '../assets/catalog';
import { TILE_SIZE, drawPrefab, drawSprite, drawTerrainTile } from '../assets/pixelAtlas';
import type { PrefabId, SpriteId, TerrainId } from '../types/project';

interface PixelPreviewProps {
  kind: 'terrain' | 'prefab' | 'sprite';
  id: string;
  size?: number;
}

export function PixelPreview({ kind, id, size = 28 }: PixelPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let srcW = TILE_SIZE;
    let srcH = TILE_SIZE;
    if (kind === 'prefab') {
      const meta = PREFAB_CATALOG[id as PrefabId];
      if (meta) {
        srcW = meta.w * TILE_SIZE;
        srcH = meta.h * TILE_SIZE;
      }
    }

    canvas.width = srcW;
    canvas.height = srcH;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, srcW, srcH);

    if (kind === 'terrain') {
      drawTerrainTile(ctx, id as TerrainId, 1, 1, 0, 0, 15, 0);
    } else if (kind === 'prefab') {
      drawPrefab(ctx, id as PrefabId, 0, 0, 0, 'all');
    } else if (kind === 'sprite') {
      drawSprite(ctx, id as SpriteId, 0, 0, 'down', 0);
    }
  }, [kind, id]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size,
        height: size,
        imageRendering: 'pixelated',
        objectFit: 'contain',
        display: 'block',
        flexShrink: 0,
      }}
    />
  );
}
