import React, { useState } from 'react';
import { Stage, Layer, Group, Line, Circle, Text, Rect, Ellipse } from 'react-konva';

const CadConfigurator = () => {
  // --- Core State ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState('extrude');
  const [currentVertices, setCurrentVertices] = useState([]);
  const [isProfileClosed, setIsProfileClosed] = useState(false);
  const [savedBodies, setSavedBodies] = useState([]);
  const [generatedJson, setGeneratedJson] = useState('');

  // --- Toolbox State ---
  const [drawingTool, setDrawingTool] = useState('polyline');
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tempShape, setTempShape] = useState(null);

  // --- Operation Parameters ---
  const [sweepComponentType, setSweepComponentType] = useState('profile');
  const [revolutionAxis, setRevolutionAxis] = useState('Y');
  const [revolutionDegrees, setRevolutionDegrees] = useState(360);
  const [extrusionLength, setExtrusionLength] = useState(100);

  // --- Constants ---
  const CANVAS_WIDTH = 700;
  const CANVAS_HEIGHT = 500;
  const GRID_SIZE = 20;
  const MAJOR_GRID_SIZE = 100;

  // --- Geometry Handlers ---
  const applyGrid = (val) => (snapToGrid ? Math.round(val / GRID_SIZE) * GRID_SIZE : val);

  const getPointerPos = (e) => {
    const stage = e.target.getStage();
    const pos = stage ? stage.getPointerPosition() : null;
    if (!pos) return { x: 0, y: 0, rawX: 0, rawY: 0 };
    return { x: applyGrid(pos.x), y: applyGrid(pos.y), rawX: pos.x, rawY: pos.y };
  };

  const handleMouseDown = (e) => {
    if (isProfileClosed) return;
    const pos = getPointerPos(e);
    if (pos.rawX < 0 || pos.rawX > CANVAS_WIDTH || pos.rawY < 0 || pos.rawY > CANVAS_HEIGHT) return;

    if (drawingTool === 'polyline') {
      // If user clicks back near start point (>= 3 vertices), close the polygon
      if (currentVertices.length >= 6) {
        const startX = currentVertices[0];
        const startY = currentVertices[1];
        if (Math.hypot(pos.x - startX, pos.y - startY) <= GRID_SIZE) {
          setIsProfileClosed(true);
          return;
        }
      }
      setCurrentVertices([...currentVertices, pos.x, pos.y]);
    } else if (drawingTool === 'rectangle') {
      setIsDrawing(true);
      setTempShape({ startX: pos.x, startY: pos.y, w: 0, h: 0 });
    } else if (drawingTool === 'circle' || drawingTool === 'ellipse') {
      setIsDrawing(true);
      setTempShape({ cx: pos.x, cy: pos.y, rx: 0, ry: 0 });
    } else if (drawingTool === 'freehand') {
      setIsDrawing(true);
      setCurrentVertices([pos.rawX, pos.rawY]);
    }
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    const pos = getPointerPos(e);

    if (drawingTool === 'rectangle' && tempShape) {
      setTempShape({ ...tempShape, w: pos.x - tempShape.startX, h: pos.y - tempShape.startY });
    } else if ((drawingTool === 'circle' || drawingTool === 'ellipse') && tempShape) {
      const dx = Math.abs(pos.x - tempShape.cx);
      const dy = Math.abs(pos.y - tempShape.cy);
      if (drawingTool === 'circle') {
        const radius = Math.max(dx, dy);
        setTempShape({ ...tempShape, rx: radius, ry: radius });
      } else {
        setTempShape({ ...tempShape, rx: dx, ry: dy });
      }
    } else if (drawingTool === 'freehand') {
      if (currentVertices.length >= 2) {
        const lastX = currentVertices[currentVertices.length - 2];
        const lastY = currentVertices[currentVertices.length - 1];
        if (Math.hypot(pos.rawX - lastX, pos.rawY - lastY) > 8) {
          setCurrentVertices([...currentVertices, pos.rawX, pos.rawY]);
        }
      }
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (drawingTool === 'rectangle' && tempShape) {
      const { startX, startY, w, h } = tempShape;
      if (Math.abs(w) > 0 && Math.abs(h) > 0) {
        setCurrentVertices([
          startX,
          startY,
          startX + w,
          startY,
          startX + w,
          startY + h,
          startX,
          startY + h,
        ]);
        setIsProfileClosed(true);
      }
      setTempShape(null);
    } else if ((drawingTool === 'circle' || drawingTool === 'ellipse') && tempShape) {
      const { cx, cy, rx, ry } = tempShape;
      if (rx > 0 && ry > 0) {
        const points = [];
        const segments = 64;
        for (let i = 0; i < segments; i++) {
          const theta = (i / segments) * 2 * Math.PI;
          points.push(cx + rx * Math.cos(theta), cy + ry * Math.sin(theta));
        }
        setCurrentVertices(points);
        setIsProfileClosed(true);
      }
      setTempShape(null);
    } else if (drawingTool === 'freehand') {
      if (currentVertices.length >= 6) {
        const startX = currentVertices[0];
        const startY = currentVertices[1];
        const endX = currentVertices[currentVertices.length - 2];
        const endY = currentVertices[currentVertices.length - 1];

        if (Math.hypot(endX - startX, endY - startY) < 25) {
          setIsProfileClosed(true);
        }
      }
    }
  };

  const handleDoubleClick = () => {
    if (drawingTool === 'polyline' && currentVertices.length >= 6) {
      setIsProfileClosed(true);
    }
  };

  // --- Grid and Coordinate Axes Renderer ---
  const renderGridAndAxes = () => {
    const originX = CANVAS_WIDTH / 2;
    const originY = CANVAS_HEIGHT / 2;
    const elements = [];

    // 1. Grid Lines (Minor & Major)
    // Vertical grid lines
    for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE) {
      const isMajor = Math.abs(x - originX) % MAJOR_GRID_SIZE === 0;
      const isCenterAxis = x === originX;
      if (!isCenterAxis) {
        elements.push(
          <Line
            key={`v-grid-${x}`}
            points={[x, 0, x, CANVAS_HEIGHT]}
            stroke={isMajor ? '#cbd5e1' : '#f1f5f9'}
            strokeWidth={isMajor ? 1.2 : 0.8}
            listening={false}
          />
        );
      }
    }

    // Horizontal grid lines
    for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE) {
      const isMajor = Math.abs(y - originY) % MAJOR_GRID_SIZE === 0;
      const isCenterAxis = y === originY;
      if (!isCenterAxis) {
        elements.push(
          <Line
            key={`h-grid-${y}`}
            points={[0, y, CANVAS_WIDTH, y]}
            stroke={isMajor ? '#cbd5e1' : '#f1f5f9'}
            strokeWidth={isMajor ? 1.2 : 0.8}
            listening={false}
          />
        );
      }
    }

    // 2. Axes Lines
    // X-Axis (Horizontal)
    elements.push(
      <Line
        key="x-axis-line"
        points={[0, originY, CANVAS_WIDTH, originY]}
        stroke="#ef4444"
        strokeWidth={1.8}
        listening={false}
      />
    );

    // Y-Axis (Vertical)
    elements.push(
      <Line
        key="y-axis-line"
        points={[originX, 0, originX, CANVAS_HEIGHT]}
        stroke="#22c55e"
        strokeWidth={1.8}
        listening={false}
      />
    );

    // 3. Grid Coordinates Text
    for (let x = 0; x <= CANVAS_WIDTH; x += MAJOR_GRID_SIZE) {
      const val = x - originX;
      if (val !== 0) {
        elements.push(
          <Text
            key={`x-label-${x}`}
            x={x - 14}
            y={originY + 4}
            text={`${val}`}
            fontSize={9}
            fill="#64748b"
            fontFamily="monospace"
            listening={false}
          />
        );
      }
    }

    for (let y = 0; y <= CANVAS_HEIGHT; y += MAJOR_GRID_SIZE) {
      const val = originY - y;
      if (val !== 0) {
        elements.push(
          <Text
            key={`y-label-${y}`}
            x={originX + 4}
            y={y - 5}
            text={`${val}`}
            fontSize={9}
            fill="#64748b"
            fontFamily="monospace"
            listening={false}
          />
        );
      }
    }

    // Axis arrows / direction labels
    elements.push(
      <Text
        key="x-axis-dir"
        x={CANVAS_WIDTH - 24}
        y={originY + 6}
        text="+X"
        fontSize={11}
        fontStyle="bold"
        fill="#ef4444"
        fontFamily="sans-serif"
        listening={false}
      />
    );

    elements.push(
      <Text
        key="y-axis-dir"
        x={originX + 6}
        y={6}
        text="+Y"
        fontSize={11}
        fontStyle="bold"
        fill="#22c55e"
        fontFamily="sans-serif"
        listening={false}
      />
    );

    // Origin dot and label
    elements.push(
      <Circle
        key="origin-dot"
        x={originX}
        y={originY}
        radius={3.5}
        fill="#3b82f6"
        listening={false}
      />
    );

    elements.push(
      <Text
        key="origin-text"
        x={originX + 5}
        y={originY + 5}
        text="(0,0)"
        fontSize={10}
        fontStyle="bold"
        fill="#475569"
        fontFamily="monospace"
        listening={false}
      />
    );

    return <Group listening={false}>{elements}</Group>;
  };

  // --- Utility & Export ---
  const clearCanvas = () => {
    setCurrentVertices([]);
    setIsProfileClosed(false);
    setTempShape(null);
    setGeneratedJson('');
  };

  const getCanvasVerticesFormatted = () => {
    const formatted = [];
    for (let i = 0; i < currentVertices.length; i += 2) {
      formatted.push([
        currentVertices[i] - CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2 - currentVertices[i + 1],
      ]);
    }
    return formatted;
  };

  const saveCurrentBody = () => {
    if (currentVertices.length < 4) {
      alert('Please draw at least 2 points before saving a sketch.');
      return;
    }
    const formattedVertices = getCanvasVerticesFormatted();
    setSavedBodies([
      ...savedBodies,
      {
        id: Date.now(),
        type: sweepComponentType,
        vertices: formattedVertices,
        isClosed: isProfileClosed,
      },
    ]);
    setCurrentVertices([]);
    setIsProfileClosed(false);
    setTempShape(null);
  };

  const removeSavedBody = (index) => {
    setSavedBodies(savedBodies.filter((_, i) => i !== index));
  };

  const exportPayload = async () => {
    const hasCanvasDrawing = currentVertices.length >= 4;
    const hasSavedBodies = savedBodies.length > 0;

    if (!hasCanvasDrawing && !hasSavedBodies) {
      alert('Please draw a profile on the canvas before generating a 3D model.');
      return;
    }

    const payload = { operationType: selectedOperation };
    const currentFormatted = getCanvasVerticesFormatted();
    const currentProfileObj = {
      vertices: currentFormatted,
      isClosed: isProfileClosed,
    };

    if (selectedOperation === 'extrude') {
      const profile = hasCanvasDrawing ? currentProfileObj : savedBodies[savedBodies.length - 1];
      payload.profile = profile;
      payload.length = extrusionLength;
    } else if (selectedOperation === 'revolve') {
      const profile = hasCanvasDrawing ? currentProfileObj : savedBodies[savedBodies.length - 1];
      payload.profile = profile;
      payload.axis = revolutionAxis;
      payload.degrees = revolutionDegrees;
    } else if (selectedOperation === 'sweep') {
      const allSketches = [...savedBodies];
      if (hasCanvasDrawing) {
        allSketches.push({
          type: sweepComponentType,
          vertices: currentFormatted,
          isClosed: isProfileClosed,
        });
      }
      payload.bodies = allSketches;
      const profileSketch = allSketches.find((b) => b.type === 'profile') || allSketches[0];
      const pathSketch = allSketches.find((b) => b.type === 'path') || allSketches[1];
      if (profileSketch) payload.profile = profileSketch;
      if (pathSketch) payload.path = pathSketch;
    } else if (
      selectedOperation === 'union' ||
      selectedOperation === 'difference' ||
      selectedOperation === 'intersection'
    ) {
      const bodiesToUse = [...savedBodies];
      if (hasCanvasDrawing) {
        bodiesToUse.push({
          type: 'extrude',
          vertices: currentFormatted,
          isClosed: isProfileClosed,
        });
      }
      if (bodiesToUse.length < 2) {
        alert(
          `Error: ${selectedOperation} requires at least two saved sketches. Use "Save Current Sketch" to save bodies.`
        );
        return;
      }
      payload.bodies = bodiesToUse.map((b) => ({
        type: 'extrude',
        profile: b,
        length: extrusionLength,
      }));
    }

    const jsonOutput = JSON.stringify(payload, null, 2);
    setGeneratedJson(jsonOutput);

    setIsGenerating(true);
    try {
      const response = await fetch('http://localhost:8080/api/generate-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonOutput,
      });

      if (!response.ok) throw new Error('Backend failed to generate the model.');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'generated_model.step';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // --- Main Render ---
  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-6 bg-gray-100 min-h-screen font-sans">
      <header className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">UG Project: Parametric Beam Generator</h1>
          <p className="text-gray-600 text-sm">
            Draw cross-sections on the coordinate grid and define operations to generate 3D STEP files.
          </p>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* LEFT COLUMN: Sidebar Controls */}
        <div className="w-full lg:w-72 flex-shrink-0 bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex flex-col gap-5 h-fit">
          <h2 className="font-semibold text-gray-700 border-b pb-2">Operation Parameters</h2>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-500 uppercase">Operation Type</label>
            <select
              value={selectedOperation}
              onChange={(e) => {
                setSelectedOperation(e.target.value);
                setSavedBodies([]);
                clearCanvas();
              }}
              className="w-full border p-2 text-sm rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="extrude">Extrude</option>
              <option value="revolve">Revolve</option>
              <option value="sweep">Sweep</option>
              <option value="union">Boolean Union</option>
              <option value="difference">Boolean Difference</option>
              <option value="intersection">Boolean Intersection</option>
            </select>
          </div>

          {selectedOperation === 'extrude' && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-gray-500 uppercase">
                Extrusion Length (mm)
              </label>
              <input
                type="number"
                value={extrusionLength}
                onChange={(e) => setExtrusionLength(Number(e.target.value))}
                className="w-full border p-2 text-sm rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {selectedOperation === 'revolve' && (
            <>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-gray-500 uppercase">Rotation Axis</label>
                <select
                  value={revolutionAxis}
                  onChange={(e) => setRevolutionAxis(e.target.value)}
                  className="w-full border p-2 text-sm rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Y">Y-Axis (Vertical)</option>
                  <option value="X">X-Axis (Horizontal)</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-gray-500 uppercase">
                  Revolution Angle (°)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="360"
                    value={revolutionDegrees}
                    onChange={(e) =>
                      setRevolutionDegrees(Math.min(360, Math.max(1, Number(e.target.value))))
                    }
                    className="w-full border p-2 text-sm rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-500 font-medium">°</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="360"
                  value={revolutionDegrees}
                  onChange={(e) => setRevolutionDegrees(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>1°</span>
                  <span className="font-semibold text-blue-600">{revolutionDegrees}°</span>
                  <span>360°</span>
                </div>
              </div>
            </>
          )}

          {selectedOperation === 'sweep' && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-gray-500 uppercase">Active Sketch</label>
              <select
                value={sweepComponentType}
                onChange={(e) => setSweepComponentType(e.target.value)}
                className="w-full border p-2 text-sm rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="profile">Cross-Section Profile</option>
                <option value="path">Sweep Path</option>
              </select>
            </div>
          )}

          {/* Saved Bodies List */}
          {savedBodies.length > 0 && (
            <div className="flex flex-col gap-2 border-t pt-3">
              <span className="text-xs font-semibold text-gray-600 uppercase">
                Saved Sketches ({savedBodies.length})
              </span>
              <div className="max-h-32 overflow-y-auto flex flex-col gap-1.5 pr-1">
                {savedBodies.map((b, idx) => (
                  <div
                    key={b.id || idx}
                    className="flex justify-between items-center text-xs bg-purple-50 border border-purple-200 text-purple-700 px-2 py-1 rounded"
                  >
                    <span>
                      #{idx + 1} {b.type} ({b.vertices?.length || 0} pts)
                    </span>
                    <button
                      onClick={() => removeSavedBody(idx)}
                      className="text-red-500 hover:text-red-700 font-bold ml-2"
                      title="Delete sketch"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-2 pt-4 border-t flex flex-col gap-3">
            <button
              onClick={saveCurrentBody}
              disabled={currentVertices.length < 4}
              className="w-full py-2 bg-gray-100 text-gray-700 font-medium rounded hover:bg-gray-200 border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Current Sketch
            </button>
            <button
              onClick={clearCanvas}
              disabled={isGenerating || (currentVertices.length === 0 && !isProfileClosed)}
              className="w-full py-2 bg-red-50 text-red-600 font-medium rounded hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Clear Canvas
            </button>
            <button
              onClick={exportPayload}
              disabled={isGenerating}
              className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white flex-shrink-0"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  <span>Generating file…</span>
                </>
              ) : downloadSuccess ? (
                <span>✓ File downloaded!</span>
              ) : (
                <span>⬡ Generate 3D Model</span>
              )}
            </button>

            {isGenerating && (
              <div className="mt-1 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 flex items-start gap-2">
                <span className="mt-0.5 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-blue-500 animate-pulse" />
                <p className="text-xs text-blue-700 leading-tight">
                  FreeCAD is building your model. The file will download automatically when ready.
                </p>
              </div>
            )}

            {downloadSuccess && !isGenerating && (
              <div className="mt-1 rounded-md bg-green-50 border border-green-200 px-3 py-2 flex items-center gap-2">
                <span className="text-green-600 text-sm">✓</span>
                <p className="text-xs text-green-700">
                  Your <strong>generated_model.step</strong> file has been downloaded.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* MIDDLE COLUMN: Canvas Area with Toolbar */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {/* Tools toolbar */}
          <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-200 flex gap-4 items-center px-4 overflow-x-auto">
            <span className="text-sm font-semibold text-gray-600 border-r pr-4 whitespace-nowrap">
              Tools:
            </span>

            <button
              onClick={() => setDrawingTool('polyline')}
              className={`px-2.5 py-1 rounded text-sm transition-colors whitespace-nowrap ${
                drawingTool === 'polyline'
                  ? 'bg-blue-100 text-blue-700 font-semibold'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              📐 Polyline
            </button>
            <button
              onClick={() => setDrawingTool('rectangle')}
              className={`px-2.5 py-1 rounded text-sm transition-colors whitespace-nowrap ${
                drawingTool === 'rectangle'
                  ? 'bg-blue-100 text-blue-700 font-semibold'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              ⬛ Rectangle
            </button>
            <button
              onClick={() => setDrawingTool('circle')}
              className={`px-2.5 py-1 rounded text-sm transition-colors whitespace-nowrap ${
                drawingTool === 'circle'
                  ? 'bg-blue-100 text-blue-700 font-semibold'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              ⭕ Circle
            </button>
            <button
              onClick={() => setDrawingTool('ellipse')}
              className={`px-2.5 py-1 rounded text-sm transition-colors whitespace-nowrap ${
                drawingTool === 'ellipse'
                  ? 'bg-blue-100 text-blue-700 font-semibold'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              ⬭ Ellipse
            </button>
            <button
              onClick={() => setDrawingTool('freehand')}
              className={`px-2.5 py-1 rounded text-sm transition-colors whitespace-nowrap ${
                drawingTool === 'freehand'
                  ? 'bg-blue-100 text-blue-700 font-semibold'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              ✏️ Freehand
            </button>

            <div className="ml-auto flex items-center gap-2 whitespace-nowrap border-l pl-4">
              <input
                type="checkbox"
                id="snap"
                checked={snapToGrid}
                onChange={(e) => setSnapToGrid(e.target.checked)}
                className="cursor-pointer"
              />
              <label htmlFor="snap" className="text-sm text-gray-600 cursor-pointer">
                Snap to Grid ({GRID_SIZE}mm)
              </label>
            </div>
          </div>

          {/* Konva Canvas */}
          <div className="bg-white p-1 rounded-lg shadow-sm border border-gray-200 overflow-hidden flex justify-center items-center">
            <div className="border border-gray-300 bg-white cursor-crosshair shadow-sm relative">
              <Stage
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onDblClick={handleDoubleClick}
              >
                {/* Background Grid and CAD Axes */}
                <Layer>{renderGridAndAxes()}</Layer>

                {/* Drawing Layer */}
                <Layer>
                  {/* Saved Bodies (Violet Dashed Lines) */}
                  {savedBodies.map((body, idx) => {
                    const points = [];
                    body.vertices.forEach(([cadX, cadY]) => {
                      points.push(cadX + CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - cadY);
                    });
                    return (
                      <Group key={`saved-body-${idx}`}>
                        <Line
                          points={points}
                          stroke="#8b5cf6"
                          strokeWidth={2}
                          dash={[6, 4]}
                          closed={body.isClosed}
                          fill={body.isClosed ? 'rgba(139, 92, 246, 0.12)' : undefined}
                        />
                        {points.length >= 2 && (
                          <Text
                            x={points[0] + 4}
                            y={points[1] - 14}
                            text={`${body.type || 'Sketch'} #${idx + 1}`}
                            fontSize={10}
                            fill="#7c3aed"
                            fontStyle="bold"
                            listening={false}
                          />
                        )}
                      </Group>
                    );
                  })}

                  {/* Active dragging temporary shape */}
                  {tempShape && drawingTool === 'rectangle' && (
                    <Rect
                      x={tempShape.startX}
                      y={tempShape.startY}
                      width={tempShape.w}
                      height={tempShape.h}
                      stroke="#2563eb"
                      strokeWidth={2}
                      dash={[5, 5]}
                    />
                  )}
                  {tempShape && (drawingTool === 'circle' || drawingTool === 'ellipse') && (
                    <Ellipse
                      x={tempShape.cx}
                      y={tempShape.cy}
                      radiusX={tempShape.rx}
                      radiusY={tempShape.ry}
                      stroke="#2563eb"
                      strokeWidth={2}
                      dash={[5, 5]}
                    />
                  )}

                  {/* Current Active Shape / Profile */}
                  <Line
                    points={currentVertices}
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    closed={isProfileClosed}
                    fill={isProfileClosed ? 'rgba(37, 99, 235, 0.18)' : undefined}
                    lineJoin="round"
                    tension={drawingTool === 'freehand' ? 0.3 : 0}
                  />

                  {/* Polyline Control Points */}
                  {drawingTool === 'polyline' &&
                    currentVertices.map((p, i) => {
                      if (i % 2 !== 0) return null;
                      const isStart = i === 0;
                      return (
                        <Circle
                          key={i}
                          x={currentVertices[i]}
                          y={currentVertices[i + 1]}
                          radius={isStart && currentVertices.length >= 6 ? 6 : 4}
                          fill={isStart && currentVertices.length >= 6 ? '#10b981' : '#ef4444'}
                          stroke="#fff"
                          strokeWidth={isStart && currentVertices.length >= 6 ? 2 : 1}
                        />
                      );
                    })}
                </Layer>
              </Stage>

              {/* Status and instructions overlay badge */}
              <div className="absolute top-3 right-4 bg-white/90 px-3 py-1.5 text-xs text-gray-700 rounded border backdrop-blur-sm pointer-events-none shadow-sm flex items-center gap-2">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    isProfileClosed ? 'bg-green-500' : 'bg-amber-500'
                  }`}
                />
                <span>
                  {isProfileClosed
                    ? 'Profile Closed (Ready to Generate)'
                    : drawingTool === 'polyline'
                    ? currentVertices.length >= 6
                      ? 'Click green start point or double-click to close profile'
                      : 'Click canvas to add vertices'
                    : selectedOperation === 'revolve' && drawingTool === 'freehand'
                    ? 'Draw curve — open curve OK for revolve'
                    : 'Click and drag to draw shape'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: JSON Viewer */}
        <div className="w-full lg:w-80 flex-shrink-0 bg-gray-900 rounded-lg shadow-sm border border-gray-700 flex flex-col h-[556px] mt-[50px] lg:mt-0">
          <div className="flex justify-between items-center p-3 border-b border-gray-700 bg-gray-800 rounded-t-lg">
            <h2 className="text-sm font-semibold text-gray-200">Output Payload</h2>
            <button
              onClick={() => {
                if (generatedJson) {
                  navigator.clipboard.writeText(generatedJson);
                  alert('JSON copied to clipboard!');
                }
              }}
              disabled={!generatedJson}
              className="text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 px-3 py-1 rounded transition-colors"
            >
              Copy
            </button>
          </div>
          <div className="p-4 overflow-y-auto flex-1 text-xs font-mono text-green-400 whitespace-pre-wrap break-all custom-scrollbar">
            {generatedJson || "// Draw your shape and click 'Generate 3D Model' to preview the payload here..."}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CadConfigurator;