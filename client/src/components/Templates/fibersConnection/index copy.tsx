import React, { useRef, useEffect, useState } from 'react';

interface Fiber {
  id: number;
  color: string;
}

interface Cable {
  id: number;
  type: 'incoming' | 'outgoing';
  position: number;
  fibers: Fiber[];
}

interface Connection {
  from: { cableId: number; fiberId: number };
  to: { cableId: number; fiberId: number };
}

const OpticalCableVisualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cables, setCables] = useState<Cable[]>([
    { id: 1, type: 'incoming', position: 100, fibers: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, color: `hsl(${i * 45}, 70%, 50%)` })) },
    { id: 2, type: 'outgoing', position: 300, fibers: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, color: `hsl(${i * 45}, 70%, 50%)` })) },
  ]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedFiber, setSelectedFiber] = useState<{ cableId: number; fiberId: number } | null>(null);

  const drawCable = (ctx: CanvasRenderingContext2D, cable: Cable) => {
    const x = cable.type === 'incoming' ? 100 : 700;
    const fiberSpacing = 20;
    const cableHeight = cable.fibers.length * fiberSpacing;

    // Draw main cable line
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, cable.position - cableHeight / 2);
    ctx.lineTo(x, cable.position + cableHeight / 2);
    ctx.stroke();

    // Draw fibers
    cable.fibers.forEach((fiber, index) => {
      const y = cable.position - cableHeight / 2 + index * fiberSpacing + fiberSpacing / 2;
      
      // Fiber line
      ctx.strokeStyle = fiber.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (cable.type === 'incoming' ? 50 : -50), y);
      ctx.stroke();

      // Fiber connector circle
      ctx.fillStyle = fiber.color;
      ctx.beginPath();
      ctx.arc(x + (cable.type === 'incoming' ? 50 : -50), y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  const drawConnections = (ctx: CanvasRenderingContext2D) => {
    connections.forEach(connection => {
      const fromCable = cables.find(c => c.id === connection.from.cableId);
      const toCable = cables.find(c => c.id === connection.to.cableId);
      
      if (fromCable && toCable) {
        const fromFiberIndex = fromCable.fibers.findIndex(f => f.id === connection.from.fiberId);
        const toFiberIndex = toCable.fibers.findIndex(f => f.id === connection.to.fiberId);
        
        const startX = fromCable.type === 'incoming' ? 150 : 650;
        const startY = fromCable.position - (fromCable.fibers.length * 10) + fromFiberIndex * 20 + 10;
        const endX = toCable.type === 'incoming' ? 150 : 650;
        const endY = toCable.position - (toCable.fibers.length * 10) + toFiberIndex * 20 + 10;

        ctx.strokeStyle = fromCable.fibers[fromFiberIndex].color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.bezierCurveTo(startX + 100, startY, endX - 100, endY, endX, endY);
        ctx.stroke();
      }
    });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check fiber connectors
    cables.forEach(cable => {
      const cableX = cable.type === 'incoming' ? 150 : 650;
      cable.fibers.forEach((fiber, index) => {
        const fiberY = cable.position - (cable.fibers.length * 10) + index * 20 + 10;
        const distance = Math.sqrt((x - cableX) ** 2 + (y - fiberY) ** 2);
        
        if (distance < 8) {
          if (selectedFiber) {
            if (selectedFiber.cableId !== cable.id) {
              setConnections([...connections, {
                from: selectedFiber,
                to: { cableId: cable.id, fiberId: fiber.id }
              }]);
            }
            setSelectedFiber(null);
          } else {
            setSelectedFiber({ cableId: cable.id, fiberId: fiber.id });
          }
        }
      });
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw cables
    cables.forEach(cable => drawCable(ctx, cable));
    
    // Draw connections
    drawConnections(ctx);
    
    // Draw selection
    if (selectedFiber) {
      const cable = cables.find(c => c.id === selectedFiber.cableId);
      if (cable) {
        const fiberIndex = cable.fibers.findIndex(f => f.id === selectedFiber.fiberId);
        const x = cable.type === 'incoming' ? 150 : 650;
        const y = cable.position - (cable.fibers.length * 10) + fiberIndex * 20 + 10;
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }, [cables, connections, selectedFiber]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={500}
      onClick={handleCanvasClick}
      style={{ border: '1px solid #ccc', background: '#fff' }}
    />
  );
};

export default OpticalCableVisualizer;